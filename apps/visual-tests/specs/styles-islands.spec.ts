import { expect, type Page, test } from "@playwright/test";
import { renderFixture } from "../harness/fixtures.ts";

// specs/004 T009 — style islands: the nearest style ancestor wins, the attribute equals the class, aliases and the
// nb- form work, and .style-default resets a subtree.

const styleOf = (page: Page, id: string) =>
  page
    .locator(`#${id}`)
    .evaluate((el) => getComputedStyle(el).getPropertyValue("--nb-style").trim());

test("nearest style wins: minimal > neon > style-default > g-morph", async ({ page }) => {
  await renderFixture(page, {
    html: `
      <p id="none">no style</p>
      <section id="minimal" class="minimal">
        <p id="in-minimal">inherits</p>
        <div id="neon" class="neon">
          <div id="reset" class="style-default">
            <p id="in-reset">default again</p>
            <div id="glass" class="g-morph"><p id="in-glass">nested style</p></div>
          </div>
          <p id="after-reset">still neon</p>
        </div>
      </section>`,
  });
  expect(await styleOf(page, "none")).toBe("");
  expect(await styleOf(page, "in-minimal")).toBe("minimal");
  expect(await styleOf(page, "neon")).toBe("neon");
  expect(await styleOf(page, "in-reset")).toBe("default");
  expect(await styleOf(page, "in-glass")).toBe("g-morph");
  expect(await styleOf(page, "after-reset")).toBe("neon");
});

test("attribute ≡ class ≡ nb- class, and aliases resolve to their style", async ({ page }) => {
  const forms: [string, string][] = [
    ['data-nb-style="cyber"', "cyber"],
    ['class="nb-cyber"', "cyber"],
    ['class="cyber"', "cyber"],
    ['class="glass"', "g-morph"],
    ['data-nb-style="g-morph"', "g-morph"],
    ['class="neumorph"', "n-morph"],
    ['class="pixel"', "pixelate"],
    ['class="nb-pixelate"', "pixelate"],
    ['data-nb-style="default"', "default"],
    ['class="nb-style-default"', "default"],
  ];
  await renderFixture(page, {
    html: `<div class="neon">${forms.map(([attr], i) => `<p id="f${i}" ${attr}>x</p>`).join("")}</div>`,
  });
  for (const [i, [attr, name]] of forms.entries())
    expect(await styleOf(page, `f${i}`), attr).toBe(name);
});

test("switching the class at runtime switches the style, no JavaScript from newBrush needed", async ({
  page,
}) => {
  await renderFixture(page, { html: '<div id="root" class="minimal"><p id="child">x</p></div>' });
  expect(await styleOf(page, "child")).toBe("minimal");
  await page.locator("#root").evaluate((el) => el.setAttribute("class", "neon"));
  expect(await styleOf(page, "child")).toBe("neon");
});
