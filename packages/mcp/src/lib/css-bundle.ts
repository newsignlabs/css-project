// Assembles the smallest CSS for some newBrush markup: core, the components it uses, a design style, brand seeds, and
// the utilities its class attributes name (specs/003 SC-004: a 6-section page stays under 15 KB brotli).
import { createEngine } from "@newbrush/engine";
import { COMPONENT_CSS, CORE_CSS, STYLE_CSS } from "../assets.ts";
import { manifest } from "../manifest.ts";
import type { Diagnostic } from "../schemas/index.ts";
import { classesInHtml } from "./generate-css.ts";
import { componentClasses } from "./suggest.ts";

/** Component class (root, part, modifier, size) → component name. */
const componentOf = new Map<string, string>();
for (const c of manifest.components)
  for (const cls of [
    c.className,
    ...c.anatomy.map((a) => a.className),
    ...c.modifiers.map((m) => m.className),
    ...c.sizes.map((s) => `${c.className}--${s}`),
  ])
    componentOf.set(cls, c.name);

export interface CssBundle {
  css: string;
  diagnostics: Diagnostic[];
}

export function cssFor(
  markup: string,
  options: { seeds?: Record<string, string>; themeCss?: string; style?: string } = {},
): CssBundle {
  const classes = classesInHtml(markup);
  const components = [
    ...new Set(classes.map((c) => componentOf.get(c)).filter((c): c is string => Boolean(c))),
  ].sort();
  const utilities = classes.filter((c) => !componentClasses.has(c));
  const engine = createEngine({
    content: ["mcp"],
    ...(options.seeds ? { theme: { seeds: options.seeds } } : {}),
  });
  const generated = engine.generate(utilities, { reportUnknown: true });
  const diagnostics: Diagnostic[] = [
    ...generated.classes.rejected.map((d) => ({ ...d })),
    ...generated.classes.unknown.map((c) => ({
      code: "NB_UNKNOWN_CLASS",
      severity: "warning" as const,
      message: `"${c}" is not a newBrush class; no CSS was generated for it.`,
      class: c,
    })),
  ];
  const css = [
    CORE_CSS,
    options.themeCss ?? engine.themeCss,
    ...[...new Set(components.map((c) => COMPONENT_CSS[c]).filter(Boolean))],
    options.style ? (STYLE_CSS[options.style] ?? "") : "",
    generated.css,
  ]
    .filter(Boolean)
    .join("\n");
  return { css, diagnostics };
}
