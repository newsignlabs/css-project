import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { manifest, renderFixture } from "../harness/fixtures.ts";

// specs/004 T008 — the default style is untouched: with no style class on the page, removing every design-style rule
// from newbrush.css changes no computed style of any element in the base page or any documented example.

const base = readFileSync(new URL("../fixtures/base.html", import.meta.url), "utf8");
const examples = manifest.components.flatMap((c) => c.examples.map((e) => e.html));
const html = [base, ...examples].join("\n");

/**
 * Every element's computed style (layout-free properties, so text metrics never matter), plus ::before/::after.
 * Running animations (e.g. the spinner) are frozen at their start so the two readings compare like for like.
 */
const signature = (page: Page) =>
  page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      animation.pause();
      animation.currentTime = 0;
    }
    const layout = /^(width|height|inline-size|block-size|.*-origin|d)$/;
    const read = (el: Element, pseudo?: string) => {
      const s = getComputedStyle(el, pseudo);
      const out: string[] = [];
      for (let i = 0; i < s.length; i++) {
        const name = s.item(i);
        if (!layout.test(name)) out.push(`${name}:${s.getPropertyValue(name)}`);
      }
      return out.join(";");
    };
    return [...document.querySelectorAll("*")].map(
      (el) => `${read(el)}|${read(el, "::before")}|${read(el, "::after")}`,
    );
  });

/** Deletes every rule (at any depth) whose selector mentions data-nb-style; returns how many. */
const removeStyleRules = (page: Page) =>
  page.evaluate(() => {
    let removed = 0;
    const walk = (list: CSSRuleList, owner: CSSStyleSheet | CSSGroupingRule) => {
      for (let i = list.length - 1; i >= 0; i--) {
        const rule = list[i];
        if (rule instanceof CSSStyleRule && rule.selectorText.includes("data-nb-style")) {
          owner.deleteRule(i);
          removed++;
        } else if (rule instanceof CSSGroupingRule) walk(rule.cssRules, rule);
      }
    };
    for (const sheet of document.styleSheets) walk(sheet.cssRules, sheet);
    return removed;
  });

for (const theme of ["light", "dark"] as const) {
  test(`no style class: style rules change nothing · ${theme}`, async ({ page }) => {
    await renderFixture(page, { html, theme });
    const before = await signature(page);
    expect(await removeStyleRules(page)).toBeGreaterThanOrEqual(7); // six styles + .style-default
    expect(await signature(page)).toEqual(before);
  });
}
