// specs/003 T024 — build_page: a PageSpec (title, theme, sections) → a complete, accessible HTML document (or
// fragments) with the minimal CSS it needs. Pipeline (plan.md): validate → blueprints → classes → CSS → document.
import { escapeHtml, html, raw } from "../blueprints/_core.ts";
import { BLUEPRINT_NAMES, BLUEPRINTS } from "../blueprints/index.ts";
import type { SafeHtml } from "../html/index.ts";
import { BuildPageInput, type BuildPageOutput, type Diagnostic } from "../schemas/index.ts";
import { resolveTheme } from "./create-theme.ts";
import { cssFor } from "./css-bundle.ts";
import { fail } from "./errors.ts";
import { nearest } from "./suggest.ts";
import { defaultThemes, type ThemeStore } from "./theme-store.ts";
import { parseInput } from "./validate.ts";

const bytes = (s: string) => new TextEncoder().encode(s).length;

export function buildPage(
  input: BuildPageInput,
  themes: ThemeStore = defaultThemes,
): BuildPageOutput {
  const spec = parseInput(BuildPageInput, input);
  const theme = resolveTheme(spec.theme, themes);
  const diagnostics: Diagnostic[] = [];
  const counts = new Map<string, number>();
  const regions = { header: [] as SafeHtml[], main: [] as SafeHtml[], footer: [] as SafeHtml[] };
  const sections: { type: string; id: string }[] = [];
  let h1Given = false;

  spec.sections.forEach((section, i) => {
    const path = `sections[${i}]`;
    const blueprint = BLUEPRINTS.get(section.type);
    if (!blueprint) {
      const close = nearest(section.type, BLUEPRINT_NAMES);
      fail(
        "NB_UNKNOWN_SECTION",
        `Unknown section "${section.type}".${close.length ? ` Did you mean ${close.join(", ")}?` : ""} Sections: ${BLUEPRINT_NAMES.join(", ")}.`,
        { path: `${path}.type`, ...(close[0] ? { suggestion: close[0] } : {}) },
      );
      return;
    }
    const variant = section.variant ?? blueprint.variants[0] ?? "default";
    if (!blueprint.variants.includes(variant))
      fail(
        "NB_SCHEMA_INVALID",
        `Section "${section.type}" has no variant "${variant}". Variants: ${blueprint.variants.join(", ")}.`,
        {
          path: `${path}.variant`,
        },
      );
    const parsed = blueprint.props.safeParse({ ...section.props, ...section.slots });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      fail(
        "NB_SCHEMA_INVALID",
        `${section.type}: ${parsed.error.issues.map((x) => `${x.path.join(".") || "props"}: ${x.message}`).join("; ")}`,
        { path: `${path}.props${issue?.path.length ? `.${issue.path.join(".")}` : ""}` },
      );
      return;
    }
    const n = (counts.get(section.type) ?? 0) + 1;
    counts.set(section.type, n);
    const id = n === 1 ? section.type : `${section.type}-${n}`;
    const level = !h1Given && blueprint.titled(parsed.data) ? 1 : 2;
    if (level === 1) h1Given = true;
    regions[blueprint.region].push(
      blueprint.render(parsed.data, variant, { id, level, path: `${path}.props`, diagnostics }),
    );
    sections.push({ type: section.type, id });
  });

  if (!h1Given)
    diagnostics.push({
      code: "NB_NO_H1",
      severity: "info",
      message:
        "No section has a heading, so the page has no h1. Add a hero or another titled section.",
      path: "sections",
    });

  const skip = regions.main.length
    ? html`<a class="sr-only focus:not-sr-only" href="#main">Skip to content</a>\n`
    : raw("");
  const body = html`${regions.header}
<main id="main">
${regions.main}
</main>
${regions.footer}`.value
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const { css, diagnostics: cssDiagnostics } = cssFor(body, {
    ...(theme.seeds ? { seeds: theme.seeds } : {}),
    ...(theme.css ? { themeCss: theme.css } : {}),
    ...(spec.style ? { style: spec.style } : {}),
  });
  diagnostics.push(...cssDiagnostics);

  if (spec.output === "fragments") {
    const fragment = spec.style ? `<div class="${spec.style}">\n${body}\n</div>` : body;
    return {
      html: fragment,
      css,
      sections,
      stats: { cssBytes: bytes(css), htmlBytes: bytes(fragment) },
      diagnostics,
    };
  }
  const scheme = theme.colorScheme;
  const themeAttr = scheme === "light" || scheme === "dark" ? ` data-nb-theme="${scheme}"` : "";
  const doc = `<!DOCTYPE html>
<html lang="${escapeHtml(spec.lang ?? "en")}" dir="${spec.dir ?? "ltr"}"${themeAttr}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(spec.title)}</title>
${spec.description ? `<meta name="description" content="${escapeHtml(spec.description)}">\n` : ""}${themeAttr ? "" : '<meta name="color-scheme" content="light dark">\n'}<style>
${css.replace(/<\/style/gi, "<\\/style")}
</style>
</head>
<body${spec.style ? ` class="${spec.style}"` : ""}>
${skip.value}${body}
</body>
</html>
`;
  return {
    html: doc,
    css,
    sections,
    stats: { cssBytes: bytes(css), htmlBytes: bytes(doc) },
    diagnostics,
  };
}
