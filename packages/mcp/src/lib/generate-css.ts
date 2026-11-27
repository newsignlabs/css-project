// specs/003 T006 — generate_css: class names or HTML in, newBrush utility CSS out, with diagnostics.
import { createEngine } from "@newbrush/engine";
import core from "newbrush/core.css";
import components from "newbrush/css";
import {
  type GenerateCssInput,
  type GenerateCssOutput,
  GenerateCssInput as InputSchema,
  LIMITS,
} from "../schemas/index.ts";
import { resolveTheme } from "./create-theme.ts";
import { fail } from "./errors.ts";
import { componentClasses, suggest } from "./suggest.ts";
import { defaultThemes, type ThemeStore } from "./theme-store.ts";

// Class attributes only (class and JSX className): scanning text would turn ordinary words into utilities.
const CLASS_ATTR =
  /\s(?:class|className)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*["'`]([^"'`]*)["'`]\s*\})/g;

/** The classes in an HTML string's class attributes, in order of first use. */
export function classesInHtml(html: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(CLASS_ATTR))
    for (const c of (m[1] ?? m[2] ?? m[3] ?? "").split(/\s+/)) if (c) out.add(c);
  return [...out];
}

export function generateCss(
  input: GenerateCssInput,
  themes: ThemeStore = defaultThemes,
): GenerateCssOutput {
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success)
    fail("NB_SCHEMA_INVALID", parsed.error.issues.map((i) => i.message).join("; "));
  const { classes, html, theme, include } = parsed.data as GenerateCssInput;
  if (classes === undefined && html === undefined)
    fail("NB_SCHEMA_INVALID", "Give classes or html.", { path: "classes" });
  if (html !== undefined && new TextEncoder().encode(html).length > LIMITS.htmlBytes)
    fail("NB_INPUT_TOO_LARGE", `html is larger than ${LIMITS.htmlBytes / 1024} KB.`, {
      path: "html",
    });
  if (classes !== undefined && classes.length > LIMITS.classes)
    fail("NB_INPUT_TOO_LARGE", `More than ${LIMITS.classes} classes.`, { path: "classes" });

  const candidates = [...new Set([...(classes ?? []), ...(html ? classesInHtml(html) : [])])];
  const resolved = resolveTheme(theme, themes);
  const engine = createEngine({
    content: ["mcp"],
    ...(resolved.seeds ? { theme: { seeds: resolved.seeds } } : {}),
  });
  const result = engine.generate(candidates, { reportUnknown: true });
  const prefix = include?.components ? components : include?.preflight ? core : "";
  const css = [prefix, resolved.css ?? engine.themeCss, result.css].filter(Boolean).join("\n");
  return {
    css,
    used: result.classes.used,
    rejected: result.classes.rejected.map((d) => ({ ...d })),
    unknown: result.classes.unknown
      .filter((c) => !componentClasses.has(c))
      .map((c) => ({ class: c, suggestions: suggest(c) })),
    stats: {
      bytes: new TextEncoder().encode(css).length,
      rules: (result.css.match(/\{/g) ?? []).length,
    },
  };
}
