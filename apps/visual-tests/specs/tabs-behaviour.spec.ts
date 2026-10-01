import { expect, test } from "@playwright/test";
import { manifest, renderFixture } from "../harness/fixtures.ts";

// CSS-only tabs: the checked radio decides which panel is visible (nb-tabs).
const tabs = manifest.components.find((c) => c.name === "tabs");

test("each tab shows exactly its own panel", async ({ page }) => {
  if (!tabs) throw new Error("tabs component missing from manifest");
  await renderFixture(page, { html: tabs.examples[0]?.html ?? "" });
  const labels = page.locator(".nb-tabs__tab");
  const panels = page.locator(".nb-tabs__panel");
  const count = await labels.count();
  expect(count).toBe(await panels.count());
  for (let i = 0; i < count; i++) {
    await labels.nth(i).click();
    for (let j = 0; j < count; j++) {
      if (i === j) await expect(panels.nth(j)).toBeVisible();
      else await expect(panels.nth(j)).toBeHidden();
    }
  }
});

test("keyboard arrows move between tabs and switch panels", async ({ page }) => {
  await renderFixture(page, { html: tabs?.examples[0]?.html ?? "" });
  await page.locator(".nb-tabs__tab input").first().focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".nb-tabs__panel").nth(1)).toBeVisible();
  await expect(page.locator(".nb-tabs__panel").nth(0)).toBeHidden();
});
