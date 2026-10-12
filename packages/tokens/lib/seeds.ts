/**
 * Seeded palettes (specs/001 T061, FR-004).
 *
 * Palettes in src/primitive/color.json are declared by a seed (`$extensions["nb.seed"]`) instead of eleven
 * hand-written steps. The token build expands them through a Style Dictionary preprocessor, and user builds that
 * set `theme.seeds` in newbrush.config get the same expansion as a CSS override, so one implementation serves both.
 */
import colorSource from "../src/primitive/color.json" with { type: "json" };
import { cssVarName } from "./names.ts";
import { generateScale, type ScaleKind, type ScaleStep } from "./scale.ts";

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

const ROOT = ":root:root,\n  :root ::backdrop";

/**
 * CSS that re-tints a stylesheet for config `theme.seeds`: every step of each overridden palette as a custom
 * property in `nb.tokens`, plus Display P3 values under `@media (color-gamut: p3)`. Semantic tokens reference the
 * palettes through var(), so light, dark and contrast themes all follow. The doubled `:root` outranks the
 * framework's own `:root` declarations, so the result does not depend on where it lands in the bundle.
 * Returns "" when no seed is set; throws on invalid seeds.
 */
export function seedTokensCss(seeds: Seeds = {}): string {
  const problems = checkSeeds(seeds);
  if (problems.length) throw new Error(problems.join("\n"));
  const generated = palettes(seeds);
  if (!Object.keys(generated).length) return "";
  const decls = (pick: (s: ScaleStep) => string, indent: string) =>
    Object.entries(generated)
      .flatMap(([name, steps]) =>
        steps.map((s) => `${indent}${cssVarName(["color", name, String(s.step)])}: ${pick(s)};`),
      )
      .join("\n");
  return [
    "/* newBrush theme.seeds: palettes generated from newbrush.config */",
    "@layer nb.tokens {",
    `  ${ROOT} {`,
    decls((s) => s.value, "    "),
    "  }",
    "  @media (color-gamut: p3) {",
    `    ${ROOT.replace("\n  ", "\n    ")} {`,
    decls((s) => s.p3, "      "),
    "    }",
    "  }",
    "}",
    "",
  ].join("\n");
}
