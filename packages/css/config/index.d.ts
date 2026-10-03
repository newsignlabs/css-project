/**
 * newBrush configuration (specs/001-core-framework contracts/config.schema.json).
 * Kept dependency-free; test/config.types.ts fails typecheck if it drifts from @newbrush/schema.
 */
export interface NewBrushConfig {
  /** Class prefixes. Defaults: components "nb-", utilities "" (FR-009). */
  prefix?: { components?: string; utilities?: string };
  /** Globs scanned for class names. */
  content: string[];
  theme?: {
    /** Partial DTCG token tree merged into the defaults. */
    extend?: Record<string, unknown>;
    seeds?: { brand?: string; accent?: string; neutral?: string };
  };
  themes?: Array<{
    name: string;
    colorScheme: "light" | "dark";
    extends?: string;
    overrides?: Record<string, string>;
  }>;
  darkMode?: "media" | "attribute" | "both";
  /** How dark:/light:/contrast: resolve the nearest theme; "auto" picks from browserslist. */
  themeVariants?: "auto" | "style-query" | "selector";
  components?: "all" | false | string[];
  utilities?: "all" | false | string[];
  safelist?: string[];
  blocklist?: string[];
  contrast?: { level?: "AA" | "AAA"; onFail?: "error" | "warn" | "fix" };
  output?: { minify?: boolean; sourcemap?: boolean; layers?: boolean };
}

export declare function defineConfig(config: NewBrushConfig): NewBrushConfig;
