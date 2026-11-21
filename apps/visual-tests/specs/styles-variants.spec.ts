import { createEngine } from "@newbrush/engine";
import { expect, test } from "@playwright/test";
import { renderFixture } from "../harness/fixtures.ts";

// specs/004 T026 (FR-014) — style variants in a real browser: `neon:p-8` applies inside neon and on a neon element
// itself, but not outside neon, nor inside another style or .style-default nested in it. Both strategies; style
// queries only where the engine supports them (Firefox does not).

const html = `
  <p id="outside" class="neon:p-8">outside</p>
  <p id="self" class="neon neon:p-8">self</p>
  <section class="neon">
    <p id="inside" class="neon:p-8">inside</p>
    <div class="cyber"><p id="other" class="neon:p-8">inside cyber</p></div>
    <div class="style-default"><p id="reset" class="neon:p-8">inside reset</p></div>
    <div data-nb-theme="dark"><p id="island" class="neon:p-8">theme island</p></div>
  </section>
  <section class="neumorph"><p id="alias" class="neumorph:p-8">alias</p></section>`;

const expected = {
  outside: "0px",
  self: "32px",
  inside: "32px",
  other: "0px",
  reset: "0px",
  island: "32px",
  alias: "32px",
};

for (const strategy of ["selector", "style-query"] as const) {
  test(`neon:p-8 resolves the nearest style (${strategy})`, async ({ page, browserName }) => {
    test.skip(
      strategy === "style-query" && browserName === "firefox",
      "no style queries in Firefox",
    );
    const engine = createEngine({ content: ["x"], themeVariants: strategy });
    await renderFixture(page, {
      html,
      extraCss: engine.generate(["neon:p-8", "neumorph:p-8"]).css,
    });
    const padding = await page.evaluate((ids) => {
      const out: Record<string, string> = {};
      for (const id of ids)
        out[id] = getComputedStyle(document.getElementById(id) as Element).paddingInlineStart;
      return out;
    }, Object.keys(expected));
    expect(padding).toEqual(expected);
  });
}
