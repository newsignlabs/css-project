// specs/003 T029 — validate_markup: checks HTML that uses newBrush without a browser. It finds unknown and invalid
// classes, component parts outside their component and modifiers without their root (from the manifest anatomy),
// quick accessibility problems (alt text, accessible names, form labels, duplicate ids, unsafe URLs, document
// language, heading order) and low contrast between newBrush colour utilities, each with its line and column.
import { createEngine } from "@newbrush/engine";
import { parse as parseColor, wcagContrast } from "culori";
import { type DefaultTreeAdapterMap, parse, parseFragment } from "parse5";
import { safeUrl } from "../html/index.ts";
import { manifest } from "../manifest.ts";
import {
  type Diagnostic,
  LIMITS,
  ValidateMarkupInput,
  type ValidateMarkupOutput,
} from "../schemas/index.ts";
import { fail } from "./errors.ts";
import { componentClasses, suggest } from "./suggest.ts";
import { parseInput } from "./validate.ts";

type Node = DefaultTreeAdapterMap["node"];
type Element = DefaultTreeAdapterMap["element"];

// ── Manifest anatomy ─────────────────────────────────────────────────────────

const roots = new Set(manifest.components.map((c) => c.className));
/** Part class → the class an ancestor must have (parts that are also a component root are skipped: nb-btn). */
const requiredParent = new Map<string, string>();
/** Modifier and size class → the root class it modifies. */
const modifierRoot = new Map<string, string>();
for (const c of manifest.components) {
  for (const a of c.anatomy)
    if (a.requiredParent && !/\s/.test(a.className) && !roots.has(a.className))
      requiredParent.set(a.className, a.requiredParent);
  for (const cls of [
    ...c.modifiers.map((m) => m.className),
    ...c.sizes.map((s) => `${c.className}--${s}`),
  ])
    if (!/\s/.test(cls)) modifierRoot.set(cls, c.className);
}

// ── Colour utilities ─────────────────────────────────────────────────────────

const tokenByVar = new Map(manifest.tokens.map((t) => [t.cssVar, t]));
const THEMES = ["light", "dark"] as const;
type Theme = (typeof THEMES)[number];
type Colours = Record<Theme, string>;
const DEFAULT_TEXT = tokenByVar.get("--nb-color-text");
const DEFAULT_SURFACE = tokenByVar.get("--nb-color-surface");

function themed(value: string): Colours | undefined {
  const v = /^var\((--nb-[a-z0-9-]+)\)$/.exec(value.trim())?.[1];
  if (v) {
    const token = tokenByVar.get(v);
    if (!token) return undefined;
    const out = { light: token.value, dark: token.themes.dark ?? token.value };
    return parseColor(out.light) && parseColor(out.dark) ? out : undefined;
  }
  return parseColor(value) ? { light: value, dark: value } : undefined;
}
const fromToken = (t: typeof DEFAULT_TEXT): Colours | undefined =>
  t ? { light: t.value, dark: t.themes.dark ?? t.value } : undefined;

/** What a utility class sets: its text colour and/or background, per theme (base classes only, no variants). */
function colourUtilities(classes: string[]): Map<string, { fg?: Colours; bg?: Colours }> {
  const engine = createEngine({ content: ["mcp"] });
  const out = new Map<string, { fg?: Colours; bg?: Colours }>();
  for (const cls of classes) {
    if (!/^(text|bg)-/.test(cls) || /[:/]/.test(cls.replace(/\[[^\]]*\]/g, ""))) continue;
    const css = engine.generate([cls], { reportUnknown: false }).css;
    const fg = /[{;\s]color:\s*([^;]+);/.exec(css)?.[1];
    const bg = /background-color:\s*([^;]+);/.exec(css)?.[1];
    const entry = {
      ...(fg && themed(fg) ? { fg: themed(fg) } : {}),
      ...(bg && themed(bg) ? { bg: themed(bg) } : {}),
    };
    if (entry.fg || entry.bg) out.set(cls, entry);
  }
  return out;
}

// ── Tree helpers ─────────────────────────────────────────────────────────────

const isElement = (n: Node): n is Element => "tagName" in n;
const attr = (el: Element, name: string) => el.attrs.find((a) => a.name === name)?.value;
const classesOf = (el: Element) => (attr(el, "class") ?? "").split(/\s+/).filter(Boolean);
const children = (n: Node): Node[] =>
  isElement(n) && n.tagName === "template"
    ? ((n as DefaultTreeAdapterMap["template"]).content.childNodes ?? [])
    : "childNodes" in n
      ? (n.childNodes as Node[])
      : [];

/** The text a screen reader would announce for an element's content (aria-hidden subtrees skipped). */
function textOf(n: Node): string {
  if (n.nodeName === "#text") return (n as DefaultTreeAdapterMap["textNode"]).value;
  if (!isElement(n)) return children(n).map(textOf).join("");
  if (attr(n, "aria-hidden") === "true") return "";
  const label = attr(n, "aria-label");
  if (label?.trim()) return label;
  if (n.tagName === "img") return attr(n, "alt") ?? "";
  return children(n).map(textOf).join("");
}
const named = (el: Element) =>
  Boolean(
    attr(el, "aria-label")?.trim() ||
      attr(el, "aria-labelledby")?.trim() ||
      attr(el, "title")?.trim(),
  );

const URL_ATTRS = ["href", "src", "action", "formaction", "poster", "cite"];
const DATA_IMAGE = /^data:image\/(png|jpe?g|gif|webp|avif);/i;
const UNLABELLED_INPUTS = new Set(["hidden", "submit", "button", "reset", "image"]);

// ── Validation ───────────────────────────────────────────────────────────────

export function validateMarkup(input: ValidateMarkupInput): ValidateMarkupOutput {
  const { html, level = "AA" } = parseInput(ValidateMarkupInput, input);
  if (new TextEncoder().encode(html).length > LIMITS.htmlBytes)
    fail("NB_INPUT_TOO_LARGE", `html is larger than ${LIMITS.htmlBytes / 1024} KB.`, {
      path: "html",
    });
  const isDocument = /^\s*(<!--[\s\S]*?-->\s*)*(<!doctype|<html[\s>])/i.test(html);
  const tree: Node = isDocument
    ? parse(html, { sourceCodeLocationInfo: true })
    : parseFragment(html, { sourceCodeLocationInfo: true });

  const found: { line: number; col: number; d: Diagnostic }[] = [];
  const at = (el: Element) => {
    const loc = el.sourceCodeLocation;
    return { line: loc?.startLine ?? 0, col: loc?.startCol ?? 0 };
  };
  const report = (el: Element | undefined, d: Diagnostic) => {
    const { line, col } = el ? at(el) : { line: 0, col: 0 };
    found.push({
      line,
      col,
      d: el?.sourceCodeLocation ? { ...d, path: `L${line}:C${col} <${el.tagName}>` } : d,
    });
  };

  // First pass: every element (with its ancestors), ids and label targets.
  const elements: { el: Element; ancestors: Element[] }[] = [];
  const walk = (n: Node, ancestors: Element[]) => {
    for (const child of children(n)) {
      if (!isElement(child)) continue;
      // Elements the parser inserted (html, head, body of a fragment-like document) have no source location.
      elements.push({ el: child, ancestors });
      walk(child, [...ancestors, child]);
    }
  };
  walk(tree, []);
  const labelled = new Set(
    elements
      .filter(({ el }) => el.tagName === "label")
      .map(({ el }) => attr(el, "for"))
      .filter(Boolean),
  );

  // Classes: utilities are checked by the engine once, in order of first use.
  const firstUse = new Map<string, Element>();
  for (const { el } of elements)
    for (const c of classesOf(el)) if (!firstUse.has(c)) firstUse.set(c, el);
  const utilities = [...firstUse.keys()].filter((c) => !componentClasses.has(c));
  const generated = createEngine({ content: ["mcp"] }).generate(utilities, { reportUnknown: true });
  for (const d of generated.classes.rejected)
    report(d.class ? firstUse.get(d.class) : undefined, { ...d, severity: "error" });
  for (const c of generated.classes.unknown) {
    const suggestions = suggest(c);
    report(firstUse.get(c), {
      code: "NB_UNKNOWN_CLASS",
      severity: "warning",
      message: `"${c}" is not a newBrush class.${suggestions.length ? ` Did you mean ${suggestions.join(", ")}?` : ""}`,
      class: c,
      ...(suggestions[0] ? { suggestion: suggestions[0] } : {}),
    });
  }
  const colours = colourUtilities(utilities);

  const ids = new Map<string, Element>();
  const headings: { el: Element; level: number }[] = [];
  const contrastSeen = new Set<string>();
  const minimum = level === "AAA" ? 7 : 4.5;

  for (const { el, ancestors } of elements) {
    const tag = el.tagName;
    const classes = classesOf(el);
    const ancestorClasses = new Set(ancestors.flatMap(classesOf));

    // Anatomy.
    for (const c of classes) {
      const parent = requiredParent.get(c);
      if (parent && !ancestorClasses.has(parent))
        report(el, {
          code: "NB_ANATOMY_INVALID",
          severity: "error",
          message: `.${c} must be inside an element with .${parent}.`,
          class: c,
          suggestion: parent,
        });
      const root = modifierRoot.get(c);
      if (root && !classes.includes(root))
        report(el, {
          code: "NB_ANATOMY_INVALID",
          severity: "error",
          message: `.${c} modifies .${root}; add .${root} to the same element.`,
          class: c,
          suggestion: root,
        });
    }

    // Ids.
    const id = attr(el, "id");
    if (id !== undefined) {
      if (ids.has(id))
        report(el, {
          code: "NB_DUPLICATE_ID",
          severity: "error",
          message: `id "${id}" is already used at ${at(ids.get(id) as Element).line}:${at(ids.get(id) as Element).col}; ids must be unique.`,
        });
      else ids.set(id, el);
    }

    // URLs.
    for (const name of URL_ATTRS) {
      const value = attr(el, name);
      if (value === undefined || safeUrl(value) !== undefined) continue;
      if (name === "src" && DATA_IMAGE.test(value.trim())) continue;
      report(el, {
        code: "NB_UNSAFE_URL",
        severity: "error",
        message: `${name}="${value.slice(0, 60)}" uses a scheme that can run script; use http(s), mailto, tel or a relative URL.`,
      });
    }

    // Images.
    if (
      (tag === "img" || (tag === "input" && attr(el, "type") === "image")) &&
      attr(el, "alt") === undefined
    )
      report(el, {
        code: "NB_MISSING_ALT",
        severity: "error",
        message: 'Image without alt text: describe it in alt, or use alt="" if it is decorative.',
      });

    // Accessible names of buttons and links.
    const role = attr(el, "role");
    const isButton = tag === "button" || role === "button";
    const isLink = (tag === "a" && attr(el, "href") !== undefined) || role === "link";
    if ((isButton || isLink) && !named(el) && !textOf(el).trim())
      report(el, {
        code: "NB_MISSING_NAME",
        severity: "error",
        message: `${isButton ? "Button" : "Link"} without an accessible name: add text, aria-label or aria-labelledby.`,
      });

    // Form labels.
    const type = (attr(el, "type") ?? "text").toLowerCase();
    const isControl =
      (tag === "input" && !UNLABELLED_INPUTS.has(type)) || tag === "select" || tag === "textarea";
    if (
      isControl &&
      !named(el) &&
      !(id && labelled.has(id)) &&
      !ancestors.some((a) => a.tagName === "label")
    )
      report(el, {
        code: "NB_MISSING_LABEL",
        severity: "error",
        message: `<${tag}> without a label: wrap it in <label>, point a <label for> at its id, or add aria-label.`,
      });

    // Headings.
    const h = /^h([1-6])$/.exec(tag);
    if (h) headings.push({ el, level: Number(h[1]) });

    // Contrast between colour utilities, for elements with their own text.
    const ownText = children(el).some(
      (n) => n.nodeName === "#text" && (n as DefaultTreeAdapterMap["textNode"]).value.trim(),
    );
    if (ownText && attr(el, "aria-hidden") !== "true") {
      const chain = [el, ...[...ancestors].reverse()];
      /** The nearest utility setting this side, stopping at components (they set their own colours). */
      const nearest = (side: "fg" | "bg") => {
        for (const node of chain) {
          const cs = classesOf(node);
          const hit = cs.find((c) => colours.get(c)?.[side]);
          if (hit) return { cls: hit, value: colours.get(hit)?.[side] as Colours };
          if (cs.some((c) => componentClasses.has(c) && c.startsWith("nb-"))) return null;
        }
        return undefined;
      };
      const fg = nearest("fg");
      const bg = nearest("bg");
      if (fg !== null && bg !== null && (fg || bg)) {
        const fgValue = fg?.value ?? fromToken(DEFAULT_TEXT);
        const bgValue = bg?.value ?? fromToken(DEFAULT_SURFACE);
        const key = `${fg?.cls ?? "text"}|${bg?.cls ?? "surface"}`;
        if (fgValue && bgValue && !contrastSeen.has(key)) {
          contrastSeen.add(key);
          const low = THEMES.map((t) => ({
            t,
            ratio: wcagContrast(fgValue[t], bgValue[t]),
          })).filter((x) => x.ratio < minimum);
          if (low.length)
            report(el, {
              code: "NB_CONTRAST_FAIL",
              severity: "warning",
              message: `${fg ? `.${fg.cls}` : "Body text"} on ${bg ? `.${bg.cls}` : "the page surface"} is ${low
                .map((x) => `${x.ratio.toFixed(2)}:1 in ${x.t}`)
                .join(" and ")}; WCAG ${level} needs ${minimum}:1 for body text.`,
              ...(fg ? { class: fg.cls } : bg ? { class: bg.cls } : {}),
            });
        }
      }
    }
  }

  // Headings: one h1, no skipped levels.
  const h1s = headings.filter((h) => h.level === 1);
  for (const h of h1s.slice(1))
    report(h.el, {
      code: "NB_HEADING_ORDER",
      severity: "warning",
      message: `More than one h1 (${h1s.length}); a page should have one main heading.`,
    });
  headings.forEach((h, i) => {
    const prev = headings[i - 1];
    if (prev && h.level > prev.level + 1)
      report(h.el, {
        code: "NB_HEADING_ORDER",
        severity: "warning",
        message: `h${h.level} follows h${prev.level}: heading levels should not skip (use h${prev.level + 1}).`,
      });
  });

  if (isDocument) {
    const root = elements.find(({ el }) => el.tagName === "html")?.el;
    if (root && !attr(root, "lang")?.trim())
      report(root, {
        code: "NB_MISSING_LANG",
        severity: "warning",
        message: 'The document has no language: add <html lang="en"> (or the page\'s language).',
      });
  }

  const diagnostics = found.sort((a, b) => a.line - b.line || a.col - b.col).map((x) => x.d);
  const errors = diagnostics.filter((d) => d.severity === "error").length;
  const warnings = diagnostics.filter((d) => d.severity === "warning").length;
  return { valid: errors === 0, diagnostics, summary: { errors, warnings } };
}
