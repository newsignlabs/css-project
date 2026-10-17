import { palettes, seedTokensCss, tintFormula } from "@newbrush/tokens/seeds";
import { expect, type Page, test } from "@playwright/test";
import { renderFixture } from "../harness/fixtures.ts";

// T063 — runtime re-tint: setting --nb-color-brand-seed re-tints components without a build step.

/** An element's background colour as 0–255 sRGB channels (format-independent across engines). */
async function rgb(page: Page, selector: string): Promise<number[]> {
  return page.locator(selector).evaluate((el) => {
    const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    if (!ctx) return [];
    ctx.fillStyle = getComputedStyle(el).backgroundColor;
    ctx.fillRect(0, 0, 1, 1);
    return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
  });
}
/** The sRGB channels the browser computes for a CSS colour expression. */
async function expected(page: Page, color: string): Promise<number[]> {
  await page.evaluate((c) => {
    const probe = document.createElement("i");
    probe.id = "probe";
    probe.style.background = c;
    document.body.append(probe);
  }, color);
  const value = await rgb(page, "#probe");
  await page.evaluate(() => document.getElementById("probe")?.remove());
  return value;
}
const close = (a: number[], b: number[]) => a.every((v, i) => Math.abs(v - (b[i] ?? 0)) <= 2);
const tint = (seed: string, step: 50 | 400 | 600) =>
  tintFormula("brand", step).replace("var(--nb-color-brand-seed)", seed);

const GREEN = "oklch(70% 0.2 150)";
/** The shipped (gamut-mapped, contrast-guarded) default brand.600. */
const BLUE_600 = palettes({}, { all: true }).brand?.[6]?.value ?? "";
const html = `
  <button id="root" class="nb-btn nb-btn--primary">root</button>
  <aside id="island" data-nb-theme="dark" style="--nb-color-brand-seed: ${GREEN}">
    <button id="dark" class="nb-btn nb-btn--primary">dark island</button>
    <section data-nb-theme="light"><button id="nested" class="nb-btn nb-btn--primary">nested</button></section>
  </aside>
  <div style="--nb-color-brand-seed: ${GREEN}"><button id="plain" class="nb-btn nb-btn--primary">no theme</button></div>`;

test("without a seed the shipped (gamut-mapped, contrast-guarded) palette applies", async ({
  page,
}) => {
  await renderFixture(page, { html, theme: "light" });
  expect(close(await rgb(page, "#root"), await expected(page, BLUE_600))).toBe(true);
});

test("a seed on a theme island re-tints it and everything nested, in that island's theme", async ({
  page,
}) => {
  await renderFixture(page, { html, theme: "light" });
  // dark accent is brand.400, light accent brand.600 — both from the green seed
  expect(close(await rgb(page, "#dark"), await expected(page, tint(GREEN, 400)))).toBe(true);
  expect(close(await rgb(page, "#nested"), await expected(page, tint(GREEN, 600)))).toBe(true);
  // the root and an element without data-nb-theme keep the static palette
  const blue = await expected(page, BLUE_600);
  expect(close(await rgb(page, "#root"), blue)).toBe(true);
  expect(close(await rgb(page, "#plain"), blue)).toBe(true);
});

test("setting the seed on :root at runtime re-tints the page live", async ({ page }) => {
  await renderFixture(page, { html, theme: "light" });
  // Buttons transition their background (0.01 ms under reduced motion), so wait for the settled colour.
  const yellow = await expected(page, tint("#facc15", 600));
  const blue = await expected(page, BLUE_600);
  await page.evaluate(() =>
    document.documentElement.style.setProperty("--nb-color-brand-seed", "#facc15"),
  );
  await expect.poll(async () => close(await rgb(page, "#root"), yellow)).toBe(true);
  await page.evaluate(() => document.documentElement.style.removeProperty("--nb-color-brand-seed"));
  await expect.poll(async () => close(await rgb(page, "#root"), blue)).toBe(true);
});

test("theme.seeds palettes reach theme islands, and a runtime seed still overrides them", async ({
  page,
}) => {
  const red = "oklch(60% 0.2 25)";
  await renderFixture(page, {
    theme: "light",
    extraCss: seedTokensCss({ brand: red }),
    html: `${html}<section data-nb-theme="dark"><button id="seededDark" class="nb-btn nb-btn--primary">x</button></section>`,
  });
  const redScale = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--nb-color-brand-600").trim(),
  );
  expect(redScale).not.toContain("255"); // not the default blue hue
  expect(close(await rgb(page, "#root"), await expected(page, redScale))).toBe(true);
  // a dark island without a runtime seed uses the seeded (red) brand.400, not the framework default
  const red400 = await page
    .locator("#seededDark")
    .evaluate((el) => getComputedStyle(el).getPropertyValue("--nb-color-brand-400").trim());
  expect(red400).not.toContain("255");
  // the island with a runtime seed is still green
  expect(close(await rgb(page, "#dark"), await expected(page, tint(GREEN, 400)))).toBe(true);
});
