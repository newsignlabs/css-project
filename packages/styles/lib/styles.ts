/**
 * Design styles (specs/004-design-styles T006, T007). A style is a folder with `style.json` (metadata and DTCG token
 * overrides) and an optional `recipes.css` (scoped rules for what tokens cannot express). This module turns a style
 * into CSS and a manifest entry; build.ts runs it over src/ and custom styles will reuse it.
 *
 * Emitted shape (data-model.md):
 *   @layer nb.tokens { .g-morph, .nb-g-morph, .glass, [data-nb-style="g-morph"] { --nb-style: g-morph; …overrides } }
 *   @layer nb.styles { :where(.g-morph, …) .nb-card { … } }   ← recipes.css, `:--style` expanded
 * Overrides are plain inherited custom properties, so the nearest style ancestor wins (style islands), and
 * `.style-default` restores the default tokens for a subtree.
 */
import { Style, StyleSource } from "@newbrush/schema";

/** What the style build needs to know about one framework token. */
export interface TokenInfo {
  name: string;
  cssVar: string;
  /** Whether a theme other than light redefines it (then only a `-base` alias can restore it). */
  themed: boolean;
  /** Its declaration in tokens.css (the light/root block), e.g. `var(--nb-radius-lg)` or `0.5rem`. */
  declared: string;
  /** Whether tokens.css declares a `<cssVar>-base` alias (specs/004 T005). */
  hasBase: boolean;
}

/** Index of the framework's tokens from @newbrush/tokens `tokens.json` and `tokens.css`. */
export function tokenIndex(
  tokensJson: { tokens: { name: string; cssVar: string; themes?: Record<string, string> }[] },
  tokensCss: string,
): Map<string, TokenInfo> {
  const declared = new Map<string, string>();
  for (const m of tokensCss.matchAll(/^\s*(--nb-[a-z0-9-]+):\s*([^;]+);$/gm))
    if (m[1] && !declared.has(m[1])) declared.set(m[1], (m[2] ?? "").trim());
  return new Map(
    tokensJson.tokens.map((t) => [
      t.name,
      {
        name: t.name,
        cssVar: t.cssVar,
        themed: Object.keys(t.themes ?? {}).length > 0,
        declared: declared.get(t.cssVar) ?? "",
        hasBase: declared.has(`${t.cssVar}-base`),
      },
    ]),
  );
}

/** The class names that activate a style: bare (with the configured prefix), `nb-` and aliases. */
export function styleClasses(style: Pick<Style, "name" | "aliases">, prefix = ""): string[] {
  return [
    ...new Set([
      `${prefix}${style.name}`,
      `nb-${style.name}`,
      ...style.aliases.map((a) => `${prefix}${a}`),
    ]),
  ];
}

/** Selector list matching an element that applies the style (class, `nb-` class, alias or attribute). */
export function styleSelectors(style: Pick<Style, "name" | "aliases">, prefix = ""): string[] {
  return [...styleClasses(style, prefix).map((c) => `.${c}`), `[data-nb-style="${style.name}"]`];
}

/** `.style-default` (and its `nb-` and attribute forms): the default style for a subtree inside a styled page. */
export const RESET_NAME = "default";
export const resetSelectors = (prefix = "") => [
  ...new Set([`.${prefix}style-${RESET_NAME}`, `.nb-style-${RESET_NAME}`]),
  `[data-nb-style="${RESET_NAME}"]`,
];

export interface LoadedStyle {
  source: ReturnType<typeof StyleSource.parse>;
  /** Contents of recipes.css, if any. */
  recipes?: string;
  /** Contents of preview.html, if any. */
  preview?: string;
}

/** Validates a style.json (throws with the style's name and every problem). */
export function parseStyle(json: unknown, origin: string): LoadedStyle["source"] {
  const parsed = StyleSource.safeParse(json);
  if (!parsed.success) throw new Error(`Invalid style.json in ${origin}:\n${parsed.error.message}`);
  if (parsed.data.name === RESET_NAME || parsed.data.aliases.includes(RESET_NAME))
    throw new Error(`${origin}: "${RESET_NAME}" is reserved for the default style`);
  if (parsed.data.aliases.some((a) => a.startsWith("nb-")))
    throw new Error(`${origin}: aliases must not start with "nb-" (the nb- form is generated)`);
  if (Object.keys(parsed.data.schemes).length)
    throw new Error(`${origin}: per-scheme overrides ("schemes") are not supported yet`);
  return parsed.data;
}

/** Names and aliases must be unique across all styles. */
export function checkUnique(styles: Pick<Style, "name" | "aliases">[]): void {
  const seen = new Map<string, string>();
  for (const s of styles)
    for (const n of [s.name, ...s.aliases]) {
      const other = seen.get(n);
      if (other) throw new Error(`Style name "${n}" is used by both ${other} and ${s.name}`);
      seen.set(n, s.name);
    }
}

/** DTCG override tree → `[path, $value]` pairs in source order. */
export function flattenTokens(
  tree: Record<string, unknown>,
  prefix: string[] = [],
): [string, unknown][] {
  return Object.entries(tree).flatMap(([key, node]): [string, unknown][] => {
    if (key.startsWith("$")) return [];
    const path = [...prefix, key];
    if (node && typeof node === "object" && "$value" in node)
      return [[path.join("."), (node as { $value: unknown }).$value]];
    if (node && typeof node === "object" && !Array.isArray(node))
      return flattenTokens(node as Record<string, unknown>, path);
    throw new Error(`Token override ${path.join(".")} must be a group or { "$value": … }`);
  });
}

const lookup = (tokens: Map<string, TokenInfo>, name: string): TokenInfo | undefined =>
  tokens.get(name) ?? tokens.get(`${name}.default`);

export interface Override {
  path: string;
  cssVar: string;
  value: string;
}

/**
 * Resolves a style's overrides to CSS values. `{a.b}` references become `var(--nb-a-b)`; a reference to a token the
 * same style overrides becomes its `-base` alias (`var(--nb-a-b-base)`), since `--nb-a-b` would refer to itself.
 */
export function resolveOverrides(
  source: LoadedStyle["source"],
  tokens: Map<string, TokenInfo>,
): Override[] {
  const pairs = flattenTokens(source.tokens);
  const overridden = new Set(pairs.map(([path]) => lookup(tokens, path)?.name ?? path));
  return pairs.map(([path, raw]) => {
    const token = lookup(tokens, path);
    if (!token) throw new Error(`${source.name}: unknown token "${path}"`);
    const value = String(raw).replace(/\{([^{}]+)\}/g, (_, ref: string) => {
      const target = lookup(tokens, ref);
      if (!target) throw new Error(`${source.name}: ${path} references unknown token {${ref}}`);
      if (!overridden.has(target.name)) return `var(${target.cssVar})`;
      if (!target.hasBase)
        throw new Error(
          `${source.name}: ${path} derives from {${ref}}, which it also overrides; that needs a -base alias (BASE_ALIAS_GROUPS in @newbrush/tokens)`,
        );
      return `var(${target.cssVar}-base)`;
    });
    if (!value.trim() || /[;{}]/.test(value))
      throw new Error(`${source.name}: ${path} has an invalid value "${value}"`);
    return { path: token.name, cssVar: token.cssVar, value };
  });
}

/** Value that restores a token's default inside `.style-default`. */
export function restoreValue(token: TokenInfo): string {
  if (token.hasBase) return `var(${token.cssVar}-base)`;
  if (token.themed)
    throw new Error(
      `${token.name} differs per theme and has no -base alias, so .style-default cannot restore it; add its group to BASE_ALIAS_GROUPS in @newbrush/tokens`,
    );
  if (!token.declared) throw new Error(`${token.name} is not declared in tokens.css`);
  return token.declared;
}

const rule = (selectors: string[], lines: string[]) =>
  `  ${selectors.join(",\n  ")} {\n${lines.map((l) => `    ${l}`).join("\n")}\n  }`;

/** Top-level statements of a stylesheet must all be `@layer nb.styles { … }` blocks. */
export function checkRecipes(css: string, origin: string): void {
  const code = css.replace(/\/\*[\s\S]*?\*\//g, "");
  let depth = 0;
  let prelude = "";
  for (const ch of code) {
    if (depth === 0 && (ch === "{" || ch === ";")) {
      if (prelude.trim() !== "@layer nb.styles" || ch === ";")
        throw new Error(
          `${origin}: every rule must be inside "@layer nb.styles { … }" (found "${prelude.trim()}")`,
        );
      prelude = "";
    }
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    else if (depth === 0) prelude += ch;
    if (depth < 0) throw new Error(`${origin}: unbalanced braces`);
  }
  if (depth !== 0 || prelude.trim()) throw new Error(`${origin}: unbalanced braces`);
}

/** `:--style` in recipes.css stands for the style's selector list, at zero specificity. */
export const STYLE_PLACEHOLDER = ":--style";
export function expandRecipes(css: string, selectors: string[]): string {
  return css.replaceAll(STYLE_PLACEHOLDER, `:where(${selectors.join(", ")})`);
}

/** CSS for one style: its marker and token overrides in nb.tokens, then its recipes. */
export function styleCss(
  style: LoadedStyle,
  tokens: Map<string, TokenInfo>,
  { prefix = "" }: { prefix?: string } = {},
): string {
  const selectors = styleSelectors(style.source, prefix);
  const overrides = resolveOverrides(style.source, tokens);
  const lines = [
    `--nb-style: ${style.source.name};`,
    ...overrides.map((o) => `${o.cssVar}: ${o.value};`),
  ];
  const parts = [
    `/* newBrush style: ${style.source.name} */`,
    `@layer nb.tokens {\n${rule(selectors, lines)}\n}`,
  ];
  if (style.recipes?.trim()) {
    checkRecipes(style.recipes, `${style.source.name}/recipes.css`);
    parts.push(expandRecipes(style.recipes.trim(), selectors));
  }
  return `${parts.join("\n")}\n`;
}

/**
 * `.style-default`: marks the subtree as the default style and restores every token any of `styles` overrides.
 * Emitted after the styles, so `class="neon style-default"` on one element resolves to the default.
 */
export function resetCss(
  styles: LoadedStyle[],
  tokens: Map<string, TokenInfo>,
  { prefix = "" }: { prefix?: string } = {},
): string {
  const restored = new Map<string, string>();
  for (const s of styles)
    for (const o of resolveOverrides(s.source, tokens)) {
      const token = tokens.get(o.path);
      if (token && !restored.has(token.cssVar)) restored.set(token.cssVar, restoreValue(token));
    }
  const lines = [`--nb-style: ${RESET_NAME};`, ...[...restored].map(([v, x]) => `${v}: ${x};`)];
  return `/* newBrush style reset: .style-default */\n@layer nb.tokens {\n${rule(resetSelectors(prefix), lines)}\n}\n`;
}

/** Manifest entry (`@newbrush/schema` Style) for a style. */
export function manifestEntry(style: LoadedStyle, tokens: Map<string, TokenInfo>): Style {
  const { source } = style;
  return Style.parse({
    name: source.name,
    aliases: source.aliases,
    title: source.title,
    description: source.description,
    keywords: source.keywords,
    preferredScheme: source.preferredScheme,
    density: source.density,
    fonts: source.fonts,
    effects: source.effects,
    tokens: resolveOverrides(source, tokens),
    recipes: source.recipes,
    a11y: source.a11y,
    examples: style.preview?.trim()
      ? [{ title: `${source.title} preview`, html: style.preview.trim() }]
      : [],
    status: source.status,
    since: source.since,
  });
}
