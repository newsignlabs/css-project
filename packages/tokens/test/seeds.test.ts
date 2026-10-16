import { readFile } from "node:fs/promises";
import type { ResolvedToken } from "@newbrush/schema";
import { inGamut, parse } from "culori";
import { beforeAll, describe, expect, it } from "vitest";
import { generateScale } from "../lib/scale.ts";
import {
  checkSeeds,
  DEFAULT_SEEDS,
  expandSeeds,
  palettes,
  SEEDABLE,
  seedTokensCss,
  tintFormula,
} from "../lib/seeds.ts";

/** specs/001 T061: palettes declared by seeds, expanded by the token build and by config `theme.seeds`. */

let tokens: ResolvedToken[];
let css: string;
beforeAll(async () => {
  tokens = JSON.parse(
    await readFile(new URL("../dist/tokens.json", import.meta.url), "utf8"),
  ).tokens;
  css = await readFile(new URL("../dist/css/tokens.css", import.meta.url), "utf8");
});

describe("default seeds", () => {
  it("declares a seed for every palette, and lets config replace brand, accent and neutral", () => {
    expect(Object.keys(DEFAULT_SEEDS)).toEqual([
      "neutral",
      "brand",
      "accent",
      "success",
      "warning",
      "danger",
      "info",
    ]);
    expect(SEEDABLE).toEqual(["brand", "accent", "neutral"]);
    expect(DEFAULT_SEEDS.neutral?.kind).toBe("neutral");
  });
});

describe("token build", () => {
  it.each(Object.entries(DEFAULT_SEEDS))("generates the %s palette from its seed", (name, spec) => {
    const built = tokens.filter(
      (t) => t.tier === "primitive" && t.path[0] === "color" && t.path[1] === name,
    );
    expect(built.map((t) => [t.path[2], t.value])).toEqual(
      generateScale(spec.color, { kind: spec.kind }).map((s) => [String(s.step), s.value]),
    );
    for (const t of built) expect(t.tier).toBe("primitive");
  });

  it("ships only sRGB-safe colours as token values", () => {
    const outside = tokens
      .filter((t) => t.type === "color")
      .flatMap((t) => [t.value, ...Object.values(t.themes)])
      .filter((v) => !inGamut("rgb")(parse(v) ?? "black"));
    expect(outside).toEqual([]);
  });

  it("adds the Display P3 values under @media (color-gamut: p3), only where they differ", () => {
    const blocks = [...css.matchAll(/@media \(color-gamut: p3\) \{([\s\S]*?)\n {2}\}/g)]
      .map((m) => m[1] ?? "")
      .join("\n");
    const wide = palettes({}, { all: true });
    const differing = Object.entries(wide).flatMap(([name, steps]) =>
      steps
        .filter((s) => s.p3 !== s.value)
        .map((s) =>
          (SEEDABLE as readonly string[]).includes(name)
            ? `--nb-color-${name}-${s.step}: var(--nb-tint-${name}-${s.step}, ${s.p3});`
            : `--nb-color-${name}-${s.step}: ${s.p3};`,
        ),
    );
    expect(differing.length).toBeGreaterThan(0);
    for (const line of differing) expect(blocks).toContain(line);
    expect(blocks.match(/--nb-color-/g)?.length).toBe(differing.length);
  });

  it("declares brand, accent and neutral re-tintable on the root and theme islands (T063)", () => {
    const steps = palettes({}, { all: true });
    expect(css).toContain(
      ":root,\n  ::backdrop,\n  [data-nb-theme] {\n    --nb-color-neutral-50: var(",
    );
    for (const name of SEEDABLE)
      for (const s of steps[name] ?? []) {
        expect(css).toContain(
          `--nb-color-${name}-${s.step}: var(--nb-tint-${name}-${s.step}, ${s.value});`,
        );
        expect(css).toContain(`--nb-tint-${name}-${s.step}: ${tintFormula(name, s.step)};`);
      }
    // status palettes stay static
    expect(css).not.toContain("--nb-tint-danger-");
    const supports = css.indexOf("@supports (color: oklch(from red l c h)) {");
    expect(supports).toBeGreaterThan(0);
    expect(css.indexOf("--nb-tint-brand-50: oklch(from")).toBeGreaterThan(supports);
  });
});

describe("expandSeeds", () => {
  it("replaces seeded groups with 11 steps and keeps everything else", () => {
    const tree = {
      color: {
        $type: "color",
        brand: {
          $description: "Brand",
          $extensions: { "nb.seed": { color: "red", kind: "chromatic" } },
        },
        white: { $value: "white" },
      },
    };
    const out = expandSeeds(tree, { brand: "oklch(60% 0.15 150)" });
    expect(out.color.white).toEqual({ $value: "white" });
    expect(out.color.$type).toBe("color");
    const brand = out.color.brand as unknown as Record<string, { $value: string }>;
    expect(brand.$description).toBe("Brand");
    expect(Object.keys(brand).filter((k) => !k.startsWith("$"))).toHaveLength(11);
    expect(brand["600"]?.$value).toBe(generateScale("oklch(60% 0.15 150)")[6]?.value);
    expect(tree.color.brand.$extensions["nb.seed"].color).toBe("red"); // input untouched
  });
});

describe("theme.seeds → CSS", () => {
  it("emits nothing without seeds", () => {
    expect(seedTokensCss()).toBe("");
    expect(seedTokensCss({})).toBe("");
  });

  it("re-tints every step of each seeded palette, sRGB first, P3 under the media query", () => {
    const out = seedTokensCss({ brand: "#16a34a" });
    const green = generateScale("#16a34a");
    expect(out).toMatch(/^\/\* newBrush theme\.seeds[\s\S]*@layer nb\.tokens \{/);
    expect(out).toContain(":root:root,\n  :root ::backdrop,\n  [data-nb-theme][data-nb-theme] {");
    for (const s of green) {
      expect(out).toContain(
        `--nb-color-brand-${s.step}: var(--nb-tint-brand-${s.step}, ${s.value});`,
      );
      expect(out).toContain(`--nb-color-brand-${s.step}: var(--nb-tint-brand-${s.step}, ${s.p3});`);
    }
    expect(out).not.toContain("@supports"); // the framework already declares the tint formulas
    expect(out.indexOf("@media (color-gamut: p3)")).toBeGreaterThan(
      out.indexOf(`--nb-color-brand-950: var(--nb-tint-brand-950, ${green[10]?.value})`),
    );
    expect(out).not.toContain("--nb-color-accent-");
    expect(out).not.toContain("--nb-color-neutral-");
  });

  it("generates neutral seeds with the neutral curve", () => {
    const out = seedTokensCss({ neutral: "oklch(60% 0.02 60)" });
    const steps = generateScale("oklch(60% 0.02 60)", { kind: "neutral" });
    expect(out).toContain(
      `--nb-color-neutral-600: var(--nb-tint-neutral-600, ${steps[6]?.value});`,
    );
  });

  it("rejects unknown seed names and invalid colours with config paths", () => {
    expect(checkSeeds({ brand: "#16a34a", accent: "oklch(60% 0.2 320)" })).toEqual([]);
    expect(checkSeeds({ primary: "red", brand: "nope", neutral: 3 })).toEqual([
      "theme.seeds.primary: unknown seed (expected brand, accent, neutral)",
      'theme.seeds.brand: "nope" is not a valid CSS colour',
      "theme.seeds.neutral: expected a CSS colour",
    ]);
    expect(() => seedTokensCss({ brand: "nope" })).toThrow(/theme\.seeds\.brand/);
  });
});
