import { expect, test } from "@playwright/test";
import { manifest, renderFixture } from "../harness/fixtures.ts";

// The general suite asserts the settled state under reduced motion; these tests cover motion itself.
const modal = manifest.components.find((c) => c.name === "modal")?.examples[0]?.html ?? "";
const transition = (page: import("@playwright/test").Page) =>
  page.locator(".nb-modal").evaluate((el) => getComputedStyle(el).transitionProperty);

test("modal fades in when motion is allowed", async ({ page }) => {
  await renderFixture(page, { html: modal });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  expect(await transition(page)).toContain("opacity");
});

test("modal does not animate under prefers-reduced-motion", async ({ page }) => {
  await renderFixture(page, { html: modal });
  expect(await transition(page)).not.toContain("opacity");
});
