import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page, test } from "@playwright/test";
import { expectNoAxeViolations, manifest } from "../harness/fixtures.ts";

// specs/001 T080–T081 — the docs site (apps/docs/dist, built by `pnpm build`) passes axe (WCAG 2.2 AA) in light
// and dark, and its theme picker drives newBrush's data-nb-theme.

const dist = fileURLToPath(new URL("../../docs/dist/", import.meta.url));
const origin = "http://docs.newbrush.test";
const base = "/site"; // apps/docs builds for /site/ (served from the repository root on Catalyst Slate)
const types: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};

async function serveDocs(page: Page) {
  await page.route(`${origin}/**`, (route) => {
    const path = decodeURIComponent(new URL(route.request().url()).pathname);
    if (!path.startsWith(`${base}/`))
      return route.fulfill({ status: 404, body: "outside the site" });
    let file = join(dist, path.slice(base.length));
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
  "/guides/cdn/",
  "/guides/bundlers/",
  "/guides/theming/",
  "/guides/from-other-frameworks/",
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
        await page.goto(origin + base + path);
        await expect(page.locator("html")).toHaveAttribute("data-nb-theme", scheme);
        await expectNoAxeViolations(page);
      });
    }
  });
}

test("the theme picker switches newBrush themes", async ({ page }) => {
  await serveDocs(page);
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto(`${origin}${base}/components/button/`);
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

test("an example's toolbar switches theme, style, direction and width (T082)", async ({ page }) => {
  await serveDocs(page);
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto(`${origin}${base}/components/button/`);
  const example = page.locator("nb-example").first();
  const preview = example.locator(".nb-docs-preview");
  const primary = preview.locator(".nb-btn--primary").first();
  const bg = () => primary.evaluate((el) => getComputedStyle(el).backgroundColor);
  await expect(example.locator(".nb-docs-toolbar")).toBeVisible();

  const light = await bg();
  await example.getByLabel("Theme").selectOption("dark");
  await expect(preview).toHaveAttribute("data-nb-theme", "dark");
  await expect.poll(bg).not.toBe(light);
  await example.getByLabel("Theme").selectOption("");
  await expect(preview).not.toHaveAttribute("data-nb-theme", /.*/);

  await example.getByLabel("Style").selectOption("neon");
  await expect(preview).toHaveAttribute("data-nb-style", "neon");
  expect(
    await primary.evaluate((el) => getComputedStyle(el).getPropertyValue("--nb-style").trim()),
  ).toBe("neon");

  const rtl = example.getByRole("button", { name: "Right to left" });
  await rtl.click();
  await expect(preview).toHaveAttribute("dir", "rtl");
  await expect(rtl).toHaveAttribute("aria-pressed", "true");
  await rtl.click();
  await expect(preview).not.toHaveAttribute("dir", /.*/);

  await example.getByLabel("Width").selectOption("360");
  await expect
    .poll(() => preview.evaluate((el) => el.getBoundingClientRect().width))
    .toBeLessThanOrEqual(360);
});

test("Copy HTML copies the example's markup (T082)", async ({ page }) => {
  // A stub clipboard: the real one needs permissions that differ per engine.
  await page.addInitScript(() => {
    const copied: string[] = [];
    Object.defineProperty(window, "__copied", { value: copied });
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: async (text: string) => void copied.push(text) },
    });
  });
  await serveDocs(page);
  await page.goto(`${origin}${base}/components/button/`);
  const example = page.locator("nb-example").first();
  await example.getByRole("button", { name: "Copy HTML" }).click();
  await expect(example.getByRole("status")).toHaveText("Copied");
  const button = manifest.components.find((c) => c.name === "button");
  expect(await page.evaluate(() => (window as unknown as { __copied: string[] }).__copied)).toEqual(
    [button?.examples[0]?.html],
  );
});

test('searching "button" finds the button page and the tokens (US6 acceptance 1)', async ({
  page,
}) => {
  await serveDocs(page);
  await page.goto(`${origin}${base}/index.html`);
  await page.getByRole("button", { name: "Search" }).first().click();
  await page.locator("#starlight__search input").fill("button");
  const results = page.locator("#starlight__search a[href]");
  await expect(results.first()).toHaveAttribute("href", `${base}/components/button/index.html`);
  // The UI lists five pages before "Load more"; the full result list comes from Pagefind's API.
  const urls = await page.evaluate(async (bundle) => {
    const pagefind = await import(bundle);
    const search = await pagefind.search("button");
    const pages = await Promise.all(
      search.results.map((r: { data: () => Promise<{ url: string }> }) => r.data()),
    );
    return pages.map((p) => p.url);
  }, `${base}/pagefind/pagefind.js`);
  expect(urls[0]).toBe(`${base}/components/button/index.html`);
  expect(urls).toContain(`${base}/reference/tokens/index.html`);
});
