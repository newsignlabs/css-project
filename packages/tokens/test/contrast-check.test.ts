import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  apcaContrast,
  checkContrast,
  contrastFixCss,
  formatContrast,
  MINIMUMS,
  PAIRS,
  THEME_NAMES,
} from "../lib/contrast.ts";

/** specs/001 T062: build-time contrast checker (WCAG 2 + APCA) with error | warn | fix. */

describe("APCA (0.0.98G-4g reference values)", () => {
  it.each([
    ["#000", "#fff", 106.04],
    ["#fff", "#000", -107.88],
    ["#888", "#fff", 63.06],
    ["#fff", "#888", -68.54],
  ])("%s on %s → Lc %d", (fg, bg, lc) => {
    expect(apcaContrast(fg, bg)).toBeCloseTo(lc, 1);
  });

  it("returns 0 for (near-)identical colours and clips low contrast", () => {
    expect(apcaContrast("#777", "#777")).toBe(0);
    expect(apcaContrast("#fefefe", "#fff")).toBe(0);
  });
});

describe("checkContrast", () => {
  it("measures every pair in every theme with WCAG 2 and APCA", () => {
    const report = checkContrast();
    expect(report.level).toBe("AA");
    expect(report.results).toHaveLength(PAIRS.length * THEME_NAMES.length);
    for (const p of report.results) {
      expect(p.min).toBe(MINIMUMS.AA[p.kind]);
      expect(p.pass).toBe(p.ratio >= p.min);
      expect(Number.isFinite(p.lc)).toBe(true);
    }
  });

  it("passes AA with the default palettes (constitution §IV)", () => {
    expect(formatContrast(checkContrast())).toEqual([]);
  });

  it("passes AA for any brand seed (SC-005)", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 0.37, noNaN: true }),
        fc.double({ min: 0, max: 359, noNaN: true }),
        (c, h) => {
          const seed = `oklch(60% ${c.toFixed(3)} ${h.toFixed(1)})`;
          expect(checkContrast({ seeds: { brand: seed } }).failures).toEqual([]);
        },
      ),
      { numRuns: 40 },
    );
  });

  it("holds the high-contrast theme to AAA (7:1 text) as shipped (T064)", () => {
    const contrast = checkContrast({ level: "AAA" }).failures.filter((p) => p.theme === "contrast");
    expect(
      formatContrast({ level: "AAA", results: contrast, failures: contrast, fixes: [] }),
    ).toEqual([]);
  });

  it("reports AAA failures with the theme, pair, ratio and APCA Lc", () => {
    const report = checkContrast({ level: "AAA" });
    expect(report.failures.length).toBeGreaterThan(0);
    expect(report.fixes).toEqual([]);
    const link = report.failures.find(
      (p) => p.theme === "light" && p.fg === "color.text.link" && p.bg === "color.surface.subtle",
    );
    expect(link?.min).toBe(7);
    expect(formatContrast(report)).toContain(
      `light: color.text.link on color.surface.subtle ${link?.ratio.toFixed(2)}:1 < 7.00:1 (AAA, APCA Lc ${link?.lc.toFixed(1)})`,
    );
  });
});

describe("fix", () => {
  const report = checkContrast({ level: "AAA", fix: true });

  it("resolves every AAA failure by swapping tokens for the nearest passing palette colour", () => {
    expect(report.failures).toEqual([]);
    expect(report.fixes.length).toBeGreaterThan(0);
    expect(report.fixes).toContainEqual({
      theme: "light",
      token: "color.text.link",
      from: "{color.brand.600}",
      to: "{color.brand.800}",
    });
  });

  it("changes foregrounds first, backgrounds only where no foreground can pass", () => {
    // White on brand.600 cannot reach 7:1 by changing the text, so the fill darkens instead.
    expect(report.fixes).toContainEqual(
      expect.objectContaining({ theme: "light", token: "color.accent.default" }),
    );
    expect(
      report.fixes.find((f) => f.theme === "light" && f.token === "color.on-accent"),
    ).toBeUndefined();
  });

  it("fixes AAA for a seeded brand too, without regressing any pair", () => {
    const seeded = checkContrast({ level: "AAA", fix: true, seeds: { brand: "#facc15" } });
    const unfixed = checkContrast({ level: "AAA", seeds: { brand: "#facc15" } });
    expect(seeded.failures).toEqual([]);
    expect(seeded.fixes.length).toBeGreaterThan(0);
    expect(unfixed.failures.length).toBeGreaterThan(0);
  });

  it("does nothing when everything passes", () => {
    const aa = checkContrast({ fix: true });
    expect(aa.fixes).toEqual([]);
    expect(contrastFixCss(aa)).toBe("");
  });

  it("emits fixes for every theme rule with doubled specificity, in framework order", () => {
    const css = contrastFixCss(report);
    expect(css).toMatch(/^\/\* newBrush contrast fixes[^\n]*\n@layer nb\.tokens \{/);
    const light = css.indexOf('[data-nb-theme="light"][data-nb-theme="light"]');
    const dark = css.indexOf('[data-nb-theme="dark"][data-nb-theme="dark"]');
    const darkMedia = css.indexOf("@media (prefers-color-scheme: dark)");
    const contrast = css.indexOf(
      '\n  [data-nb-theme="contrast"][data-nb-theme="contrast"] {',
      darkMedia,
    );
    expect(light).toBeGreaterThan(0);
    expect(dark).toBeGreaterThan(light);
    expect(darkMedia).toBeGreaterThan(dark);
    expect(contrast).toBeGreaterThan(darkMedia);
    expect(css).toContain(":root:root:not([data-nb-theme])");
    expect(css).toContain("--nb-color-text-link: var(--nb-color-brand-800);");
  });
});
