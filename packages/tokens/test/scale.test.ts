import { clampChroma, inGamut, type Oklch, parse, wcagContrast } from "culori";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  generateScale,
  LIGHTNESS,
  REFERENCE_SEEDS,
  type ScaleKind,
  STEPS,
  targetScale,
} from "../lib/scale.ts";
import { PAIRS, THEMES } from "./pairs.ts";
import { type Palettes, primitivePalette, semanticColor } from "./semantic.ts";

/** specs/001 T060: seed → 11-step OKLCH scale (golden values, gamut mapping, contrast pairs). */

const oklch = (color: string) => parse(color) as Oklch;
const inRgb = inGamut("rgb");
const inP3 = inGamut("p3");
const asPalette = (seed: string, kind: ScaleKind = "chromatic") =>
  Object.fromEntries(generateScale(seed, { kind }).map((s) => [String(s.step), s.value]));

/** Any CSS colour a user might pass as a seed, as oklch(): every hue, from grey to beyond P3. */
const seedArb = fc
  .record({
    l: fc.double({ min: 0.05, max: 0.98, noNaN: true }),
    c: fc.double({ min: 0, max: 0.4, noNaN: true }),
    h: fc.double({ min: 0, max: 359.9, noNaN: true }),
  })
  .map(({ l, c, h }) => `oklch(${(l * 100).toFixed(2)}% ${c.toFixed(4)} ${h.toFixed(2)})`);

describe("golden values", () => {
  it.each([
    ["neutral", "neutral"],
    ["brand", "chromatic"],
    ["accent", "chromatic"],
    ["success", "chromatic"],
    ["warning", "chromatic"],
    ["danger", "chromatic"],
    ["info", "chromatic"],
  ] as const)(
    "the target curve reproduces the default %s palette from its 500 step",
    (palette, kind) => {
      const steps = primitivePalette(palette);
      expect(targetScale(steps[5] ?? "", { kind })).toEqual(steps);
    },
  );

  it("generates the default brand scale (sRGB value, P3 value)", () => {
    expect(generateScale(REFERENCE_SEEDS.chromatic).map((s) => [s.step, s.value, s.p3])).toEqual([
      [50, "oklch(97.8% 0.01 255)", "oklch(97.8% 0.011 255)"],
      [100, "oklch(95.4% 0.022 255)", "oklch(95.4% 0.024 255)"],
      [200, "oklch(90.6% 0.046 255)", "oklch(90.6% 0.05 255)"],
      [300, "oklch(83.4% 0.083 255)", "oklch(83.5% 0.091 255)"],
      [400, "oklch(72.6% 0.144 255)", "oklch(72.7% 0.155 255)"],
      [500, "oklch(62.4% 0.19 255)", "oklch(62.4% 0.19 255)"],
      [600, "oklch(53.5% 0.176 255)", "oklch(53.5% 0.186 255)"],
      [700, "oklch(46% 0.151 255)", "oklch(46% 0.167 255)"],
      [800, "oklch(38.4% 0.126 255)", "oklch(38.4% 0.137 255)"],
      [900, "oklch(31% 0.102 255)", "oklch(31% 0.106 255)"],
      [950, "oklch(22.8% 0.075 255)", "oklch(22.8% 0.08 255)"],
    ]);
  });

  it("darkens a bright yellow seed's dark steps so they contrast like the reference", () => {
    expect(generateScale("#facc15").map((s) => [s.step, s.value, s.p3])).toEqual([
      [50, "oklch(97.8% 0.017 91.9)", "oklch(97.8% 0.017 91.9)"],
      [100, "oklch(95.4% 0.035 91.9)", "oklch(95.4% 0.035 91.9)"],
      [200, "oklch(90.7% 0.066 91.9)", "oklch(90.7% 0.066 91.9)"],
      [300, "oklch(83.5% 0.104 91.9)", "oklch(83.5% 0.104 91.9)"],
      [400, "oklch(72.7% 0.145 91.9)", "oklch(72.7% 0.145 91.9)"],
      [500, "oklch(62.1% 0.127 91.9)", "oklch(62.1% 0.146 91.9)"],
      [600, "oklch(53.1% 0.108 91.9)", "oklch(53.2% 0.125 91.9)"],
      [700, "oklch(45.7% 0.093 91.9)", "oklch(45.7% 0.107 91.9)"],
      [800, "oklch(38.1% 0.077 91.9)", "oklch(38.2% 0.09 91.9)"],
      [900, "oklch(30.8% 0.062 91.9)", "oklch(30.8% 0.072 91.9)"],
      [950, "oklch(22.6% 0.046 91.9)", "oklch(22.6% 0.053 91.9)"],
    ]);
  });

  it("keeps the default neutral palette as is (it already fits sRGB)", () => {
    expect(generateScale(REFERENCE_SEEDS.neutral, { kind: "neutral" }).map((s) => s.value)).toEqual(
      primitivePalette("neutral"),
    );
  });
});

describe("seeds", () => {
  it("accepts any CSS colour syntax", () => {
    const hues = ["#3b82f6", "rgb(59 130 246)", "hsl(217 91% 60%)", "oklch(62.3% 0.188 259.8)"].map(
      (seed) => oklch(generateScale(seed)[5]?.value ?? "").h ?? 0,
    );
    for (const h of hues) expect(h).toBeCloseTo(259.8, 0);
  });

  it("turns grey seeds into grey scales", () => {
    for (const seed of ["white", "#808080", "black", "oklch(50% 0.001 120)"]) {
      for (const s of generateScale(seed)) expect(oklch(s.value).c ?? 0).toBe(0);
    }
  });

  it("rejects invalid colours", () => {
    expect(() => generateScale("not-a-colour")).toThrow(/Invalid seed colour/);
  });
});

describe("properties (any seed)", () => {
  it("has 11 ordered steps with the seed's hue, getting darker step by step", () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const scale = generateScale(seed);
        expect(scale.map((s) => s.step)).toEqual([...STEPS]);
        const ls = scale.map((s) => oklch(s.value).l);
        for (let i = 1; i < ls.length; i++) expect(ls[i]).toBeLessThan(ls[i - 1] ?? 1);
        const hues = new Set(
          scale.map((s) => oklch(s.value).h ?? 0).filter((_, i) => oklch(scale[i]?.value ?? "").c),
        );
        expect(hues.size).toBeLessThanOrEqual(1);
      }),
    );
  });

  it("maps every step into sRGB (value) and Display P3 (p3), reducing chroma only", () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        for (const s of generateScale(seed)) {
          const srgb = oklch(s.value);
          const p3 = oklch(s.p3);
          expect(inRgb(srgb), `${s.step} ${s.value}`).toBe(true);
          expect(inP3(p3), `${s.step} ${s.p3}`).toBe(true);
          // sRGB never carries more chroma than the P3 value could at the same lightness
          const p3Max = (clampChroma({ ...srgb, c: 1 }, "oklch", "p3") as Oklch).c ?? 0;
          expect(srgb.c ?? 0).toBeLessThanOrEqual(p3Max + 1e-9);
        }
      }),
    );
  });

  it("moves lightness only towards safety: dark steps never lighter, light steps never darker", () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        for (const s of generateScale(seed)) {
          const l = oklch(s.value).l * 100;
          if (s.step >= 500) expect(l).toBeLessThanOrEqual(LIGHTNESS[s.step] + 1e-9);
          else expect(l).toBeGreaterThanOrEqual(LIGHTNESS[s.step] - 1e-9);
        }
      }),
    );
  });

  it("is deterministic", () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        expect(generateScale(seed)).toEqual(generateScale(seed));
      }),
    );
  });
});

describe("contrast pairs (SC-005: any seed, no AA failures)", () => {
  const failures = (palettes: Palettes) =>
    THEMES.flatMap((theme) =>
      PAIRS.flatMap(([fg, bg, min]) => {
        const ratio = wcagContrast(
          semanticColor(fg, theme, palettes),
          semanticColor(bg, theme, palettes),
        );
        return ratio < min ? [`${theme}: ${fg} on ${bg} = ${ratio.toFixed(2)} < ${min}`] : [];
      }),
    );

  it("the semantic pairs pass with the generated default scales", () => {
    expect(
      failures({
        brand: asPalette(REFERENCE_SEEDS.chromatic),
        neutral: asPalette(REFERENCE_SEEDS.neutral, "neutral"),
      }),
    ).toEqual([]);
  });

  it("every semantic pair passes in every theme for any brand seed", () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        expect(failures({ brand: asPalette(seed) })).toEqual([]);
      }),
      { numRuns: 300 },
    );
  });

  it("every semantic pair passes in every theme for any neutral seed", () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        expect(failures({ neutral: asPalette(seed, "neutral") })).toEqual([]);
      }),
      { numRuns: 300 },
    );
  });

  it.each([0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330])(
    "brand seeds at hue %d pass at every chroma",
    (h) => {
      for (const c of [0.05, 0.12, 0.2, 0.3, 0.37]) {
        expect(failures({ brand: asPalette(`oklch(60% ${c} ${h})`) }), `c ${c}`).toEqual([]);
      }
    },
  );
});
