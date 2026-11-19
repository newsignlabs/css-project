import { test } from "@playwright/test";
import {
  expectNoAxeViolations,
  manifest,
  renderFixture,
  THEMES,
  WIDTHS,
} from "../harness/fixtures.ts";
import { expectScreenshot } from "../harness/screenshot.ts";
import { expectTargetSize } from "../harness/target-size.ts";

// specs/004 T010 — every documented example in every implemented design style × theme × width: zero axe violations
// (WCAG 2.2 AA), 24px targets, screenshot. A style counts as implemented once it overrides tokens or has recipes.
const STYLES = manifest.styles.filter((s) => s.tokens.length || s.recipes.length);

for (const style of STYLES) {
  test.describe(`style ${style.name}`, () => {
    for (const component of manifest.components) {
      component.examples.forEach((example, i) => {
        for (const theme of THEMES) {
          for (const width of WIDTHS) {
            const id = `${style.name}-${component.name}-${i}-${theme}-${width}`;
            test(`${component.name}: ${example.title} · ${theme} · ${width}px`, async ({
              page,
            }) => {
              await renderFixture(page, { html: example.html, theme, width, style: style.name });
              await expectNoAxeViolations(page);
              await expectTargetSize(page);
              await expectScreenshot(page.locator("main"), `${id}.png`);
            });
          }
        }
      });
    }
  });
}
