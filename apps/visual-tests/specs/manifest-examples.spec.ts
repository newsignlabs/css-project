import { expect, test } from "@playwright/test";
import {
  DIRS,
  expectNoAxeViolations,
  manifest,
  renderFixture,
  THEMES,
  WIDTHS,
} from "../harness/fixtures.ts";

// Every documented example × theme × width × direction: zero axe violations + screenshot (constitution §IV, §V).
for (const component of manifest.components) {
  test.describe(component.name, () => {
    component.examples.forEach((example, i) => {
      for (const theme of THEMES) {
        for (const width of WIDTHS) {
          for (const dir of DIRS) {
            const id = `${component.name}-${i}-${theme}-${width}-${dir}`;
            test(`${example.title} · ${theme} · ${width}px · ${dir}`, async ({ page }) => {
              await renderFixture(page, { html: example.html, theme, width, dir });
              await expectNoAxeViolations(page);
              await expect(page.locator("main")).toHaveScreenshot(`${id}.png`);
            });
          }
        }
      }
    });
  });
}
