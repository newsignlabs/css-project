// specs/003 T002 — zod schemas for tool inputs and outputs: the single source for the MCP `inputSchema`/`outputSchema`
// and for the JSON Schema files in specs/003-mcp-css-tool/contracts/schemas/ (scripts/export-schemas.ts).
import { z } from "zod";

export const LIMITS = { htmlBytes: 256 * 1024, classes: 5000, explain: 50 } as const;

export const Diagnostic = z.object({
  code: z.string().describe("Stable error code, e.g. NB_ARBITRARY_REJECTED"),
  severity: z.enum(["error", "warning", "info"]),
  message: z.string(),
  class: z.string().optional(),
  path: z.string().optional(),
  suggestion: z.string().optional(),
});
export type Diagnostic = z.infer<typeof Diagnostic>;

const color = z.string().min(1).max(100).describe("Any CSS colour, e.g. oklch(62% 0.19 255) or #2563eb");

/** A brand palette from seed colours. (Named themes and themeId arrive with create_theme, specs/003 Phase 5.) */
export const ThemeRef = z
  .object({
    seeds: z
      .object({ brand: color.optional(), accent: color.optional(), neutral: color.optional() })
      .strict(),
  })
  .strict();

export const generateCssInput = {
  classes: z
    .array(z.string())
    .optional()
    .describe(`Class names to generate CSS for (up to ${LIMITS.classes}). Give this or html.`),
  html: z
    .string()
    .optional()
    .describe(`HTML to scan for class attributes (up to ${LIMITS.htmlBytes / 1024} KB). Give this or classes.`),
  theme: ThemeRef.optional().describe("Brand seed colours; adds the derived token CSS"),
  include: z
    .object({
      preflight: z.boolean().optional().describe("Prepend newBrush core: reset, tokens, themes, base, layout"),
      components: z
        .boolean()
        .optional()
        .describe("Prepend the full newBrush stylesheet: core, components and design styles"),
    })
    .strict()
    .optional(),
};
export const GenerateCssInput = z.object(generateCssInput).strict();
export type GenerateCssInput = z.infer<typeof GenerateCssInput>;

export const generateCssOutput = {
  css: z.string(),
  used: z.array(z.string()).describe("Utility classes that produced CSS"),
  rejected: z.array(Diagnostic).describe("Classes that look like utilities but are invalid"),
  unknown: z
    .array(z.object({ class: z.string(), suggestions: z.array(z.string()) }))
    .describe("Classes newBrush does not know (component and style classes are not listed)"),
  stats: z.object({ bytes: z.number().int(), rules: z.number().int() }),
};
export const GenerateCssOutput = z.object(generateCssOutput);
export type GenerateCssOutput = z.infer<typeof GenerateCssOutput>;

export const explainClassInput = {
  classes: z.array(z.string()).min(1).describe(`Utility classes to explain (up to ${LIMITS.explain})`),
};
export const ExplainClassInput = z.object(explainClassInput).strict();
export type ExplainClassInput = z.infer<typeof ExplainClassInput>;

export const Explained = z.object({
  class: z.string(),
  parsed: z
    .object({
      raw: z.string(),
      variants: z.array(z.string()),
      negative: z.boolean(),
      utility: z.string(),
      value: z.string().optional(),
      arbitrary: z.string().optional(),
      modifier: z.string().optional(),
      important: z.boolean(),
    })
    .describe("The class split into variants, utility, value and modifiers"),
  family: z.string().describe("The utility family, e.g. padding"),
  css: z.string(),
  docs: z.string().describe("Documentation URL"),
});
export const explainClassOutput = { results: z.array(z.union([Explained, Diagnostic])) };
export const ExplainClassOutput = z.object(explainClassOutput);
export type ExplainClassOutput = z.infer<typeof ExplainClassOutput>;

/** Every tool's schemas, for the JSON Schema export and the drift test. */
export const TOOL_SCHEMAS = {
  generate_css: { input: GenerateCssInput, output: GenerateCssOutput },
  explain_class: { input: ExplainClassInput, output: ExplainClassOutput },
} as const;
