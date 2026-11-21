import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page, test } from "@playwright/test";
import { expectNoAxeViolations, manifest } from "../harness/fixtures.ts";

// specs/001 T080–T081 — the docs site (apps/docs/dist, built by `pnpm build`) passes axe (WCAG 2.2 AA) in light
// and dark, and its theme picker drives newBrush's data-nb-theme.

const dist = fileURLToPath(new URL("../../docs/dist/", import.meta.url));
const origin = "http://docs.newbrush.test";
const types: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};

async function serveDocs(page: Page) {
  await page.route(`${origin}/**`, (route) => {
    let file = join(dist, decodeURIComponent(new URL(route.request().url()).pathname));
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file)) return route.fulfill({ status: 404, body: "not found" });
    return route.fulfill({
      contentType: types[extname(file)] ?? "application/octet-stream",
      body: readFileSync(file),
    });
  });
}

const pages = [
  "/",
  "/guides/getting-started/",
  "/components/",
  ...manifest.components.map((c) => `/components/${c.name}/`),
  "/reference/tokens/",
  "/reference/utilities/",
  "/reference/themes/",
  "/reference/styles/",
];

for (const scheme of ["light", "dark"] as const) {
  test.describe(`docs (${scheme})`, () => {
    test.use({ colorScheme: scheme });
    for (const path of pages) {
      test(`${path} has no axe violations`, async ({ page }) => {
        await serveDocs(page);
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto(origin + path);
        await expect(page.locator("html")).toHaveAttribute("data-nb-theme", scheme);
        await expectNoAxeViolations(page);
      });
    }
  });
}

test("the theme picker switches newBrush themes", async ({ page }) => {
  await serveDocs(page);
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto(`${origin}/components/button/`);
  const surface = () =>
    page.evaluate(() =>
      getComputedStyle(document.body).getPropertyValue("--nb-color-surface").trim(),
    );
  const light = await surface();
  await page.locator("starlight-theme-select select").first().selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-nb-theme", "dark");
  expect(await surface()).not.toBe(light);
  // Starlight's background follows the newBrush surface token.
  // (polled: the theme change repaints through a transition, near-instant under reduced motion).
  const probe = await page.evaluate(() => {
    const el = document.createElement("div");
    el.style.background = "var(--nb-color-surface)";
    document.body.append(el);
    const value = getComputedStyle(el).backgroundColor;
    el.remove();
    return value;
  });
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor))
    .toBe(probe);
});
