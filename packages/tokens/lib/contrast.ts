/**
 * Build-time contrast checker (specs/001 T062, FR-005, constitution §IV).
 *
 * Every semantic foreground/background pair is resolved in every built-in theme, for the project's palettes
 * (defaults, or generated from config `theme.seeds`), and measured with WCAG 2 (which decides pass/fail at the
 * configured level) and APCA (Lc, reported alongside as the perceptual reference). With `fix`, each failing
 * foreground is replaced by the nearest palette colour that passes every pair it takes part in (or, when no
 * foreground can pass, the background is), without making any other pair fail.
 */
import { converter, differenceCiede2000, parse, wcagLuminance } from "culori";
import colorSource from "../src/primitive/color.json" with { type: "json" };
import semanticSource from "../src/semantic/color.json" with { type: "json" };
import { aliasPath, baseVarName, cssVarName, hasBaseAlias } from "./names.ts";
import { palettes, type Seeds } from "./seeds.ts";
import { THEME_NAMES, type ThemeName, themeBlocks } from "./themes.ts";

export { THEME_NAMES, type ThemeName } from "./themes.ts";

export type Level = "AA" | "AAA";
export type PairKind = "text" | "ui";

/** Minimum WCAG 2 ratio per level: text (1.4.3 / 1.4.6) and non-text UI such as borders and focus rings (1.4.11). */
export const MINIMUMS: Record<Level, Record<PairKind, number>> = {
  AA: { text: 4.5, ui: 3 },
  AAA: { text: 7, ui: 3 },
};

export interface Pair {
  fg: string;
  bg: string;
  kind: PairKind;
}

const surfaces = [
  "color.surface",
  "color.surface.subtle",
  "color.surface.raised",
  "color.surface.overlay",
];
const tones = ["success", "warning", "danger", "info"];
const pair = (fg: string, bg: string, kind: PairKind = "text"): Pair => ({ fg, bg, kind });

/** Every semantic pair newBrush guarantees. */
export const PAIRS: Pair[] = [
  ...surfaces.flatMap((s) => [
    pair("color.text", s),
    pair("color.text.muted", s),
    pair("color.text.link", s),
    pair("color.accent.text", s),
    pair("color.border.strong", s, "ui"),
    pair("color.focus.ring", s, "ui"),
    ...tones.map((t) => pair(`color.${t}.text`, s)),
  ]),
  pair("color.text.inverse", "color.surface.inverse"),
  pair("color.on-accent", "color.accent"),
  pair("color.on-accent", "color.accent.hover"),
  pair("color.accent.text", "color.accent.subtle"),
  pair("color.text", "color.selection"),
  ...tones.flatMap((t) => [
    pair(`color.on-${t}`, `color.${t}`),
    pair(`color.on-${t}`, `color.${t}.hover`),
    pair(`color.${t}.text`, `color.${t}.subtle`),
    pair("color.text", `color.${t}.subtle`),
  ]),
];

// ── APCA ─────────────────────────────────────────────────────────────────────

const toRgb = converter("rgb");
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** APCA-W3 0.0.98G-4g screen luminance (simple 2.4 exponent, soft black clamp). */
function apcaY(color: string): number {
  const rgb = toRgb(parse(color) ?? "black") ?? { r: 0, g: 0, b: 0 };
  const y =
    0.2126729 * clamp01(rgb.r) ** 2.4 +
    0.7151522 * clamp01(rgb.g) ** 2.4 +
    0.072175 * clamp01(rgb.b) ** 2.4;
  return y < 0.022 ? y + (0.022 - y) ** 1.414 : y;
}

/**
 * APCA lightness contrast Lc of text `fg` on `bg` (APCA-W3 0.0.98G-4g): positive for dark text on a light
 * background, negative for light on dark; |Lc| 60 ≈ fluent body text, 45 ≈ large text, 30 ≈ non-text minimum.
 */
export function apcaContrast(fg: string, bg: string): number {
  const txt = apcaY(fg);
  const back = apcaY(bg);
  if (Math.abs(back - txt) < 0.0005) return 0;
  if (back > txt) {
    const sapc = (back ** 0.56 - txt ** 0.57) * 1.14;
    return sapc < 0.1 ? 0 : (sapc - 0.027) * 100;
  }
  const sapc = (back ** 0.65 - txt ** 0.62) * 1.14;
  return sapc > -0.1 ? 0 : (sapc + 0.027) * 100;
}

// ── Resolution ───────────────────────────────────────────────────────────────

type Node = { $value?: string; $extensions?: { "nb.themes"?: Partial<Record<ThemeName, string>> } };
/** Semantic token name → alias per theme (light is the default). */
const semantic = new Map<string, Partial<Record<ThemeName, string>>>();
(function walk(node: Record<string, unknown>, path: string[]) {
  if ("$value" in node) {
    const { $value, $extensions } = node as Node;
    semantic.set(path.join("."), { light: $value, ...$extensions?.["nb.themes"] });
  }
  for (const [key, child] of Object.entries(node))
    if (!key.startsWith("$") && child && typeof child === "object")
      walk(child as Record<string, unknown>, [...path, key]);
})(semanticSource.color as Record<string, unknown>, ["color"]);

const tokenName = (name: string) => (semantic.has(name) ? name : `${name}.default`);

/** Per-theme overrides: semantic token name → alias such as "{color.brand.800}". */
export type Overrides = Partial<Record<ThemeName, Record<string, string>>>;

interface Resolver {
  /** Alias of a semantic token in a theme. */
  alias(name: string, theme: ThemeName, overrides?: Overrides): string;
  /** Colour value of an alias or semantic token in a theme. */
  color(nameOrAlias: string, theme: ThemeName, overrides?: Overrides): string;
  /** Every primitive colour, as alias → value. */
  primitives: Map<string, string>;
}

function resolver(seeds: Seeds): Resolver {
  const primitives = new Map<string, string>();
  for (const [name, steps] of Object.entries(palettes(seeds, { all: true })))
    for (const s of steps) primitives.set(`{color.${name}.${s.step}}`, s.value);
  for (const [name, node] of Object.entries(colorSource.color))
    if (node && typeof node === "object" && "$value" in node)
      primitives.set(`{color.${name}}`, (node as { $value: string }).$value);

  const alias = (name: string, theme: ThemeName, overrides: Overrides = {}) => {
    const token = tokenName(name);
    const own = overrides[theme]?.[token] ?? semantic.get(token)?.[theme];
    if (own) return own;
    // Themes other than light inherit light's value for tokens they do not redefine.
    const light = overrides.light?.[token] ?? semantic.get(token)?.light;
    if (!light) throw new Error(`Unknown semantic colour ${name}`);
    return light;
  };
  const color = (nameOrAlias: string, theme: ThemeName, overrides: Overrides = {}): string => {
    const ref = nameOrAlias.startsWith("{") ? nameOrAlias : alias(nameOrAlias, theme, overrides);
    const primitive = primitives.get(ref);
    if (primitive) return primitive;
    const path = aliasPath(ref);
    if (path) return color(path.join("."), theme, overrides); // alias to another semantic token
    return ref; // literal colour
  };
  return { alias, color, primitives };
}

// ── Check & fix ──────────────────────────────────────────────────────────────

export interface PairResult extends Pair {
  theme: ThemeName;
  /** Required WCAG 2 ratio at the checked level. */
  min: number;
  ratio: number;
  /** APCA Lc (informative). */
  lc: number;
  pass: boolean;
  fgValue: string;
  bgValue: string;
}

export interface Fix {
  theme: ThemeName;
  /** Semantic token whose value changed, e.g. "color.text.link". */
  token: string;
  from: string;
  to: string;
}

export interface ContrastReport {
  level: Level;
  /** Every pair in every theme, after fixes when `fix` is on. */
  results: PairResult[];
  /** Pairs still failing (after fixes when `fix` is on). */
  failures: PairResult[];
  /** Token replacements applied by `fix`, in order (empty otherwise). */
  fixes: Fix[];
}

export interface CheckOptions {
  seeds?: Seeds;
  level?: Level;
  /** Replace failing foregrounds (or, failing that, backgrounds) with the nearest passing palette colour. */
  fix?: boolean;
}

/** WCAG 2 relative luminance, cached per colour string (the fix search measures the same colours many times). */
const luminanceCache = new Map<string, number>();
function luminance(color: string): number {
  let y = luminanceCache.get(color);
  if (y === undefined) {
    y = wcagLuminance(parse(color) ?? "black");
    luminanceCache.set(color, y);
  }
  return y;
}
/** WCAG 2 contrast ratio (same as culori's wcagContrast, on cached luminances). */
function ratioOf(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

function measure(r: Resolver, level: Level, overrides: Overrides, theme: ThemeName): PairResult[] {
  return PAIRS.map((p) => {
    const fgValue = r.color(p.fg, theme, overrides);
    const bgValue = r.color(p.bg, theme, overrides);
    const ratio = ratioOf(fgValue, bgValue);
    const min = MINIMUMS[level][p.kind];
    return {
      ...p,
      theme,
      min,
      ratio,
      lc: apcaContrast(fgValue, bgValue),
      pass: ratio >= min,
      fgValue,
      bgValue,
    };
  });
}

const all = (r: Resolver, level: Level, overrides: Overrides) =>
  THEME_NAMES.flatMap((theme) => measure(r, level, overrides, theme));
const key = (p: PairResult) => `${p.theme}|${p.fg}|${p.bg}`;
const failing = (results: PairResult[]) => new Set(results.filter((p) => !p.pass).map(key));

export function checkContrast({
  seeds = {},
  level = "AA",
  fix = false,
}: CheckOptions = {}): ContrastReport {
  const r = resolver(seeds);
  const overrides: Overrides = {};
  const fixes: Fix[] = [];
  let results = all(r, level, overrides);

  /**
   * Replaces `token` in `theme` with the nearest primitive colour (CIEDE2000) that makes every pair selected by
   * `involves` pass without making any other pair, in any theme, fail. Returns whether a replacement was found.
   * Only pairs that use the token are re-measured per candidate: in `theme`, and, for a light change, in the
   * themes that inherit the token's light value. Every other pair keeps its colours.
   */
  const attempt = (theme: ThemeName, token: string, involves: (p: PairResult) => boolean) => {
    const name = tokenName(token);
    const before = failing(results);
    const targets = new Set(
      results.filter((p) => p.theme === theme && !p.pass && involves(p)).map(key),
    );
    if (!targets.size) return true; // already fixed by an earlier replacement
    const themes =
      theme === "light"
        ? THEME_NAMES.filter(
            (t) => t === "light" || !(overrides[t]?.[name] ?? semantic.get(name)?.[t]),
          )
        : [theme];
    const uses = PAIRS.filter((p) => tokenName(p.fg) === name || tokenName(p.bg) === name);
    const affected = themes.flatMap((t) => uses.map((p) => ({ t, p, k: `${t}|${p.fg}|${p.bg}` })));
    const current = r.color(token, theme, overrides);
    const candidates = [...r.primitives]
      .map(([ref, value]) => ({ ref, distance: differenceCiede2000()(current, value) }))
      .sort((a, b) => a.distance - b.distance);
    for (const { ref } of candidates) {
      const trial: Overrides = { ...overrides, [theme]: { ...overrides[theme], [name]: ref } };
      const ok = affected.every(({ t, p, k }) => {
        const pass =
          ratioOf(r.color(p.fg, t, trial), r.color(p.bg, t, trial)) >= MINIMUMS[level][p.kind];
        // A pair may stay failing only if it already failed and is not one this replacement must fix.
        return pass || (before.has(k) && !targets.has(k));
      });
      if (ok) {
        fixes.push({ theme, token: name, from: r.alias(token, theme, overrides), to: ref });
        Object.assign(overrides, trial);
        results = all(r, level, overrides);
        return true;
      }
    }
    return false;
  };

  if (fix) {
    for (const theme of THEME_NAMES) {
      const failed = () => results.filter((p) => p.theme === theme && !p.pass);
      // Prefer changing the foreground (text, borders, focus rings); when no foreground can pass (e.g. white text
      // on a mid-tone fill at AAA), change the background instead.
      for (const fg of new Set(failed().map((p) => p.fg))) attempt(theme, fg, (p) => p.fg === fg);
      for (const bg of new Set(failed().map((p) => p.bg))) attempt(theme, bg, (p) => p.bg === bg);
    }
  }
  return { level, results, failures: results.filter((p) => !p.pass), fixes };
}

/**
 * CSS applying contrast fixes: each fixed token is restated in every theme rule (light, dark, contrast, in the
 * framework's order and with doubled specificity), so it wins over the framework's declaration in exactly the
 * themes where it was fixed and keeps its original value everywhere else.
 */
export function contrastFixCss(report: Pick<ContrastReport, "fixes">): string {
  if (!report.fixes.length) return "";
  const r = resolver({});
  const overrides: Overrides = {};
  for (const f of report.fixes) overrides[f.theme] = { ...overrides[f.theme], [f.token]: f.to };
  const tokens = [...new Set(report.fixes.map((f) => f.token))];
  // A token with a `-base` alias is fixed in the alias, so design styles deriving from it see the fixed colour too.
  const fixedVar = (path: string[]) => (hasBaseAlias(path) ? baseVarName(path) : cssVarName(path));
  const value = (alias: string) => {
    const path = aliasPath(alias);
    return path ? `var(${cssVarName(path)})` : alias;
  };
  const blocks = THEME_NAMES.flatMap((theme) => {
    const lines = tokens.flatMap((token) => {
      // Light declares every token; other themes only those they redefine (or that were fixed in them).
      const declared =
        theme === "light" || overrides[theme]?.[token] || semantic.get(token)?.[theme];
      return declared
        ? [`${fixedVar(token.split("."))}: ${value(r.alias(token, theme, overrides))};`]
        : [];
    });
    return lines.length ? themeBlocks(theme, lines, { double: true }) : [];
  });
  return [
    "/* newBrush contrast fixes (contrast.onFail: fix) */",
    "@layer nb.tokens {",
    blocks.join("\n\n"),
    "}",
    "",
  ].join("\n");
}

/** One line per failing pair or fix, for build output. */
export function formatContrast(report: ContrastReport): string[] {
  const ratio = (n: number) => `${n.toFixed(2)}:1`;
  return [
    ...report.fixes.map((f) => `fixed ${f.theme}: ${f.token} ${f.from} → ${f.to}`),
    ...report.failures.map(
      (p) =>
        `${p.theme}: ${p.fg} on ${p.bg} ${ratio(p.ratio)} < ${ratio(p.min)} (${report.level}, APCA Lc ${p.lc.toFixed(1)})`,
    ),
  ];
}
