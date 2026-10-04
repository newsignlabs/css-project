import { expect, test } from "@playwright/test";
import { renderFixture } from "../harness/fixtures.ts";

// T018 — unlayered consumer CSS beats newBrush without !important (FR-006, US1 scenario 4).
test("unlayered consumer override wins without !important", async ({ page }) => {
  await renderFixture(page, {
    html: '<button class="nb-btn nb-btn--primary" type="button">Save</button>',
    extraCss: ".nb-btn { border-radius: 0; }",
  });
  const radius = await page
    .locator(".nb-btn")
    .evaluate((el) => getComputedStyle(el).borderStartStartRadius);
  expect(radius).toBe("0px");
});

test("newBrush styles apply when not overridden", async ({ page }) => {
  await renderFixture(page, {
    html: '<button class="nb-btn nb-btn--primary" type="button">Save</button>',
  });
  const radius = await page
    .locator(".nb-btn")
    .evaluate((el) => getComputedStyle(el).borderStartStartRadius);
  expect(radius).not.toBe("0px");
});
