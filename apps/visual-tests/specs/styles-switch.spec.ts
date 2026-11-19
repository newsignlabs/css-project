import { expect, type Page, test } from "@playwright/test";
import { manifest, renderFixture } from "../harness/fixtures.ts";

// specs/004 T012 (US1 scenario 2) — switching the style is one class change on <body>: computed styles follow at once,
// nothing moves (g-morph only re-skins; minimal's airier density is the one allowed layout change), and switching
// away leaves no effect behind.

const html = manifest.components.flatMap((c) => c.examples.map((e) => e.html)).join("\n");

/** Switches the style, then waits for the (reduced-motion, near-instant) transitions it starts to settle. */
const setStyle = (page: Page, style: string) =>
  page.evaluate(async (s) => {
    document.body.className = s;
    getComputedStyle(document.body).color; // flush style so the transitions start now
    await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined)));
  }, style);

/** Border box of every element, rounded to the device pixel. */
const boxes = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("main *")].map((el) => {
      const r = el.getBoundingClientRect();
      return [r.x, r.y, r.width, r.height].map((n) => Math.round(n)).join(",");
    }),
  );

const look = (page: Page) =>
  page.evaluate(() => {
    const card = getComputedStyle(document.querySelector(".nb-card") as Element);
    return {
      marker: getComputedStyle(document.body).getPropertyValue("--nb-style").trim(),
      cardBlur: card.backdropFilter,
      cardRadius: card.borderTopLeftRadius,
      cardShadow: card.boxShadow,
      ambient: getComputedStyle(document.documentElement).backgroundImage,
    };
  });

test("default → g-morph → minimal → default: instant, no layout shift from g-morph, nothing left over", async ({
  page,
}) => {
  await renderFixture(page, { html, width: 1280 });
  const start = { boxes: await boxes(page), look: await look(page) };
  expect(start.look).toMatchObject({ marker: "", cardBlur: "none", ambient: "none" });

  await setStyle(page, "g-morph");
  const glass = await look(page);
  expect(glass.marker).toBe("g-morph");
  expect(glass.cardBlur).toContain("blur");
  expect(glass.ambient).toContain("radial-gradient");
  expect(glass.cardRadius).not.toBe(start.look.cardRadius);
  expect(await boxes(page)).toEqual(start.boxes);

  await setStyle(page, "minimal");
  const minimal = await look(page);
  expect(minimal).toMatchObject({ marker: "minimal", cardBlur: "none", ambient: "none" });
  expect(minimal.cardShadow).toMatch(/^(none|.* 0px 0px 0px 0px)$/); // shadow.0: zero-size and transparent

  await setStyle(page, "");
  expect(await look(page)).toEqual(start.look);
  expect(await boxes(page)).toEqual(start.boxes);
});
