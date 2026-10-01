/**
 * Shared data model for newBrush (specs/001-core-framework/data-model.md).
 * zod schemas are the single source: TypeScript types are inferred and JSON Schemas are exported from them.
 */
import { z } from "zod";

const kebab = /^[a-z][a-z0-9-]*$/;

// ── Tokens ──────────────────────────────────────────────────────────────────

export const TokenTier = z.enum(["primitive", "semantic", "component"]);
export const TokenType = z.enum([
  "color",
  "dimension",
  "fontFamily",
  "fontWeight",
  "duration",
  "cubicBezier",
  "number",
  "shadow",
  "typography",
  "strokeStyle",
  "other",
]);

export const ResolvedToken = z.object({
  path: z.array(z.string()).min(1),
  name: z.string().describe("Dot path, e.g. color.surface.default"),
  cssVar: z.string().regex(/^--nb-[a-z0-9-]+$/),
  tier: TokenTier,
  type: TokenType,
  value: z.string().describe("Resolved value for the default (light) theme"),
  themes: z
    .record(z.string(), z.string())
    .default({})
    .describe("Per-theme overrides, keyed by theme name"),
  references: z.array(z.string()).default([]).describe("Token names this token aliases"),
  description: z.string().optional(),
});

// ── Themes & variants ───────────────────────────────────────────────────────

export const Theme = z.object({
  name: z.string().regex(kebab),
  colorScheme: z.enum(["light", "dark"]),
  extends: z.string().optional(),
  overrides: z.record(z.string(), z.string()).default({}),
});

export const Variant = z.object({
  name: z.string(),
  kind: z.enum(["media", "container", "selector", "at-rule", "parent-selector"]),
  template: z.string(),
  order: z.number().int(),
  composable: z.boolean(),
});

// ── Utilities ───────────────────────────────────────────────────────────────

export const UtilityFamily = z.object({
  name: z.string(),
  patterns: z.array(z.string()).min(1),
  properties: z.array(z.string()).min(1),
  values: z.union([
    z.object({ source: z.literal("token"), group: z.string() }),
    z.object({ source: z.literal("static"), map: z.record(z.string(), z.string()) }),
  ]),
  arbitrary: z
    .object({
      grammar: z.enum([
        "length",
        "color",
        "percentage",
        "number",
        "time",
        "image-safe",
        "grid-template",
      ]),
    })
    .optional(),
  negative: z.boolean().optional(),
  modifiers: z
    .object({ opacity: z.boolean().optional(), lineHeight: z.boolean().optional() })
    .optional(),
  variants: z.union([z.literal("all"), z.array(z.string())]),
  category: z.enum([
    "layout",
    "spacing",
    "sizing",
    "typography",
    "color",
    "border",
    "effects",
    "motion",
    "interactivity",
    "a11y",
  ]),
  description: z.string(),
});

export const ParsedClass = z.object({
  raw: z.string(),
  variants: z.array(z.string()),
  negative: z.boolean(),
  utility: z.string(),
  value: z.string().optional(),
  arbitrary: z.string().optional(),
  modifier: z.string().optional(),
  important: z.boolean(),
});

// ── Components ──────────────────────────────────────────────────────────────

export const ComponentCategory = z.enum([
  "layout",
  "content",
  "actions",
  "forms",
  "navigation",
  "feedback",
  "overlay",
  "data",
  "marketing",
]);

export const Component = z.object({
  name: z.string().regex(kebab),
  title: z.string(),
  description: z.string(),
  className: z.string().regex(/^nb-[a-z0-9-]+$/),
  category: ComponentCategory,
  anatomy: z.array(
    z.object({
      part: z.string(),
      className: z.string(),
      element: z.string().optional(),
      required: z.boolean(),
      requiredParent: z
        .string()
        .optional()
        .describe("Class of the part this element must be nested in"),
    }),
  ),
  modifiers: z.array(
    z.object({ name: z.string(), className: z.string(), description: z.string() }),
  ),
  sizes: z.array(z.string()),
  states: z.array(z.string()),
  html: z.object({ element: z.string(), attributes: z.record(z.string(), z.string()).optional() }),
  a11y: z.object({
    role: z.string().optional(),
    requirements: z.array(z.string()).min(1),
    keyboard: z.array(z.string()).optional(),
  }),
  tokens: z.array(z.string()),
  examples: z.array(z.object({ title: z.string(), html: z.string().min(1) })).min(1),
  status: z.enum(["stable", "beta", "deprecated"]),
  since: z.string().regex(/^\d+\.\d+\.\d+/),
});

// ── Config ──────────────────────────────────────────────────────────────────

const selection = z.union([z.literal("all"), z.literal(false), z.array(z.string())]);

export const Config = z
  .object({
    prefix: z
      .object({
        components: z
          .string()
          .regex(/^[a-z][a-z0-9-]*-?$/)
          .default("nb-"),
        utilities: z
          .string()
          .regex(/^([a-z][a-z0-9-]*-?)?$/)
          .default(""),
      })
      .strict()
      .optional(),
    content: z.array(z.string()).min(1),
    theme: z
      .object({
        extend: z
          .record(z.string(), z.unknown())
          .optional()
          .describe("Partial DTCG token tree merged into defaults"),
        seeds: z
          .object({
            brand: z.string().optional(),
            accent: z.string().optional(),
            neutral: z.string().optional(),
          })
          .strict()
          .optional(),
      })
      .optional(),
    themes: z.array(Theme).optional(),
    darkMode: z.enum(["media", "attribute", "both"]).default("both"),
    themeVariants: z
      .enum(["auto", "style-query", "selector"])
      .default("auto")
      .describe("How dark:/light:/contrast: variants resolve the nearest theme"),
    components: selection.default("all"),
    utilities: selection.default("all"),
    safelist: z.array(z.string()).optional(),
    blocklist: z.array(z.string()).optional(),
    contrast: z
      .object({
        level: z.enum(["AA", "AAA"]).default("AA"),
        onFail: z.enum(["error", "warn", "fix"]).default("warn"),
      })
      .optional(),
    output: z
      .object({
        minify: z.boolean().default(true),
        sourcemap: z.boolean().default(false),
        layers: z.boolean().default(true),
      })
      .optional(),
  })
  .strict();

// ── Manifest ────────────────────────────────────────────────────────────────

export const LAYERS = [
  "nb.reset",
  "nb.tokens",
  "nb.base",
  "nb.layout",
  "nb.components",
  "nb.utilities",
] as const;

export const Manifest = z.object({
  name: z.literal("newbrush"),
  version: z.string(),
  schemaVersion: z.literal(1),
  layers: z.array(z.string()),
  tokens: z.array(ResolvedToken),
  themes: z.array(Theme),
  variants: z.array(Variant),
  utilities: z.array(UtilityFamily),
  components: z.array(Component),
});

export type TokenTier = z.infer<typeof TokenTier>;
export type TokenType = z.infer<typeof TokenType>;
export type ResolvedToken = z.infer<typeof ResolvedToken>;
export type Theme = z.infer<typeof Theme>;
export type Variant = z.infer<typeof Variant>;
export type UtilityFamily = z.infer<typeof UtilityFamily>;
export type ParsedClass = z.infer<typeof ParsedClass>;
export type Component = z.infer<typeof Component>;
export type Config = z.input<typeof Config>;
export type ResolvedConfig = z.output<typeof Config>;
export type Manifest = z.infer<typeof Manifest>;

/** Identity helper giving editors autocompletion for `newbrush.config.ts`. */
export function defineConfig(config: Config): Config {
  return config;
}

/** JSON Schemas exported to `schemas/*.json` by the build. */
export const jsonSchemas = {
  "config.v1.json": Config,
  "manifest.v1.json": Manifest,
  "component.v1.json": Component,
  "token.v1.json": ResolvedToken,
} as const;
