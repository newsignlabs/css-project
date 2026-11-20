/**
 * Design styles (specs/004-design-styles T006, T007). A style is a folder with `style.json` (metadata and DTCG token
 * overrides) and an optional `recipes.css` (scoped rules for what tokens cannot express). This module turns a style
 * into CSS and a manifest entry; build.ts runs it over src/ and custom styles will reuse it.
 *
 * Emitted shape, all in `@layer nb.styles` so it outranks every token declaration whatever its specificity:
 *   :where(…dark-first…) { …the dark theme… }                    ← preferredScheme "dark", no explicit theme
 *   .g-morph, .nb-g-morph, .glass, [data-nb-style="g-morph"],
 *   :where(:root:has(> body:is(…)), …theme islands inside…) { --nb-style: g-morph; …overrides }
 *   :where(…) { color; background-color }                         ← repaint, when the style changes them
 *   :where(.g-morph, …) .nb-card { … }                              ← recipes.css, `:--style` expanded
 *   [data-nb-theme="contrast"] :is(…) { …colours restored… }     ← contrast theme / forced colors outrank styles
 * Overrides are plain inherited custom properties, so the nearest style ancestor wins (style islands); the
 * zero-specificity forms lose to any style class on the element itself. `.style-default` restores the defaults.
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
  for (const [scheme, tree] of Object.entries(parsed.data.schemes))
    for (const [path] of flattenTokens(tree ?? {}))
      if (!path.startsWith("color."))
        throw new Error(
          `${origin}: schemes.${scheme}.${path}: only colours can differ per scheme (they compile to light-dark())`,
        );
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
  /** Per-scheme values, for colours declared under `schemes` (`value` is then their `light-dark()`). */
  schemes?: { light: string; dark: string };
}

/**
 * Resolves a style's overrides to CSS values. `{a.b}` references become `var(--nb-a-b)`; a reference to a token the
 * same style overrides means that token's default (see restoreValue): its `-base` alias (`var(--nb-a-b-base)`), or
 * for a token that is the same in every theme its tokens.css declaration — never the overridden value.
 *
 * Colours under `schemes.light` / `schemes.dark` compile to `light-dark(light, dark)`, the missing side being the
 * theme's own value (`-base`); `light-dark()` resolves where the colour is used, from that element's color-scheme.
 *
 * Overrides apply to the token itself only: tokens defined from it (e.g. `control.radius` = `{radius.md}`) were
 * computed where the theme declared them, so a style overrides the tokens components actually consume.
 */
export function resolveOverrides(
  source: LoadedStyle["source"],
  tokens: Map<string, TokenInfo>,
): Override[] {
  const plain = flattenTokens(source.tokens);
  const light = new Map(flattenTokens(source.schemes.light ?? {}));
  const dark = new Map(flattenTokens(source.schemes.dark ?? {}));
  const all = [...plain.map(([p]) => p), ...light.keys(), ...dark.keys()];
  const overridden = new Set(all.map((path) => lookup(tokens, path)?.name ?? path));
  const tokenOf = (path: string) => {
    const token = lookup(tokens, path);
    if (!token) throw new Error(`${source.name}: unknown token "${path}"`);
    return token;
  };
  const resolve = (path: string, raw: unknown) => {
    const value = String(raw).replace(/\{([^{}]+)\}/g, (_, ref: string) => {
      const target = lookup(tokens, ref);
      if (!target) throw new Error(`${source.name}: ${path} references unknown token {${ref}}`);
      if (!overridden.has(target.name)) return `var(${target.cssVar})`;
      // The style overrides it too: `{ref}` means its default value, never the overridden one (which could be cyclic).
      try {
        return restoreValue(target);
      } catch (error) {
        throw new Error(
          `${source.name}: ${path} derives from {${ref}}, which it also overrides: ${(error as Error).message}`,
        );
      }
    });
    if (!value.trim() || /[;{}]/.test(value))
      throw new Error(`${source.name}: ${path} has an invalid value "${value}"`);
    return value;
  };
  const out: Override[] = plain.map(([path, raw]) => {
    const token = tokenOf(path);
    if (light.has(path) || dark.has(path))
      throw new Error(`${source.name}: ${path} is set both in tokens and in schemes`);
    return { path: token.name, cssVar: token.cssVar, value: resolve(path, raw) };
  });
  for (const path of new Set([...light.keys(), ...dark.keys()])) {
    const token = tokenOf(path);
    const fallback = restoreValue(token);
    const schemes = {
      light: light.has(path) ? resolve(path, light.get(path)) : fallback,
      dark: dark.has(path) ? resolve(path, dark.get(path)) : fallback,
    };
    out.push({
      path: token.name,
      cssVar: token.cssVar,
      value: `light-dark(${schemes.light}, ${schemes.dark})`,
      schemes,
    });
  }
  return out;
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
/**
 * `:--contrast` stands for "the style, inside or under the contrast theme" (zero specificity): recipes use it to turn
 * their decorations off there, next to `@media (forced-colors: active), (prefers-contrast: more)`.
 */
export const CONTRAST_PLACEHOLDER = ":--contrast";
export function expandRecipes(css: string, selectors: string[], others: string[] = []): string {
  const is = `:is(${selectors.join(", ")})`;
  const where = `:where(${selectors.join(", ")})`;
  const contrast = `:where([data-nb-theme="contrast"]${is}, [data-nb-theme="contrast"] ${is}, ${is} [data-nb-theme="contrast"])`;
  const out = others.length ? nearestOnly(css, where, `:is(${others.join(", ")})`) : css;
  return out.replaceAll(CONTRAST_PLACEHOLDER, contrast).replaceAll(STYLE_PLACEHOLDER, where);
}

/** Splits a selector list at top-level commas. */
function splitList(list: string): string[] {
  const out = [""];
  let depth = 0;
  for (const ch of list) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) out.push("");
    else out[out.length - 1] += ch;
  }
  return out;
}

/**
 * Nearest style wins for recipes too (R-02, selector strategy, depth 2): `:--style X` gets
 * `:where(:not(<style> <other style or .style-default> X))`, so another style or a reset between the style and X turns
 * the recipe off. Zero specificity, so recipes and their contrast/forced-colors removals still compare as written.
 */
function nearestOnly(css: string, where: string, others: string): string {
  return css.replace(/([^{};]+)\{/g, (match, prelude: string) => {
    if (!prelude.includes(`${STYLE_PLACEHOLDER} `)) return match;
    const rewritten = splitList(prelude).map((part) => {
      const m =
        /^(\s*):--style\s+(.+?)(::?(?:before|after|backdrop|placeholder|marker))?(\s*)$/s.exec(
          part,
        );
      if (!m) return part;
      const [, lead = "", target = "", pseudo = "", trail = ""] = m;
      return `${lead}${STYLE_PLACEHOLDER} ${target}:where(:not(${where} ${others} ${target}))${pseudo}${trail}`;
    });
    return `${rewritten.join(",")}{`;
  });
}

/**
 * Contrast theme and forced colors outrank styles (contract: "forced-colors / contrast theme > style"): every colour
 * a style overrides is restored there. Emitted after the overrides, at higher or equal specificity, so it wins.
 */
export function authorityCss(
  style: LoadedStyle,
  tokens: Map<string, TokenInfo>,
  selectors: string[],
): string {
  const colors = resolveOverrides(style.source, tokens).filter((o) => o.path.startsWith("color."));
  if (!colors.length) return "";
  const lines = colors.map((o) => {
    const token = tokens.get(o.path);
    return `${o.cssVar}: ${token ? restoreValue(token) : ""};`;
  });
  const is = `:is(${selectors.join(", ")})`;
  const viaBody = `:has(> body${is})`;
  const block = (pad: string, sel: string[]) =>
    `${pad}${sel.join(`,\n${pad}`)} {\n${lines.map((l) => `${pad}  ${l}`).join("\n")}\n${pad}}`;
  const contrast = '[data-nb-theme="contrast"]';
  return [
    "/* Contrast theme and forced colors outrank the style: its colours are restored. */",
    "@layer nb.styles {",
    block("  ", [
      `${contrast}${is}`,
      `${contrast} ${is}`,
      `${is} ${contrast}`,
      `:root${contrast}${viaBody}`,
    ]),
    "  @media (prefers-contrast: more) and (prefers-color-scheme: light) {",
    block("    ", [
      `:root:not([data-nb-theme])${is}`,
      `:root:not([data-nb-theme]) ${is}`,
      `:root:not([data-nb-theme])${viaBody}`,
    ]),
    "  }",
    "  @media (forced-colors: active) {",
    block("    ", [is, `:root${viaBody}`, `${is} [data-nb-theme]`]),
    "  }",
    "}",
  ].join("\n");
}

export interface StyleContext {
  tokens: Map<string, TokenInfo>;
  /** Selectors of every other style and of `.style-default`: a theme island inside one of them is theirs. */
  others?: string[];
  /** The dark theme's declarations (`themeDeclarations(tokensCss, "dark")`), for `preferredScheme: "dark"`. */
  darkTheme?: Map<string, string>;
  prefix?: string;
}

/** Tokens whose change must repaint the styled element itself (inherited values were computed above it). */
const REPAINT: [RegExp, string][] = [
  [/^color\.text/, "color: var(--nb-color-text);"],
  [/^color\.surface\.default$/, "background-color: var(--nb-color-surface);"],
  [/^font\.family\.sans$/, "font-family: var(--nb-font-family-sans);"],
];

/**
 * CSS for one style, all in nb.styles: the dark theme when it is dark-first and no theme is explicit, its marker and
 * token overrides (also on <html> when the style is on <body>, and on theme islands inside it), a repaint, its
 * recipes, then the contrast authority block.
 */
export function styleCss(style: LoadedStyle, ctx: StyleContext): string {
  const { tokens, others = [], darkTheme, prefix = "" } = ctx;
  const { source } = style;
  const selectors = styleSelectors(source, prefix);
  const is = `:is(${selectors.join(", ")})`;
  const overrides = resolveOverrides(source, tokens);
  const darkFirst = source.preferredScheme === "dark";
  const parts = [`/* newBrush style: ${source.name} */`, "@layer nb.styles {"];
  const indent = (block: string) => block.replace(/^/gm, "  ");

  if (darkFirst) {
    if (!darkTheme?.size)
      throw new Error(`${source.name}: dark-first style needs the dark theme declarations`);
    parts.push(
      "  /* Dark-first: dark unless a theme is explicit (data-nb-theme), and never over the contrast theme. */",
      "  @media not (prefers-contrast: more) {",
      indent(
        rule(
          [
            `:where(${is}:not([data-nb-theme], [data-nb-theme] *))`,
            `:where(:root:not([data-nb-theme]):has(> body${is}))`,
          ],
          [...darkTheme].map(([p, v]) => `${p}: ${v};`),
        ),
      ),
      "  }",
      "",
    );
  }

  const island = `${is} [data-nb-theme]`;
  const notOthers = others.length
    ? `:not(:is(${others.join(", ")}), ${is} :is(${others.join(", ")}) [data-nb-theme])`
    : "";
  parts.push(
    rule(
      [...selectors, `:where(:root:has(> body${is}), ${island}${notOthers})`],
      [`--nb-style: ${source.name};`, ...overrides.map((o) => `${o.cssVar}: ${o.value};`)],
    ),
  );

  const repaint = REPAINT.filter(([re]) => darkFirst || overrides.some((o) => re.test(o.path))).map(
    ([, line]) => line,
  );
  if (repaint.length) parts.push("", rule([`:where(${selectors.join(", ")})`], repaint));
  parts.push("}");

  if (style.recipes?.trim()) {
    checkRecipes(style.recipes, `${source.name}/recipes.css`);
    parts.push(expandRecipes(style.recipes.trim(), selectors, others));
  }
  const authority = authorityCss(style, tokens, selectors);
  if (authority) parts.push(authority);
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
  return `/* newBrush style reset: .style-default */\n@layer nb.styles {\n${rule(resetSelectors(prefix), lines)}\n}\n`;
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
    tokens: resolveOverrides(source, tokens).flatMap(({ schemes, ...o }) =>
      schemes
        ? (["light", "dark"] as const).map((scheme) => ({ ...o, value: schemes[scheme], scheme }))
        : [o],
    ),
    recipes: source.recipes,
    a11y: source.a11y,
    examples: style.preview?.trim()
      ? [{ title: `${source.title} preview`, html: style.preview.trim() }]
      : [],
    status: source.status,
    since: source.since,
  });
}
