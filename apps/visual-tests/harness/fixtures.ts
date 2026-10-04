import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import AxeBuilder from "@axe-core/playwright";
import type { Manifest } from "@newbrush/schema";
import { expect, type Page } from "@playwright/test";

const require = createRequire(import.meta.url);
const css = readFileSync(require.resolve("newbrush/css"), "utf8");

export const manifest: Manifest = JSON.parse(
  readFileSync(require.resolve("newbrush/manifest.json"), "utf8"),
);

export type Theme = "light" | "dark";
export type Dir = "ltr" | "rtl";
export const THEMES: Theme[] = ["light", "dark"];
export const WIDTHS = [360, 768, 1280] as const;
export const DIRS: Dir[] = ["ltr", "rtl"];

export interface FixtureOptions {
  html: string;
  theme?: Theme | "auto";
  dir?: Dir;
  width?: number;
  /** Extra CSS appended after newBrush (unlayered, like consumer CSS). */
  extraCss?: string;
}

/** Renders HTML with the built newbrush.css inlined (no server needed). */
export async function renderFixture(page: Page, opts: FixtureOptions): Promise<void> {
  const { html, theme = "light", dir = "ltr", width = 1280, extraCss = "" } = opts;
  await page.setViewportSize({ width, height: 800 });
  // Assert the settled state: newBrush disables transitions (e.g. the modal fade-in) under reduced motion, so axe never
  // measures half-transparent mid-transition colors. Motion itself is covered by dedicated tests.
  await page.emulateMedia({ reducedMotion: "reduce" });
  const themeAttr = theme === "auto" ? "" : ` data-nb-theme="${theme}"`;
  await page.setContent(
    `<!doctype html><html lang="en" dir="${dir}"${themeAttr}><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width, initial-scale=1"><title>newBrush fixture</title>` +
      `<style>${css}</style><style>${extraCss}</style></head><body><main>${html}</main></body></html>`,
  );
}

/** axe-core with WCAG 2.2 AA rules enabled (incl. target-size) — constitution §IV. */
export async function expectNoAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  const summary = results.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
  );
  expect(summary).toEqual([]);
}

/** Reads a resolved custom property from an element. */
export function customProperty(page: Page, selector: string, prop: string): Promise<string> {
  return page
    .locator(selector)
    .evaluate((el, p) => getComputedStyle(el).getPropertyValue(p).trim(), prop);
}
