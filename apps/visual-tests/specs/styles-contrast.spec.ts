import { MINIMUMS, PAIRS } from "@newbrush/tokens/contrast";
import { type Seeds, seedTokensCss } from "@newbrush/tokens/seeds";
import { expect, test } from "@playwright/test";
import { manifest, renderFixture } from "../harness/fixtures.ts";

// specs/004 T011 — every semantic pair (001 T062's PAIRS) meets WCAG AA in every implemented style × theme × brand seed,
// measured on what the browser paints: translucent surfaces are composited over the page, both plain and under the
// strongest ambient tint (g-morph's two glass tints stacked at full strength). Text placed straight on the page is
// checked against the page itself too.

const STYLES = [
  "",
  ...manifest.styles.filter((s) => s.tokens.length || s.recipes.length).map((s) => s.name),
];
const THEMES = ["light", "dark", "contrast"] as const;
const SEEDS: Record<string, Seeds> = {
  default: {},
  green: { brand: "oklch(70% 0.2 150)" },
  "yellow + magenta": { brand: "oklch(85% 0.17 95)", accent: "oklch(65% 0.25 330)" },
};
const cssVar = new Map(manifest.tokens.map((t) => [t.name, t.cssVar]));
const varOf = (name: string) => {
  const found = cssVar.get(name) ?? cssVar.get(`${name}.default`);
  if (!found) throw new Error(`No token ${name}`);
  return found;
};
const pairs = PAIRS.map((p) => ({
  ...p,
  fgVar: varOf(p.fg),
  bgVar: varOf(p.bg),
  min: MINIMUMS.AA[p.kind],
}));

interface Result {
  fg: string;
  bg: string;
  backdrop: string;
  ratio: number;
  min: number;
}

for (const style of STYLES) {
  for (const theme of THEMES) {
    for (const [seedName, seeds] of Object.entries(SEEDS)) {
      test(`${style || "default"} · ${theme} · ${seedName} seed`, async ({ page }) => {
        await renderFixture(page, {
          html: "",
          theme: theme === "contrast" ? "light" : theme,
          ...(style ? { style } : {}),
          extraCss: seedTokensCss(seeds),
        });
        if (theme === "contrast")
          await page.evaluate(() =>
            document.documentElement.setAttribute("data-nb-theme", "contrast"),
          );
        const failures = await page.evaluate((list) => {
          const ctx = document
            .createElement("canvas")
            .getContext("2d", { willReadFrequently: true });
          if (!ctx) throw new Error("no canvas");
          const main = document.querySelector("main") as HTMLElement;
          const probe = (declarations: string) => {
            const el = document.createElement("div");
            el.style.cssText = declarations;
            main.append(el);
            return getComputedStyle(el);
          };
          /** Paints colours over each other (alpha-compositing, as the browser does) and reads the sRGB result. */
          const paint = (colors: string[]) => {
            ctx.clearRect(0, 0, 1, 1);
            for (const c of colors) {
              ctx.fillStyle = "#010203";
              ctx.fillStyle = c;
              if (ctx.fillStyle === "#010203" && c !== "#010203")
                throw new Error(`canvas cannot parse ${c}`);
              ctx.fillRect(0, 0, 1, 1);
            }
            return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
          };
          const luminance = (rgb: number[]) => {
            const [r = 0, g = 0, b = 0] = rgb.map((v) => {
              const c = v / 255;
              return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
            });
            return 0.2126 * r + 0.7152 * g + 0.0722 * b;
          };
          const ratio = (a: number[], b: number[]) => {
            const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
            return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
          };
          // The page: the root's background colour, then any ambient tint layers.
          const surface = getComputedStyle(document.documentElement).backgroundColor;
          const tint = (n: number) =>
            probe(`background-color: var(--nb-glass-tint-${n}, transparent)`).backgroundColor;
          const backdrops: Record<string, string[]> = {
            page: [surface],
            tinted: [surface, tint(1), tint(2)],
          };
          const out: Result[] = [];
          for (const p of list) {
            const s = probe(`color: var(${p.fgVar}); background-color: var(${p.bgVar})`);
            for (const [name, layers] of Object.entries(backdrops)) {
              const bg = paint([...layers, s.backgroundColor]);
              const fg = paint([...layers, s.backgroundColor, s.color]);
              out.push({ fg: p.fg, bg: p.bg, backdrop: name, ratio: ratio(fg, bg), min: p.min });
              if (p.bg === "color.surface") {
                // Text straight on the page, with no surface of its own.
                const page = paint(layers);
                const onPage = paint([...layers, s.color]);
                out.push({
                  fg: p.fg,
                  bg: "page",
                  backdrop: name,
                  ratio: ratio(onPage, page),
                  min: p.min,
                });
              }
            }
          }
          return out.filter((r) => r.ratio + 0.01 < r.min);
        }, pairs);
        expect(
          failures.map(
            (f) => `${f.fg} on ${f.bg} (${f.backdrop}): ${f.ratio.toFixed(2)} < ${f.min}`,
          ),
        ).toEqual([]);
      });
    }
  }
}
