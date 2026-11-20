import { expect, type Page, test } from "@playwright/test";
import { renderFixture } from "../harness/fixtures.ts";

// specs/004 T025 (US2 scenario 1, US3) — styles and themes nest: dark-first styles are dark on a light page unless a
// theme is explicit, a theme island inside a style keeps the style, and .style-default inside a dark-first style
// gives the default style in that dark context.

const settle = (page: Page) =>
  page.evaluate(async () => {
    await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined)));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });

const read = (page: Page, selector: string, properties: string[]) =>
  page
    .locator(selector)
    .evaluate(
      (el, props) =>
        Object.fromEntries(props.map((p) => [p, getComputedStyle(el).getPropertyValue(p).trim()])),
      properties,
    );

/** sRGB luminance of an element's painted background colour (canvas-normalised, any colour syntax). */
const backgroundLuminance = (page: Page, selector: string) =>
  page.locator(selector).evaluate((el) => {
    const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    if (!ctx) return Number.NaN;
    ctx.fillStyle = getComputedStyle(el).backgroundColor;
    ctx.fillRect(0, 0, 1, 1);
    const [r = 0, g = 0, b = 0] = [...ctx.getImageData(0, 0, 1, 1).data].map((v) => {
      const c = v / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  });

test("neon and cyber are dark on a light page when no theme is set, and light under data-nb-theme=light", async ({
  page,
}) => {
  for (const style of ["neon", "cyber"]) {
    await renderFixture(page, {
      html: '<div class="nb-card" id="card">x</div>',
      theme: "auto",
      style,
    });
    await settle(page);
    expect(await read(page, "body", ["color-scheme", "--nb-scheme"]), style).toEqual({
      "color-scheme": "dark",
      "--nb-scheme": "dark",
    });
    // The page itself is painted dark too (<html> follows a style on <body>).
    expect(await backgroundLuminance(page, "html"), style).toBeLessThan(0.05);

    await renderFixture(page, {
      html: '<div class="nb-card" id="card">x</div>',
      theme: "light",
      style,
    });
    await settle(page);
    expect((await read(page, "body", ["color-scheme"]))["color-scheme"], style).toBe("light");
    expect(await backgroundLuminance(page, "html"), style).toBeGreaterThan(0.8);
  }
});

test("a dark-first island inside a light page, and a light island inside a dark-first page", async ({
  page,
}) => {
  await renderFixture(page, {
    html: `<section class="neon" id="neon"><div class="nb-card" id="card">neon</div>
      <div data-nb-theme="light" id="light"><div class="nb-card" id="light-card">light island</div></div></section>`,
    theme: "light",
  });
  await settle(page);
  // Inside an explicit light page, neon follows the page: light neon.
  expect((await read(page, "#neon", ["color-scheme"]))["color-scheme"]).toBe("light");

  await renderFixture(page, {
    html: `<section class="neon" id="neon"><div class="nb-card" id="card">neon</div>
      <div data-nb-theme="light" id="light"><div class="nb-card" id="light-card">light island</div></div></section>`,
    theme: "auto",
  });
  await settle(page);
  expect((await read(page, "#neon", ["color-scheme"]))["color-scheme"]).toBe("dark");
  expect(await backgroundLuminance(page, "#neon")).toBeLessThan(0.05);
  // The light island inside keeps neon (marker and glow knob) but in the light scheme.
  expect(await read(page, "#light", ["color-scheme", "--nb-style"])).toEqual({
    "color-scheme": "light",
    "--nb-style": "neon",
  });
  expect(await backgroundLuminance(page, "#light")).toBeGreaterThan(0.8);
});

test("a theme island inside g-morph keeps the glass (closes the S1 known limit)", async ({
  page,
}) => {
  await renderFixture(page, {
    html: `<section data-nb-theme="dark" id="island"><div class="nb-card" id="card">glass in a dark island</div></section>`,
    theme: "light",
    style: "g-morph",
  });
  await settle(page);
  const alpha = await page.locator("#card").evaluate((el) => {
    const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    if (!ctx) return 1;
    ctx.fillStyle = getComputedStyle(el).backgroundColor;
    ctx.fillRect(0, 0, 1, 1);
    return (ctx.getImageData(0, 0, 1, 1).data[3] ?? 255) / 255;
  });
  expect(alpha).toBeLessThan(0.9);
  expect((await read(page, "#card", ["backdrop-filter"]))["backdrop-filter"]).toContain("blur");
  expect((await read(page, "#island", ["--nb-style"]))["--nb-style"]).toBe("g-morph");
  expect(await backgroundLuminance(page, "#island")).toBeLessThan(0.1); // the island is still dark
});

test(".style-default inside neon is the default style, in neon's dark context", async ({
  page,
}) => {
  await renderFixture(page, {
    html: '<div class="style-default" id="reset"><div class="nb-card" id="card">default</div></div>',
    theme: "auto",
    style: "neon",
  });
  await settle(page);
  const reset = await read(page, "#reset", [
    "--nb-style",
    "color-scheme",
    "--nb-color-surface-raised",
    "--nb-color-surface-raised-base",
  ]);
  expect(reset["--nb-style"]).toBe("default");
  expect(reset["color-scheme"]).toBe("dark");
  // Restored to the theme value, which is the dark one the dark-first rule declared.
  expect(reset["--nb-color-surface-raised"]).toBe(reset["--nb-color-surface-raised-base"]);
  // neon's recipes stop at the reset (nearest style wins for recipes too).
  expect((await read(page, "#card", ["box-shadow"]))["box-shadow"]).not.toContain("0px 0px 24px");
});
