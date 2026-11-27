// specs/003 T030 — convert_markup: Tailwind or Bootstrap markup → newBrush. Only class attributes change (located by
// parse5, rewritten in place), so text, structure and every other attribute stay byte-for-byte the same. Every class
// written is checked against newBrush; anything without an equivalent is left out and listed with the reason.
import { createEngine } from "@newbrush/engine";
import { type DefaultTreeAdapterMap, parse, parseFragment } from "parse5";
import { convertBootstrap } from "../convert/bootstrap.ts";
import { convertTailwind } from "../convert/tailwind.ts";
import type { ConvertContext, ElementInfo, Unmapped } from "../convert/types.ts";
import { escapeHtml } from "../html/index.ts";
import { ConvertMarkupInput, type ConvertMarkupOutput, LIMITS } from "../schemas/index.ts";
import { fail } from "./errors.ts";
import { componentClasses } from "./suggest.ts";
import { parseInput } from "./validate.ts";

type Node = DefaultTreeAdapterMap["node"];
type Element = DefaultTreeAdapterMap["element"];

const isElement = (n: Node): n is Element => "tagName" in n;
const childrenOf = (n: Node): Node[] =>
  isElement(n) && n.tagName === "template"
    ? (n as DefaultTreeAdapterMap["template"]).content.childNodes
    : "childNodes" in n
      ? (n.childNodes as Node[])
      : [];
const info = (el: Element): ElementInfo => {
  const attrs = Object.fromEntries(el.attrs.map((a) => [a.name, a.value]));
  return { tag: el.tagName, classes: (attrs.class ?? "").split(/\s+/).filter(Boolean), attrs };
};

let engine: ReturnType<typeof createEngine> | undefined;
const knownCache = new Map<string, boolean>();
/** Whether newBrush has this class: a component, part, modifier or style class, or a utility the engine generates. */
export function isNewBrushClass(cls: string): boolean {
  if (componentClasses.has(cls)) return true;
  let known = knownCache.get(cls);
  if (known === undefined) {
    engine ??= createEngine({ content: ["mcp"] });
    const { classes } = engine.generate([cls], { reportUnknown: true });
    known = classes.used.includes(cls);
    knownCache.set(cls, known);
  }
  return known;
}

export function convertMarkup(input: ConvertMarkupInput): ConvertMarkupOutput {
  const { html, from } = parseInput(ConvertMarkupInput, input);
  if (new TextEncoder().encode(html).length > LIMITS.htmlBytes)
    fail("NB_INPUT_TOO_LARGE", `html is larger than ${LIMITS.htmlBytes / 1024} KB.`, {
      path: "html",
    });
  const isDocument = /^\s*(<!--[\s\S]*?-->\s*)*(<!doctype|<html[\s>])/i.test(html);
  const tree: Node = isDocument
    ? parse(html, { sourceCodeLocationInfo: true })
    : parseFragment(html, { sourceCodeLocationInfo: true });

  const result = new Map<Element, string[]>();
  const parentNeeds = new Map<Element, string[]>();
  const unmapped: Unmapped[] = [];
  let mapped = 0;

  const walk = (n: Node, ancestors: Element[]) => {
    for (const child of childrenOf(n)) {
      if (!isElement(child)) continue;
      const self = info(child);
      if (self.classes.length && child.sourceCodeLocation) {
        const ctx: ConvertContext = {
          ...self,
          ancestors: ancestors.map(info),
          children: childrenOf(child).filter(isElement).map(info),
        };
        const r =
          from === "tailwind" ? convertTailwind(ctx, isNewBrushClass) : convertBootstrap(ctx);
        const lost = new Set(r.unmapped.map((u) => u.class));
        const classes: string[] = [];
        for (const c of r.classes) {
          if (isNewBrushClass(c)) classes.push(c);
          else if (!lost.has(c)) {
            lost.add(c);
            r.unmapped.push({ class: c, reason: "no newBrush equivalent" });
          }
        }
        unmapped.push(...r.unmapped);
        mapped += self.classes.filter((c) => !lost.has(c)).length;
        result.set(child, classes);
        const parent = ancestors[ancestors.length - 1];
        if (r.parent?.length && parent)
          parentNeeds.set(parent, [...(parentNeeds.get(parent) ?? []), ...r.parent]);
      }
      walk(child, [...ancestors, child]);
    }
  };
  walk(tree, []);

  // Edits by source offset: a class attribute replaced (or removed when empty), or one inserted after the tag name.
  const edits: { start: number; end: number; text: string }[] = [];
  const quote = (classes: string[]) => `class="${escapeHtml(classes.join(" "))}"`;
  for (const el of new Set([...result.keys(), ...parentNeeds.keys()])) {
    const loc = el.sourceCodeLocation;
    if (!loc?.startTag) continue;
    const classes = [
      ...new Set([...(parentNeeds.get(el) ?? []), ...(result.get(el) ?? info(el).classes)]),
    ];
    const attr = loc.attrs?.class;
    if (attr) {
      // Drop the attribute and the space before it when nothing is left.
      const start = classes.length
        ? attr.startOffset
        : attr.startOffset - (/\s/.test(html[attr.startOffset - 1] ?? "") ? 1 : 0);
      edits.push({ start, end: attr.endOffset, text: classes.length ? quote(classes) : "" });
    } else if (classes.length) {
      const at = loc.startTag.startOffset + 1 + el.tagName.length;
      edits.push({ start: at, end: at, text: ` ${quote(classes)}` });
    }
  }
  let out = html;
  for (const e of edits.sort((a, b) => b.start - a.start))
    out = out.slice(0, e.start) + e.text + out.slice(e.end);

  const seen = new Set<string>();
  const unique = unmapped.filter((u) => {
    const key = `${u.class}|${u.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { html: out, mapped, unmapped: unique };
}
