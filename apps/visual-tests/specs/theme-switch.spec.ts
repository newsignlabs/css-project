import { expect, test } from "@playwright/test";
import { customProperty, renderFixture } from "../harness/fixtures.ts";

// T019 — dark mode via media and via data-nb-theme, including nested islands (nearest theme wins).
const surface = (page: import("@playwright/test").Page, selector: string) =>
  page.locator(selector).evaluate((el) => getComputedStyle(el).backgroundColor);

test.describe("prefers-color-scheme", () => {
  test.use({ colorScheme: "dark" });

  test("follows the OS when no theme attribute is set", async ({ page }) => {
    await renderFixture(page, { html: "<p>Hi</p>", theme: "auto" });
    expect(await customProperty(page, "html", "--nb-scheme")).toBe("dark");
  });

  test("data-nb-theme=light forces light under an OS dark preference", async ({ page }) => {
    await renderFixture(page, { html: "<p>Hi</p>", theme: "light" });
    expect(await customProperty(page, "html", "--nb-scheme")).toBe("light");
  });
});

test("data-nb-theme=dark switches tokens and paints the surface", async ({ page }) => {
  await renderFixture(page, { html: "<p>Hi</p>", theme: "dark" });
  expect(await customProperty(page, "html", "--nb-scheme")).toBe("dark");
  const light = await (async () => {
    await renderFixture(page, { html: "<p>Hi</p>", theme: "light" });
    return surface(page, "html");
  })();
  await renderFixture(page, { html: "<p>Hi</p>", theme: "dark" });
  expect(await surface(page, "html")).not.toBe(light);
});

test("nested islands resolve to the nearest theme", async ({ page }) => {
  await renderFixture(page, {
    theme: "dark",
    html: `<section id="light" data-nb-theme="light"><p>light</p>
             <div id="dark2" data-nb-theme="dark"><p>dark again</p>
               <div id="light3" data-nb-theme="light"><p>light again</p></div></div></section>`,
  });
  expect(await customProperty(page, "#light", "--nb-scheme")).toBe("light");
  expect(await customProperty(page, "#dark2", "--nb-scheme")).toBe("dark");
  expect(await customProperty(page, "#light3", "--nb-scheme")).toBe("light");
  // Islands repaint their own surface and text color instead of inheriting the parent's computed colors.
  expect(await surface(page, "#light")).toBe(await surface(page, "#light3"));
  expect(await surface(page, "#light")).not.toBe(await surface(page, "#dark2"));
  const color = (sel: string) => page.locator(sel).evaluate((el) => getComputedStyle(el).color);
  expect(await color("#light > p")).not.toBe(await color("#dark2 > p"));
});

test("contrast theme raises the contrast marker", async ({ page }) => {
  await renderFixture(page, { html: "<p>Hi</p>" });
  await page.evaluate(() => document.documentElement.setAttribute("data-nb-theme", "contrast"));
  expect(await customProperty(page, "html", "--nb-contrast")).toBe("more");
  expect(await customProperty(page, "html", "--nb-scheme")).toBe("light");
});

test("a contrast island inside a dark page is light, high-contrast and repaints itself (T064)", async ({
  page,
}) => {
  await renderFixture(page, {
    theme: "dark",
    html: `<p id="outer">dark</p><section id="hc" data-nb-theme="contrast"><p id="inner">contrast</p>
             <div id="back" data-nb-theme="dark"><p>dark again</p></div></section>`,
  });
  expect(await customProperty(page, "#hc", "--nb-contrast")).toBe("more");
  expect(await customProperty(page, "#hc", "--nb-scheme")).toBe("light");
  expect(await customProperty(page, "#back", "--nb-scheme")).toBe("dark");
  // the contrast island paints its own surface and uses the contrast theme's black text
  expect(await surface(page, "#hc")).not.toBe(await surface(page, "html"));
  const color = (sel: string) => page.locator(sel).evaluate((el) => getComputedStyle(el).color);
  expect(await color("#inner")).toBe(
    await page.evaluate(() => {
      const probe = document.createElement("i");
      probe.style.color = "oklch(0% 0 0)";
      document.body.append(probe);
      return getComputedStyle(probe).color;
    }),
  );
  expect(await color("#back > p")).toBe(await color("#outer"));
});
