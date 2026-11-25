// specs/003 T023 — compose_component: one component's markup from its manifest anatomy. Text is sanitized (inline tags
// only), URLs go through the allow-list, attributes through an allow-list; anything unknown is dropped with a diagnostic.
import { COMPONENT_CSS, CORE_CSS } from "../assets.ts";
import { escapeHtml, safeUrl, sanitizeInline } from "../html/index.ts";
import { manifest } from "../manifest.ts";
import {
  ComposeComponentInput,
  type ComposeComponentOutput,
  type Diagnostic,
} from "../schemas/index.ts";
import { fail } from "./errors.ts";
import { COMPONENT_NAMES } from "./get-component.ts";
import { nearest } from "./suggest.ts";
import { parseInput } from "./validate.ts";

const VOID = new Set(["img", "input", "br", "hr", "meta", "link"]);
const ATTRIBUTE =
  /^(aria-[a-z]+|data-[a-z0-9-]+|id|role|title|type|name|value|placeholder|for|href|target|rel|disabled|checked|required|readonly|open|lang|dir|tabindex|min|max|step|autocomplete)$/;

type Slot = NonNullable<ComposeComponentInput["slots"]>[string];

export function composeComponent(input: ComposeComponentInput): ComposeComponentOutput {
  const spec = parseInput(ComposeComponentInput, input);
  const key = spec.name.trim().toLowerCase().replace(/^nb-/, "");
  const c = manifest.components.find((x) => x.name === key);
  if (!c) {
    const close = nearest(key, COMPONENT_NAMES);
    fail(
      "NB_UNKNOWN_COMPONENT",
      `No component "${spec.name}".${close.length ? ` Did you mean ${close.join(", ")}?` : ""}`,
      {
        ...(close[0] ? { suggestion: close[0] } : {}),
      },
    );
  }
  const component = c as NonNullable<typeof c>;
  const diagnostics: Diagnostic[] = [];
  const warn = (code: string, message: string, path: string) =>
    diagnostics.push({ code, severity: "warning", message, path });

  const classes = [component.className];
  for (const m of spec.modifiers ?? []) {
    const mod = component.modifiers.find((x) => x.name === m || x.className === m);
    if (mod) classes.push(mod.className);
    else
      warn(
        "NB_ANATOMY_INVALID",
        `"${m}" is not a ${component.name} modifier (${component.modifiers.map((x) => x.name).join(", ") || "none"}).`,
        "modifiers",
      );
  }
  if (spec.size) {
    if (component.sizes.includes(spec.size)) classes.push(`${component.className}--${spec.size}`);
    else
      warn(
        "NB_ANATOMY_INVALID",
        `${component.name} has no size "${spec.size}" (${component.sizes.join(", ") || "none"}).`,
        "size",
      );
  }

  const attrs: string[] = [`class="${escapeHtml(classes.join(" "))}"`];
  for (const [name, value] of Object.entries({ ...component.html.attributes, ...spec.attrs })) {
    const n = name.toLowerCase();
    if (!ATTRIBUTE.test(n) || n === "class") {
      warn(
        "NB_ANATOMY_INVALID",
        `Attribute "${name}" is not allowed and was dropped.`,
        `attrs.${name}`,
      );
      continue;
    }
    const v = n === "href" ? (safeUrl(value) ?? "#") : value;
    if (n === "href" && v !== value)
      warn("NB_UNSAFE_URL", `Unsafe URL replaced with "#".`, "attrs.href");
    attrs.push(`${n}="${escapeHtml(v)}"`);
  }

  const parts = component.anatomy.filter((a) => a.part !== "root");
  const partNames = parts.map((p) => p.part);
  const slots = { ...spec.slots };
  for (const name of Object.keys(slots))
    if (name !== "content" && !partNames.includes(name)) {
      const close = nearest(name, partNames);
      warn(
        "NB_ANATOMY_INVALID",
        `${component.name} has no part "${name}"${close.length ? ` (did you mean ${close.join(", ")}?)` : ""}. Parts: ${partNames.join(", ") || "none"}.`,
        `slots.${name}`,
      );
      delete slots[name];
    }

  const render = (element: string, cls: string, value: Slot | undefined, inner = ""): string => {
    const tag = element || "div";
    if (value && typeof value === "object" && "src" in value) {
      const src = safeUrl(value.src) ?? "#";
      return `<img class="${cls}" src="${escapeHtml(src)}" alt="${escapeHtml(value.alt)}">`;
    }
    if (value && typeof value === "object" && "href" in value) {
      const target = safeUrl(value.href) ?? "#";
      return `<a class="${cls}" href="${escapeHtml(target)}">${escapeHtml(value.text)}</a>`;
    }
    if (VOID.has(tag)) return `<${tag} class="${cls}">`;
    const text = typeof value === "string" ? sanitizeInline(value).value : "";
    return `<${tag} class="${cls}">${text}${inner}</${tag}>`;
  };

  // Parts nested in another part (requiredParent) are written inside it, in anatomy order.
  const children = (parent: string): string =>
    parts
      .filter((p) => (p.requiredParent ?? component.className) === parent)
      .map((p) => {
        const nested = children(p.className);
        if (slots[p.part] === undefined && !nested) return "";
        return render(p.element ?? "div", p.className, slots[p.part], nested);
      })
      .filter(Boolean)
      .join("\n  ");

  for (const p of parts)
    if (
      p.required &&
      slots[p.part] === undefined &&
      !parts.some((x) => x.requiredParent === p.className && slots[x.part] !== undefined)
    )
      diagnostics.push({
        code: "NB_ANATOMY_INVALID",
        severity: "info",
        message: `Required part "${p.part}" (.${p.className}) is empty.`,
        path: `slots.${p.part}`,
      });

  const root = component.html.element;
  const content = typeof slots.content === "string" ? sanitizeInline(slots.content).value : "";
  const inner = [content, children(component.className)].filter(Boolean).join("\n  ");
  const markup = VOID.has(root)
    ? `<${root} ${attrs.join(" ")}>`
    : `<${root} ${attrs.join(" ")}>${inner.includes("\n") || inner.startsWith("<") ? `\n  ${inner}\n` : inner}</${root}>`;
  if (component.name === "button" && !content && !spec.attrs?.["aria-label"])
    diagnostics.push({
      code: "NB_ANATOMY_INVALID",
      severity: "warning",
      message: 'A button needs text ("content" slot) or an aria-label.',
      path: "slots.content",
    });

  return {
    html: markup,
    ...(spec.withCss
      ? { css: [CORE_CSS, COMPONENT_CSS[component.name] ?? ""].filter(Boolean).join("\n") }
      : {}),
    diagnostics,
  };
}
