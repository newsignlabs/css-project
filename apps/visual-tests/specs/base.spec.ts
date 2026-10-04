import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { DIRS, expectNoAxeViolations, renderFixture, THEMES, WIDTHS } from "../harness/fixtures.ts";
import { expectScreenshot } from "../harness/screenshot.ts";
import { expectTargetSize } from "../harness/target-size.ts";

const html = readFileSync(new URL("../fixtures/base.html", import.meta.url), "utf8");

// T017 — base typography/forms/tables: axe, target size and visual snapshot per theme × width × direction.
for (const theme of THEMES) {
  for (const width of WIDTHS) {
    for (const dir of DIRS) {
      test(`base page · ${theme} · ${width}px · ${dir}`, async ({ page }) => {
        await renderFixture(page, { html, theme, width, dir });
        await expectNoAxeViolations(page);
        await expectTargetSize(page);
        await expectScreenshot(page, `base-${theme}-${width}-${dir}.png`, { fullPage: true });
      });
    }
  }
}

test("base styles come from tokens", async ({ page }) => {
  await renderFixture(page, { html });
  const root = await page.locator("html").evaluate((el) => {
    const s = getComputedStyle(el);
    return { font: s.fontFamily, bg: s.backgroundColor };
  });
  expect(root.font).toContain("system-ui");
  expect(root.bg).not.toBe("rgba(0, 0, 0, 0)");
  const h1 = await page
    .locator("h1")
    .evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));
  const p = await page
    .locator("p")
    .first()
    .evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));
  expect(h1).toBeGreaterThan(p * 2);
});

test('lists with role="list" have no marker or indent (reset is not undone by base styles)', async ({
  page,
}) => {
  await renderFixture(page, { html: '<ul role="list"><li>One</li></ul><ul><li>Two</li></ul>' });
  const [plain, styled] = await page
    .locator("ul")
    .evaluateAll((els) => els.map((el) => getComputedStyle(el).paddingInlineStart));
  expect(plain).toBe("0px");
  expect(styled).not.toBe("0px");
});
