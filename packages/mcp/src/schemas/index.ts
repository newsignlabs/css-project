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

/**
 * A brand palette from seed colours, and the colour scheme for build_page ("both", the default, follows the visitor's
 * system). Named themes and themeId arrive with create_theme (specs/003 Phase 5).
 */
export const ThemeRef = z
  .object({
    seeds: z
      .object({ brand: color.optional(), accent: color.optional(), neutral: color.optional() })
      .strict()
      .optional(),
    colorScheme: z.enum(["light", "dark", "both"]).optional(),
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

export const SEARCH_KINDS = ["component", "utility", "token", "style", "section", "doc"] as const;
export const searchInput = {
  query: z.string().min(1).max(200).describe('What you are looking for, e.g. "pricing table", "dark mode", "cyberpunk"'),
  kinds: z
    .array(z.enum(SEARCH_KINDS))
    .optional()
    .describe("Only these kinds (sections and docs arrive with later releases)"),
  limit: z.number().int().min(1).max(25).optional().describe("Default 10, at most 25"),
};
export const SearchInput = z.object(searchInput).strict();
export type SearchInput = z.infer<typeof SearchInput>;
export const searchOutput = {
  results: z.array(
    z.object({
      kind: z.enum(SEARCH_KINDS),
      name: z.string(),
      title: z.string(),
      description: z.string(),
      uri: z.string().describe("newbrush:// resource with the full entry"),
      score: z.number(),
      example: z.string().optional(),
    }),
  ),
};
export const SearchOutput = z.object(searchOutput);
export type SearchOutput = z.infer<typeof SearchOutput>;

export const getComponentInput = {
  name: z.string().min(1).describe("Component name, e.g. button, card, modal"),
};
export const GetComponentInput = z.object(getComponentInput).strict();
export type GetComponentInput = z.infer<typeof GetComponentInput>;
/** The manifest Component (specs/001 data model): anatomy, modifiers, sizes, states, a11y, tokens, examples. */
export const getComponentOutput = {
  name: z.string(),
  title: z.string(),
  description: z.string(),
  className: z.string(),
  category: z.string(),
  anatomy: z.array(
    z.object({
      part: z.string(),
      className: z.string(),
      element: z.string().optional(),
      required: z.boolean(),
      requiredParent: z.string().optional(),
    }),
  ),
  modifiers: z.array(z.object({ name: z.string(), className: z.string(), description: z.string() })),
  sizes: z.array(z.string()),
  states: z.array(z.string()),
  html: z.object({ element: z.string(), attributes: z.record(z.string(), z.string()).optional() }),
  a11y: z.object({
    role: z.string().optional(),
    requirements: z.array(z.string()),
    keyboard: z.array(z.string()).optional(),
  }),
  tokens: z.array(z.string()),
  examples: z.array(z.object({ title: z.string(), html: z.string() })),
  status: z.string(),
  since: z.string(),
};
export const GetComponentOutput = z.object(getComponentOutput);
export type GetComponentOutput = z.infer<typeof GetComponentOutput>;

export const getTokensInput = {
  group: z.string().optional().describe('Token group, e.g. "color.text", "color.surface", "space", "radius"'),
  theme: z.string().optional().describe('Values for this theme: "light" (default), "dark" or "contrast"'),
  format: z.enum(["json", "css"]).optional().describe('"css" also returns a CSS block declaring the tokens'),
};
export const GetTokensInput = z.object(getTokensInput).strict();
export type GetTokensInput = z.infer<typeof GetTokensInput>;
export const getTokensOutput = {
  tokens: z.array(
    z.object({
      path: z.string(),
      cssVar: z.string(),
      type: z.string(),
      value: z.string(),
      description: z.string().optional(),
    }),
  ),
  css: z.string().optional(),
};
export const GetTokensOutput = z.object(getTokensOutput);
export type GetTokensOutput = z.infer<typeof GetTokensOutput>;

export const STYLE_NAMES = ["cyber", "g-morph", "minimal", "n-morph", "neon", "pixelate"] as const;

export const buildPageInput = {
  title: z.string().min(1).max(120).describe("The page title (<title>)"),
  lang: z
    .string()
    .regex(/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/)
    .optional()
    .describe('Language tag, default "en"'),
  dir: z.enum(["ltr", "rtl"]).optional(),
  description: z.string().max(300).optional().describe("Meta description"),
  theme: ThemeRef.optional(),
  style: z.enum(STYLE_NAMES).optional().describe("Design style for the whole page (specs/004)"),
  sections: z
    .array(
      z
        .object({
          type: z.string().describe("Blueprint name: see the newbrush://sections resources or search kinds [section]"),
          variant: z.string().optional(),
          props: z.record(z.string(), z.unknown()).optional(),
          slots: z.record(z.string(), z.unknown()).optional().describe("Merged over props"),
        })
        .strict(),
    )
    .min(1)
    .max(30),
  output: z.enum(["document", "fragments"]).optional().describe('"fragments" returns body HTML and CSS separately'),
};
export const BuildPageInput = z.object(buildPageInput).strict();
export type BuildPageInput = z.infer<typeof BuildPageInput>;
export const buildPageOutput = {
  html: z.string(),
  css: z.string(),
  sections: z.array(z.object({ type: z.string(), id: z.string() })),
  stats: z.object({ cssBytes: z.number().int(), htmlBytes: z.number().int() }),
  diagnostics: z.array(Diagnostic),
};
export const BuildPageOutput = z.object(buildPageOutput);
export type BuildPageOutput = z.infer<typeof BuildPageOutput>;

const SlotValue = z.union([
  z.string().max(5000),
  z.object({ href: z.string().max(2048), text: z.string().max(200) }).strict(),
  z.object({ src: z.string().max(2048), alt: z.string().max(300) }).strict(),
]);
export const composeComponentInput = {
  name: z.string().min(1).describe("Component name, e.g. card, button, alert"),
  modifiers: z.array(z.string()).max(10).optional().describe('Modifier names or classes, e.g. "elevated"'),
  size: z.string().optional().describe("sm, md or lg where the component has sizes"),
  slots: z
    .record(z.string(), SlotValue)
    .optional()
    .describe('Content by part name (get_component lists parts); "content" fills the root. Text may use inline tags.'),
  attrs: z.record(z.string(), z.string().max(500)).optional().describe("Extra attributes on the root (aria-*, data-*, id…)"),
  withCss: z.boolean().optional().describe("Also return the CSS (core + this component)"),
};
export const ComposeComponentInput = z.object(composeComponentInput).strict();
export type ComposeComponentInput = z.infer<typeof ComposeComponentInput>;
export const composeComponentOutput = {
  html: z.string(),
  css: z.string().optional(),
  diagnostics: z.array(Diagnostic),
};
export const ComposeComponentOutput = z.object(composeComponentOutput);
export type ComposeComponentOutput = z.infer<typeof ComposeComponentOutput>;

/** Every tool's schemas, for the JSON Schema export and the drift test. */
export const TOOL_SCHEMAS = {
  generate_css: { input: GenerateCssInput, output: GenerateCssOutput },
  explain_class: { input: ExplainClassInput, output: ExplainClassOutput },
  search: { input: SearchInput, output: SearchOutput },
  get_component: { input: GetComponentInput, output: GetComponentOutput },
  get_tokens: { input: GetTokensInput, output: GetTokensOutput },
  build_page: { input: BuildPageInput, output: BuildPageOutput },
  compose_component: { input: ComposeComponentInput, output: ComposeComponentOutput },
} as const;
