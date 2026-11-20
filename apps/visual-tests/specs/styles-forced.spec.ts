import { expect, type Page, test } from "@playwright/test";
import { manifest, renderFixture } from "../harness/fixtures.ts";

// specs/004 T019 (FR-012) — under forced colors, the contrast theme and prefers-contrast: more, every design style
// drops its decorative effects (blur, glow, notches, scanlines, ambient backgrounds, animation): the components'
// decoration is exactly the default style's in the same context.

const STYLES = manifest.styles.filter((s) => s.tokens.length || s.recipes.length);
const html = `
  <h1>Heading</h1>
  <div class="nb-card"><div class="nb-card__body">
    <p>Card</p>
    <button class="nb-btn nb-btn--primary" type="button">Primary</button>
    <button class="nb-btn" type="button">Secondary</button>
  </div></div>
  <nav class="nb-navbar"><a class="nb-navbar__brand" href="#x">Brand</a></nav>`;

const CONTEXTS: Record<string, (page: Page) => Promise<void>> = {
  "forced colors": (page) => page.emulateMedia({ forcedColors: "active" }),
  "contrast theme": (page) =>
    page.evaluate(() => document.documentElement.setAttribute("data-nb-theme", "contrast")),
  "prefers-contrast: more": (page) => page.emulateMedia({ contrast: "more" }),
};

/** The decoration of each component, plus the page-level effects, once the (near-instant) transitions have settled. */
const decoration = (page: Page) =>
  page.evaluate(async () => {
    await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined)));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const pick = (selector: string) => {
      const s = getComputedStyle(document.querySelector(selector) as Element);
      return {
        backdrop: s.backdropFilter,
        clip: s.clipPath,
        textShadow: s.textShadow,
        animation: s.animationName,
      };
    };
    const after = getComputedStyle(document.body, "::after");
    return {
      h1: pick("h1"),
      card: pick(".nb-card"),
      primary: {
        ...pick(".nb-btn--primary"),
        shadow: getComputedStyle(document.querySelector(".nb-btn--primary") as Element).boxShadow,
      },
      secondary: pick(".nb-btn:not(.nb-btn--primary)"),
      navbar: pick(".nb-navbar"),
      ambient: getComputedStyle(document.documentElement).backgroundImage,
      overlay:
        after.content === "none" || after.content === "normal" ? "none" : after.backgroundImage,
    };
  });

for (const [context, apply] of Object.entries(CONTEXTS)) {
  for (const style of STYLES) {
    test(`${style.name} · ${context}: no decorative effects`, async ({ page }) => {
      await renderFixture(page, { html, theme: "auto" });
      await apply(page);
      const expected = await decoration(page);
      await renderFixture(page, { html, theme: "auto", style: style.name });
      await apply(page);
      expect(await decoration(page)).toEqual(expected);
    });
  }
}
