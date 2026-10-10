/**
 * Seed → 11-step OKLCH colour scale (specs/001 FR-004, research R-02).
 *
 * 1. Target: every step starts from a fixed lightness; chroma follows an easing curve scaled from the seed's
 *    chroma (the peak, at step 500); hue is the seed's hue. This curve reproduces the default palettes exactly.
 * 2. Gamut: each step is mapped to Display P3 (`p3`, for `@media (color-gamut: p3)`) and to sRGB (`value`) by
 *    reducing chroma only, so hue and lightness never shift.
 * 3. Contrast guard: at equal OKLCH lightness a yellow or green is brighter (WCAG luminance) than a blue, so a
 *    fixed curve alone cannot promise contrast for every seed. Each step's luminance is held on the safe side of
 *    the reference scale (the default brand blue, or the default neutral for neutral scales; both pass every
 *    semantic pair): dark steps (500–950) are
 *    never lighter and light steps (50–400) never darker, lowering or raising lightness as needed. Every pair of
 *    a dark and a light step, or of a step and a fixed neutral, therefore contrasts at least as much as it does
 *    on the reference scale, whatever the seed.
 */
import { clampChroma, converter, type Oklch, parse, wcagLuminance } from "culori";

const toOklchColor = converter("oklch");

export const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
export type Step = (typeof STEPS)[number];

/** OKLCH lightness (%) per step, shared by every scale. */
export const LIGHTNESS: Record<Step, number> = {
  50: 97.8,
  100: 95.4,
  200: 90.6,
  300: 83.4,
  400: 72.6,
  500: 62.4,
  600: 53.5,
  700: 46,
  800: 38.4,
  900: 31,
  950: 22.8,
};

/** Chroma per step as a fraction of the seed's chroma. `neutral` keeps greys nearly flat in the darks. */
export const CHROMA_CURVES = {
  chromatic: [0.1, 0.2, 0.38, 0.6, 0.84, 1, 0.98, 0.88, 0.72, 0.56, 0.42],
  neutral: [0.125, 0.1875, 0.375, 0.625, 0.8125, 1, 1, 0.875, 0.75, 0.5625, 0.4375],
} as const;
export type ScaleKind = keyof typeof CHROMA_CURVES;

/** Chroma above this is treated as the cap; nothing displayable on current screens goes beyond ~0.37. */
export const MAX_CHROMA = 0.37;
/** Below this the seed is treated as grey, and hue is ignored. */
export const ACHROMATIC = 0.002;

/** Seeds of the default brand and neutral scales; their sRGB luminances are the contrast guard's reference. */
export const REFERENCE_SEEDS: Record<ScaleKind, string> = {
  chromatic: "oklch(62.4% 0.19 255)",
  neutral: "oklch(62.4% 0.016 260)",
};
const DARK_FROM: Step = 500;

export interface ScaleStep {
  step: Step;
  /** sRGB-safe colour, as `oklch(L% C H)`. */
  value: string;
  /** Display P3-safe colour, as `oklch(L% C H)`; equals `value` when the colour already fits sRGB. */
  p3: string;
}

export interface ScaleOptions {
  kind?: ScaleKind;
}

const round = (n: number, digits: number) => Number(n.toFixed(digits));
export const formatOklch = ({ l, c, h }: { l: number; c: number; h: number }) =>
  `oklch(${round(l * 100, 1)}% ${round(c, 3)} ${round(c === 0 ? 0 : h, 1)})`;

type Gamut = "rgb" | "p3";

/** Parses any CSS colour into OKLCH; throws on invalid input. */
export function toOklch(color: string): Oklch {
  const parsed = parse(color);
  if (!parsed) throw new Error(`Invalid seed colour: ${color}`);
  return toOklchColor(parsed);
}

/**
 * `c`, or the largest chroma at (l, h) that fits `gamut` when `c` does not — culori searches on chroma alone, so
 * lightness and hue stay exact. Reduced values are floored to 3 decimals so rounding never leaves the gamut.
 */
function fitChroma(l: number, c: number, h: number, gamut: Gamut): number {
  const max = (clampChroma({ mode: "oklch", l, c, h }, "oklch", gamut) as Oklch).c ?? 0;
  return max >= c ? c : Math.floor(max * 1000) / 1000;
}

interface Fitted {
  l: number;
  c: number;
}
const luminance = (l: number, c: number, h: number) => wcagLuminance({ mode: "oklch", l, c, h });

/** Target chroma per step for a seed; lightness is LIGHTNESS. */
function targets(seed: string, kind: ScaleKind) {
  const { c = 0, h = 0 } = toOklch(seed);
  const peak = Math.min(c, MAX_CHROMA);
  const grey = peak < ACHROMATIC;
  const hue = grey ? 0 : round(h, 1);
  return {
    hue,
    chroma: STEPS.map((_, i) => (grey ? 0 : round(peak * (CHROMA_CURVES[kind][i] ?? 0), 3))),
  };
}

/**
 * Lightness (rounded to 0.1 %) nearest to `l0` whose gamut-fitted colour stays on the safe side of `yRef`:
 * at or below it for dark steps, at or above it for light steps.
 */
function guard(
  l0: number,
  c: number,
  h: number,
  gamut: Gamut,
  yRef: number,
  dark: boolean,
): Fitted {
  const at = (l: number): Fitted => ({ l, c: fitChroma(l, c, h, gamut) });
  const safe = ({ l, c: fc }: Fitted) =>
    dark ? luminance(l, fc, h) <= yRef : luminance(l, fc, h) >= yRef;
  const start = at(l0);
  if (safe(start)) return start;
  let lo = dark ? 0 : l0;
  let hi = dark ? l0 : 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (safe(at(mid)) === dark) lo = mid;
    else hi = mid;
  }
  // Round towards safety, then nudge in 0.1 % steps in case chroma re-fitting at the rounded value tipped it over.
  let l = dark ? Math.floor(lo * 1000) / 1000 : Math.ceil(hi * 1000) / 1000;
  while (!safe(at(l))) l = round(l + (dark ? -0.001 : 0.001), 3);
  return at(l);
}

/** sRGB luminance of each step of the reference scales, before guarding. */
const referenceLuminance = (kind: ScaleKind): number[] => {
  const { hue, chroma } = targets(REFERENCE_SEEDS[kind], kind);
  return STEPS.map((step, i) => {
    const l = LIGHTNESS[step] / 100;
    return luminance(l, fitChroma(l, fitChroma(l, chroma[i] ?? 0, hue, "p3"), hue, "rgb"), hue);
  });
};
const REFERENCE_LUMINANCE: Record<ScaleKind, number[]> = {
  chromatic: referenceLuminance("chromatic"),
  neutral: referenceLuminance("neutral"),
};

export function generateScale(
  seed: string,
  { kind = "chromatic" }: ScaleOptions = {},
): ScaleStep[] {
  const { hue, chroma } = targets(seed, kind);
  return STEPS.map((step, i) => {
    const l = LIGHTNESS[step] / 100;
    const target = chroma[i] ?? 0;
    const dark = step >= DARK_FROM;
    const yRef = REFERENCE_LUMINANCE[kind][i] ?? 0;
    const p3 = guard(l, target, hue, "p3", yRef, dark);
    const srgb = guard(l, fitChroma(l, target, hue, "p3"), hue, "rgb", yRef, dark);
    return {
      step,
      value: formatOklch({ ...srgb, h: hue }),
      p3: formatOklch({ ...p3, h: hue }),
    };
  });
}

/** The unguarded, unmapped curve for a seed (what the default palettes are written as). */
export function targetScale(seed: string, { kind = "chromatic" }: ScaleOptions = {}): string[] {
  const { hue, chroma } = targets(seed, kind);
  return STEPS.map((step, i) =>
    formatOklch({ l: LIGHTNESS[step] / 100, c: chroma[i] ?? 0, h: hue }),
  );
}
