import { expect, type Page, test } from "@playwright/test";
import { PNG } from "pngjs";
import { manifest, renderFixture } from "../harness/fixtures.ts";

// specs/004 T020 (FR-013) — focus stays visible in every design style, including under clip-path (cyber) and glow
// (neon): the pixels that change by at least 3:1 when a control takes keyboard focus cover at least a 2 CSS px ring
// around it (WCAG 2.4.13; 75% of the box perimeter's ring, since anti-aliased pixels at rounded corners fall short of
// 3:1), and at least 80% of what the default style changes.

const STYLES = [
  "",
  ...manifest.styles.filter((s) => s.tokens.length || s.recipes.length).map((s) => s.name),
];
const html = `
  <div class="nb-cluster" style="padding: 24px">
    <button class="nb-btn" type="button" id="secondary">Secondary</button>
    <button class="nb-btn nb-btn--primary" type="button" id="primary">Primary</button>
    <input class="nb-input" id="input" aria-label="Name" style="inline-size: 12rem">
  </div>`;
const TARGETS = ["secondary", "primary", "input"] as const;
const PAD = 10;

const luminance = (r: number, g: number, b: number) => {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

/** Pixels around `id` that change by ≥ 3:1 when it takes keyboard focus, and the ring a 2 px indicator needs. */
async function focusChange(page: Page, id: string, tabs: number) {
  const box = await page.locator(`#${id}`).boundingBox();
  if (!box) throw new Error(`no box for #${id}`);
  const clip = {
    x: box.x - PAD,
    y: box.y - PAD,
    width: box.width + 2 * PAD,
    height: box.height + 2 * PAD,
  };
  const settle = () =>
    page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await settle();
  const before = PNG.sync.read(await page.screenshot({ clip }));
  for (let i = 0; i < tabs; i++) await page.keyboard.press("Tab");
  await settle();
  const after = PNG.sync.read(await page.screenshot({ clip }));
  let changed = 0;
  for (let i = 0; i < before.data.length; i += 4) {
    const a = luminance(before.data[i] ?? 0, before.data[i + 1] ?? 0, before.data[i + 2] ?? 0);
    const b = luminance(after.data[i] ?? 0, after.data[i + 1] ?? 0, after.data[i + 2] ?? 0);
    if ((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 3) changed++;
  }
  return { changed, ring: 2 * 2 * (box.width + box.height) };
}

const measure = async (page: Page, style: string, theme: "light" | "dark") => {
  const out: Record<string, { changed: number; ring: number }> = {};
  for (const [i, id] of TARGETS.entries()) {
    await renderFixture(page, { html, theme, ...(style ? { style } : {}) });
    out[id] = await focusChange(page, id, i + 1);
  }
  return out;
};

for (const theme of ["light", "dark"] as const) {
  test(`focus indicators stay visible in every style · ${theme}`, async ({ page }) => {
    test.setTimeout(60_000);
    const results: Record<string, Awaited<ReturnType<typeof measure>>> = {};
    for (const style of STYLES) results[style || "default"] = await measure(page, style, theme);
    const base = results.default;
    for (const [style, targets] of Object.entries(results))
      for (const id of TARGETS) {
        const { changed, ring } = targets[id] ?? { changed: 0, ring: 1 };
        expect(
          changed,
          `${style} #${id}: ${changed} px changed by ≥ 3:1, a 2 px ring is ${ring}`,
        ).toBeGreaterThanOrEqual(ring * 0.75);
        expect(changed, `${style} #${id} vs default ${base?.[id]?.changed}`).toBeGreaterThanOrEqual(
          (base?.[id]?.changed ?? 0) * 0.8,
        );
      }
  });
}
