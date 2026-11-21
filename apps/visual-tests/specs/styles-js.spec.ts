import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { expect, test } from "@playwright/test";

// specs/004 T031 — @newbrush/js in a real page with the real stylesheet: setStyle() switches the page's style,
// getStyle() reads the --nb-style marker, and a persisted choice is restored.

const require = createRequire(import.meta.url);
const code = readFileSync(require.resolve("@newbrush/js"), "utf8");
const css = readFileSync(require.resolve("newbrush/css"), "utf8");

test("setStyle switches the style, getStyle reads it, restoreStyle brings it back", async ({
  page,
}) => {
  // A real origin (about:blank has no localStorage, which persistence needs).
  await page.route("http://newbrush.test/", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html lang="en" data-nb-theme="light"><head><style>${css}</style></head><body><div class="nb-card" id="card"><div class="nb-card__body">x</div></div></body></html>`,
    }),
  );
  await page.goto("http://newbrush.test/");
  await page.addScriptTag({
    type: "module",
    content: `${code}\nwindow.__nb = { setStyle, getStyle, restoreStyle };`,
  });
  await page.waitForFunction(() => "__nb" in window);
  type Api = {
    setStyle: (n: string | null, o?: object) => Promise<void>;
    getStyle: (el?: Element) => string | null;
    restoreStyle: () => string | null;
  };
  const run = <T>(fn: (nb: Api) => T | Promise<T>) =>
    page.evaluate(`(${fn.toString()})(window.__nb)`) as Promise<T>;

  expect(await run((nb) => nb.getStyle())).toBeNull();
  await run((nb) => nb.setStyle("neon", { persist: true }));
  expect(await run((nb) => nb.getStyle(document.getElementById("card") as Element))).toBe("neon");
  expect(await page.evaluate(() => getComputedStyle(document.body).colorScheme)).toBe("light");

  await run((nb) => nb.setStyle("neumorph", { transition: true }));
  expect(await page.evaluate(() => document.body.className)).toBe("n-morph");
  expect(await run((nb) => nb.getStyle())).toBe("n-morph");

  await page.evaluate(() => {
    document.body.className = "";
  });
  expect(await run((nb) => nb.restoreStyle())).toBe("neon");
  expect(await run((nb) => nb.getStyle())).toBe("neon");
});
