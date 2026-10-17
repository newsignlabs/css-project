import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { expect, test } from "@playwright/test";

// T091 — @newbrush/fonts: linked after newbrush.css, the variable fonts load and fill the font.family tokens.
const require = createRequire(import.meta.url);
const href = (specifier: string) => pathToFileURL(require.resolve(specifier)).href;

/** Opens HTML from a file so its file:// stylesheets and fonts may load (about:blank pages cannot). */
async function open(page: import("@playwright/test").Page, html: string) {
  const file = test.info().outputPath("page.html");
  writeFileSync(file, html);
  await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
}

test("Inter, Fraunces and JetBrains Mono load and apply to the sans, serif and mono tokens", async ({
  page,
}) => {
  const failed: string[] = [];
  page.on("requestfailed", (r) => failed.push(r.url()));
  await open(
    page,
    `<!doctype html><html lang="en"><head><link rel="stylesheet" href="${href("newbrush/css")}">` +
      `<link rel="stylesheet" href="${href("@newbrush/fonts/fonts.css")}"></head>` +
      `<body><p id="sans">Sans <em>italic</em> <strong>bold</strong></p>` +
      `<p id="serif" style="font-family: var(--nb-font-family-serif)">Serif</p><code id="mono">mono()</code></body></html>`,
  );
  await page.evaluate(() => document.fonts.ready);
  const family = (sel: string) =>
    page.locator(sel).evaluate((el) => getComputedStyle(el).fontFamily);
  expect(await family("#sans")).toMatch(/^"Inter Variable", "Inter Fallback", system-ui/);
  expect(await family("#serif")).toMatch(/^"Fraunces Variable", "Fraunces Fallback"/);
  expect(await family("#mono")).toMatch(/^"JetBrains Mono Variable", "JetBrains Mono Fallback"/);
  const loaded = await page.evaluate(async () => {
    await Promise.all(
      [
        '1em "Inter Variable"',
        'italic 1em "Inter Variable"',
        '1em "Fraunces Variable"',
        '1em "JetBrains Mono Variable"',
      ].map((f) => document.fonts.load(f, "Aa")),
    );
    return [...document.fonts]
      .filter((f) => f.status === "loaded")
      .map((f) => `${f.family} ${f.style}`);
  });
  for (const face of [
    '"Inter Variable" normal',
    '"Inter Variable" italic',
    '"Fraunces Variable" normal',
    '"JetBrains Mono Variable" normal',
  ])
    expect(
      loaded.map((f) =>
        f.startsWith('"') ? f : `"${f.split(" ").slice(0, -1).join(" ")}" ${f.split(" ").at(-1)}`,
      ),
    ).toContain(face);
  // only the latin subsets were needed for this text
  const fetched = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((e) => e.name.split("/").pop() ?? "")
      .filter((n) => n.endsWith(".woff2")),
  );
  expect(
    fetched.every((n) => /-latin-wght-(normal|italic)\.woff2$/.test(n)),
    fetched.join(", "),
  ).toBe(true);
  expect(failed).toEqual([]);
});

test("without the package, newBrush keeps the system stack and downloads no fonts (FR-022)", async ({
  page,
}) => {
  await open(
    page,
    `<!doctype html><link rel="stylesheet" href="${href("newbrush/css")}"><p id="p">x</p>`,
  );
  expect(await page.locator("#p").evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(
    /^system-ui/,
  );
  expect(
    await page.evaluate(
      () =>
        performance.getEntriesByType("resource").filter((e) => e.name.endsWith(".woff2")).length,
    ),
  ).toBe(0);
});
