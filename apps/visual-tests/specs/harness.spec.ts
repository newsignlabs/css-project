import { expect, test } from "@playwright/test";
import {
  customProperty,
  expectNoAxeViolations,
  manifest,
  renderFixture,
} from "../harness/fixtures.ts";

test("manifest is loaded from the built newbrush package", () => {
  expect(manifest.name).toBe("newbrush");
  expect(manifest.layers[0]).toBe("nb.reset");
});

test("tokens resolve on the root element", async ({ page }) => {
  await renderFixture(page, { html: "<h1>newBrush</h1>" });
  expect(await customProperty(page, "html", "--nb-scheme")).toBe("light");
  expect(await customProperty(page, "html", "--nb-color-surface")).toMatch(
    /^oklch\(97\.8% 0?\.002 260\)$/,
  );
});

test("an empty page has no axe violations", async ({ page }) => {
  await renderFixture(page, { html: "<h1>newBrush</h1><p>Hello.</p>" });
  await expectNoAxeViolations(page);
});
