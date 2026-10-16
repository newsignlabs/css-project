/**
 * Seeded palettes (specs/001 T061, FR-004).
 *
 * Palettes in src/primitive/color.json are declared by a seed (`$extensions["nb.seed"]`) instead of eleven
 * hand-written steps. The token build expands them through a Style Dictionary preprocessor, and user builds that
 * set `theme.seeds` in newbrush.config get the same expansion as a CSS override, so one implementation serves both.
 */
import colorSource from "../src/primitive/color.json" with { type: "json" };
import { cssVarName } from "./names.ts";
import {
  CHROMA_CURVES,
  generateScale,
  LIGHTNESS,
  MAX_CHROMA,
  type ScaleKind,
  type ScaleStep,
  STEPS,
  type Step,
} from "./scale.ts";

export { generateScale, type ScaleKind, type ScaleStep, STEPS } from "./scale.ts";

/** Seed declaration on a palette group. */
export interface SeedSpec {
  color: string;
  kind: ScaleKind;
}
const SEED = "nb.seed";
/** DTCG-ish node: groups and tokens, with optional `$extensions`. */
type TreeNode = { [key: string]: unknown; $extensions?: Record<string, unknown> };

const seedOf = (node: unknown): SeedSpec | undefined =>
  node && typeof node === "object"
    ? ((node as TreeNode).$extensions?.[SEED] as SeedSpec | undefined)
    : undefined;

/** Palettes that config `theme.seeds` may replace (the others are fixed status colours). */
export const SEEDABLE = ["brand", "accent", "neutral"] as const;
export type SeedName = (typeof SEEDABLE)[number];
export type Seeds = Partial<Record<SeedName, string>>;

/** Default seed of every seeded palette, in source order. */
export const DEFAULT_SEEDS: Readonly<Record<string, SeedSpec>> = Object.freeze(
  Object.fromEntries(
    Object.entries(colorSource.color).flatMap(([name, node]) => {
      const seed = seedOf(node);
      return seed ? [[name, seed]] : [];
    }),
  ),
);

/** Validates config seeds; returns one message per problem (empty when valid). */
export function checkSeeds(seeds: Record<string, unknown> = {}): string[] {
  const problems: string[] = [];
  for (const [name, color] of Object.entries(seeds)) {
    if (!(SEEDABLE as readonly string[]).includes(name))
      problems.push(`theme.seeds.${name}: unknown seed (expected ${SEEDABLE.join(", ")})`);
    else if (typeof color !== "string") problems.push(`theme.seeds.${name}: expected a CSS colour`);
    else {
      try {
        generateScale(color);
      } catch {
        problems.push(`theme.seeds.${name}: "${color}" is not a valid CSS colour`);
      }
    }
  }
  return problems;
}

/** The generated scale of every palette whose seed is overridden (or of all seeded palettes when `all`). */
export function palettes(seeds: Seeds = {}, { all = false } = {}): Record<string, ScaleStep[]> {
  const out: Record<string, ScaleStep[]> = {};
  for (const [name, spec] of Object.entries(DEFAULT_SEEDS)) {
    const color = seeds[name as SeedName];
    if (color || all) out[name] = generateScale(color ?? spec.color, { kind: spec.kind });
  }
  return out;
}

/**
 * Style Dictionary preprocessor body: replaces every seeded palette group in a DTCG tree with its eleven steps.
 * Each step's `$value` is the sRGB-safe colour; the Display P3 colour rides along in `$extensions["nb.p3"]`.
 */
export function expandSeeds<T extends Record<string, unknown>>(tree: T, seeds: Seeds = {}): T {
  const walk = (node: unknown): unknown => {
    if (!node || typeof node !== "object" || Array.isArray(node)) return node;
    const out: TreeNode = {};
    for (const [key, child] of Object.entries(node as TreeNode)) {
      const spec = key.startsWith("$") ? undefined : seedOf(child);
      if (!spec) {
        out[key] = key.startsWith("$") ? child : walk(child);
        continue;
      }
      const { $extensions, ...group } = child as TreeNode;
      const { [SEED]: _seed, ...extensions } = $extensions ?? {};
      const color = seeds[key as SeedName] ?? spec.color;
      const steps = generateScale(color, { kind: spec.kind }).map((s) => [
        String(s.step),
        { $value: s.value, $extensions: { "nb.p3": s.p3 } },
      ]);
      out[key] = {
        ...group,
        ...(Object.keys(extensions).length ? { $extensions: extensions } : {}),
        ...Object.fromEntries(steps),
      };
    }
    return out;
  };
  return walk(tree) as T;
}

// ── Runtime re-tint (T063) ────────────────────────────────────────────────────

/** Browsers that can compute relative colours get the runtime re-tint; others keep the static palette. */
export const TINT_SUPPORTS = "(color: oklch(from red l c h))";
/** Where palettes (and so tints) are computed: the root and every theme island. */
export const TINT_SELECTORS = [":root", "::backdrop", "[data-nb-theme]"];
/** The custom property a page sets to re-tint a palette at runtime, e.g. `--nb-color-brand-seed`. */
export const seedVar = (palette: string) => `--nb-color-${palette}-seed`;
const tintVar = (palette: string, step: number) => `--nb-tint-${palette}-${step}`;

/**
 * The step as a relative colour of the runtime seed: the same lightness curve and chroma easing as the build-time
 * generator, computed by the browser. It skips the build-time gamut mapping and contrast guard (the browser maps
 * out-of-gamut colours itself), so `theme.seeds` remains the way to get AA-guaranteed palettes.
 */
export function tintFormula(palette: SeedName, step: Step): string {
  const kind = DEFAULT_SEEDS[palette]?.kind ?? "chromatic";
  const factor = CHROMA_CURVES[kind][STEPS.indexOf(step)];
  return `oklch(from var(${seedVar(palette)}) ${LIGHTNESS[step]}% calc(min(c, ${MAX_CHROMA}) * ${factor}) h)`;
}

/**
 * Rules declaring seedable palettes so they can be re-tinted at runtime: each step is
 * `var(--nb-tint-<palette>-<step>, <static colour>)`. The tint is a relative colour of `--nb-color-<palette>-seed`;
 * while the seed is unset it is invalid at computed-value time, so the static (gamut-mapped, contrast-guarded)
 * colour applies. With `tints`, the tint formulas are declared too, behind `@supports` so engines without relative
 * colour syntax never see them. Lines are indented for an `@layer` block.
 */
export function tintableCss(
  scales: Partial<Record<SeedName, ScaleStep[]>>,
  selectors: string[],
  { tints = true, p3 = "differing" }: { tints?: boolean; p3?: "all" | "differing" } = {},
): string {
  const entries = Object.entries(scales) as [SeedName, ScaleStep[]][];
  if (!entries.length) return "";
  const rule = (pad: string, lines: string[]) =>
    `${pad}${selectors.join(`,\n${pad}`)} {\n${lines.map((l) => `${pad}  ${l}`).join("\n")}\n${pad}}`;
  const steps = (pick: (s: ScaleStep) => string | null) =>
    entries.flatMap(([name, list]) =>
      list.flatMap((s) => {
        const value = pick(s);
        return value === null
          ? []
          : [
              `${cssVarName(["color", name, String(s.step)])}: var(${tintVar(name, s.step)}, ${value});`,
            ];
      }),
    );
  const wide = steps((s) => (p3 === "all" || s.p3 !== s.value ? s.p3 : null));
  const formulas = entries.flatMap(([name, list]) =>
    list.map((s) => `${tintVar(name, s.step)}: ${tintFormula(name, s.step)};`),
  );
  return [
    rule(
      "  ",
      steps((s) => s.value),
    ),
    ...(wide.length ? [`  @media (color-gamut: p3) {\n${rule("    ", wide)}\n  }`] : []),
    ...(tints ? [`  @supports ${TINT_SUPPORTS} {\n${rule("    ", formulas)}\n  }`] : []),
  ].join("\n\n");
}

/** Selectors for config `theme.seeds`: the framework's tint selectors with doubled specificity. */
const SEEDED_SELECTORS = [":root:root", ":root ::backdrop", "[data-nb-theme][data-nb-theme]"];

/**
 * CSS that re-tints a stylesheet for config `theme.seeds`: every step of each overridden palette as a custom
 * property in `nb.tokens`, plus Display P3 values under `@media (color-gamut: p3)`. Semantic tokens reference the
 * palettes through var(), so light, dark and contrast themes all follow. Doubled specificity outranks the
 * framework's own declarations (on the root and on theme islands), so the result does not depend on where it lands
 * in the bundle; steps keep the `var(--nb-tint-…)` form so a runtime `--nb-color-<palette>-seed` still wins.
 * Returns "" when no seed is set; throws on invalid seeds.
 */
export function seedTokensCss(seeds: Seeds = {}): string {
  const problems = checkSeeds(seeds);
  if (problems.length) throw new Error(problems.join("\n"));
  const generated = palettes(seeds) as Partial<Record<SeedName, ScaleStep[]>>;
  if (!Object.keys(generated).length) return "";
  return [
    "/* newBrush theme.seeds: palettes generated from newbrush.config */",
    "@layer nb.tokens {",
    tintableCss(generated, SEEDED_SELECTORS, { tints: false, p3: "all" }),
    "}",
    "",
  ].join("\n");
}
