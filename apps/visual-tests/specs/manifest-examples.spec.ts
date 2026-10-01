import { test } from "@playwright/test";
import {
  DIRS,
  expectNoAxeViolations,
  manifest,
  renderFixture,
  THEMES,
  WIDTHS,
} from "../harness/fixtures.ts";
import { expectScreenshot } from "../harness/screenshot.ts";
import { expectTargetSize } from "../harness/target-size.ts";

// Every documented example × theme × width × direction: zero axe violations, 24px targets, screenshot (§IV, §V).
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
              await expectTargetSize(page);
              await expectScreenshot(page.locator("main"), `${id}.png`);
            });
          }
        }
      }
    });
  });
}
