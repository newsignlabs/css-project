import { checkContrast, contrastFixCss } from "@newbrush/tokens/contrast";
import { expect, test } from "@playwright/test";
import { customProperty, renderFixture } from "../harness/fixtures.ts";

// T062 — contrast fixes apply in exactly the themes they were computed for, including OS dark mode and islands.
const report = checkContrast({ level: "AAA", fix: true });
const extraCss = contrastFixCss(report);
const fixed = (theme: string, token: string) =>
  report.fixes.find((f) => f.theme === theme && f.token === token)?.to;
const varOf = (alias = "") => `var(--nb-${alias.slice(1, -1).replaceAll(".", "-")})`;

/** The token's value expressed as the var() it points at, read through a probe element. */
async function pointsAt(
  page: import("@playwright/test").Page,
  selector: string,
  prop: string,
  alias: string,
) {
  const actual = await customProperty(page, selector, prop);
  const expected = await page.evaluate(
    ({ sel, value }) => {
      const probe = document.createElement("i");
      probe.style.setProperty("--probe", value);
      document.querySelector(sel)?.append(probe);
      const resolved = getComputedStyle(probe).getPropertyValue("--probe").trim();
      probe.remove();
      return resolved;
    },
    { sel: selector, value: varOf(alias) },
  );
  expect(actual, `${selector} ${prop}`).toBe(expected);
}

test("fixes exist for AAA and resolve every failure", () => {
  expect(report.fixes.length).toBeGreaterThan(0);
  expect(report.failures).toEqual([]);
});

test("light and dark fixes apply to their own theme only", async ({ page }) => {
  const light = fixed("light", "color.text.link");
  const dark = fixed("dark", "color.text.link");
  expect(light).toBeDefined();
  expect(dark).toBeDefined();
  await renderFixture(page, {
    theme: "light",
    extraCss,
    html: `<p id="l">light</p><section id="d" data-nb-theme="dark"><p id="dd">dark island</p>
             <div id="ll" data-nb-theme="light">light again</div></section>`,
  });
  await pointsAt(page, "#l", "--nb-color-text-link", light ?? "");
  await pointsAt(page, "#dd", "--nb-color-text-link", dark ?? "");
  await pointsAt(page, "#ll", "--nb-color-text-link", light ?? "");
});

test.describe("OS dark mode", () => {
  test.use({ colorScheme: "dark" });
  test("uses the dark fix without a theme attribute", async ({ page }) => {
    await renderFixture(page, { theme: "auto", extraCss, html: "<p id='p'>auto</p>" });
    await pointsAt(page, "#p", "--nb-color-text-link", fixed("dark", "color.text.link") ?? "");
  });
});

test("a token fixed only in dark keeps its framework value in light", async ({ page }) => {
  // color.on-accent is replaced in dark (→ black) but not in light at AAA.
  expect(fixed("dark", "color.on-accent")).toBeDefined();
  expect(fixed("light", "color.on-accent")).toBeUndefined();
  await renderFixture(page, { theme: "light", extraCss, html: "<p id='p'>x</p>" });
  await pointsAt(page, "#p", "--nb-color-on-accent", "{color.white}");
});
