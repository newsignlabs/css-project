import { expect, type Page, test } from "@playwright/test";
import { manifest, renderFixture } from "../harness/fixtures.ts";

// specs/004 T018 — motion in design styles: with prefers-reduced-motion nothing animates (glitch, flicker, pulse,
// scanline drift); when motion is allowed, every animation is finite and only moves or clips (transform, translate,
// clip-path), so nothing flashes (no colour, opacity or filter change: well under 3 flashes per second).

const STYLES = manifest.styles.filter((s) => s.tokens.length || s.recipes.length);
const html = `
  <div class="nb-cluster">
    <button class="nb-btn" type="button">Secondary</button>
    <button class="nb-btn nb-btn--primary" type="button">Primary</button>
    <a class="nb-btn nb-btn--ghost" href="#x">Ghost</a>
  </div>
  <div class="nb-card"><div class="nb-card__body"><input class="nb-input" aria-label="Name"></div></div>`;

const MOVES = new Set(["transform", "translate", "rotate", "scale", "clipPath", "offsetDistance"]);

/** Hovers and focuses every control, then reports the CSS animations running on the page. */
async function exercise(page: Page) {
  const found: { name: string; properties: string[]; iterations: number }[] = [];
  const collect = () =>
    page.evaluate(() =>
      document
        .getAnimations()
        .filter((a): a is CSSAnimation => a instanceof CSSAnimation)
        .map((a) => {
          const effect = a.effect as KeyframeEffect;
          const properties = new Set(
            effect
              .getKeyframes()
              .flatMap((k) => Object.keys(k))
              .filter((k) => !["offset", "computedOffset", "easing", "composite"].includes(k)),
          );
          return {
            name: a.animationName,
            properties: [...properties],
            iterations: Number(effect.getTiming().iterations ?? 1),
          };
        }),
    );
  for (const control of await page.locator(".nb-btn, .nb-input").all()) {
    await control.hover();
    found.push(...(await collect()));
    await control.focus();
    found.push(...(await collect()));
  }
  return found;
}

for (const style of STYLES) {
  test(`${style.name}: nothing animates with prefers-reduced-motion`, async ({ page }) => {
    await renderFixture(page, { html, style: style.name }); // the fixture emulates reduced motion
    expect(await exercise(page)).toEqual([]);
  });

  test(`${style.name}: with motion allowed, animations are finite and only move or clip (no flashing)`, async ({
    page,
  }) => {
    await renderFixture(page, { html, style: style.name });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    for (const animation of await exercise(page)) {
      expect(Number.isFinite(animation.iterations), animation.name).toBe(true);
      for (const property of animation.properties)
        expect(MOVES.has(property), `${animation.name} animates ${property}`).toBe(true);
    }
  });
}

test("cyber's glitch runs on hover when motion is allowed (the checks above are not vacuous)", async ({
  page,
}) => {
  await renderFixture(page, { html, style: "cyber" });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const names = (await exercise(page)).map((a) => a.name);
  expect(names).toContain("nb-cyber-glitch");
});
