import { expect, type Page, test } from "@playwright/test";
import { manifest, renderFixture, THEMES } from "../harness/fixtures.ts";

// T064 — Windows High Contrast / forced-colors (spec edge case: borders and focus rings stay visible in system colours).
// Playwright emulates forced colors in Chromium only.
test.skip(
  ({ browserName }) => browserName !== "chromium",
  "forced-colors emulation is Chromium-only",
);

/** Waits two frames: components transition colours and outlines (0.01 ms under reduced motion). */
const settle = (page: Page) =>
  page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

/** Problems a forced-colors user would hit in the rendered fixture. */
function audit(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const name = (el: Element) =>
      `${el.tagName.toLowerCase()}${[...el.classList].map((c) => `.${c}`).join("")}`;
    const visible = (s: CSSStyleDeclaration) => s.display !== "none" && s.visibility !== "hidden";
    const bordered = (s: CSSStyleDeclaration) =>
      (["Top", "Right", "Bottom", "Left"] as const).some(
        (d) => Number.parseFloat(s[`border${d}Width`]) > 0 && s[`border${d}Style`] !== "none",
      );
    const system = (keyword: string) => {
      const probe = document.createElement("span");
      probe.style.color = keyword;
      document.body.append(probe);
      const value = getComputedStyle(probe).color;
      probe.remove();
      return value;
    };
    const grayText = system("GrayText");

    // 1. Boxed controls keep a visible boundary (backgrounds are flattened to Canvas/ButtonFace).
    const boxed =
      "input:not([type=checkbox]):not([type=radio]):not([type=hidden]), select, textarea, [role=switch], .nb-btn";
    for (const el of document.querySelectorAll(`main :is(${boxed})`)) {
      const s = getComputedStyle(el);
      if (visible(s) && !bordered(s)) out.push(`no visible boundary: ${name(el)}`);
    }

    // 2. Disabled controls read as disabled (GrayText text or boundary).
    for (const el of document.querySelectorAll(
      "main :is(button, input, select, textarea):disabled",
    )) {
      const s = getComputedStyle(el);
      const native =
        el.matches("input[type=checkbox], input[type=radio]") && s.appearance !== "none";
      if (visible(s) && !native && s.color !== grayText && s.borderTopColor !== grayText)
        out.push(`disabled control not in GrayText: ${name(el)}`);
    }

    // 3. Selected / current / pressed states differ from their siblings in something forced colors keeps.
    const signature = (el: Element) => {
      const parts = [el, ...["::before", "::after"]].map((p) => {
        const s = typeof p === "string" ? getComputedStyle(el, p) : getComputedStyle(p);
        return [
          s.backgroundColor,
          s.color,
          s.borderBlockEndWidth,
          s.borderBlockEndStyle,
          s.borderInlineStartWidth,
          s.outlineStyle,
          s.textDecorationLine,
          s.fontWeight,
          s.content,
          s.display,
        ].join(",");
      });
      return parts.join("|");
    };
    for (const [attr, on] of [
      ["aria-selected", "true"],
      ["aria-current", "page"],
      ["aria-pressed", "true"],
    ] as const) {
      for (const el of document.querySelectorAll(`main [${attr}="${on}"]`)) {
        const group = el.closest("[role=tablist], nav, ul, .nb-btn-group") ?? el.parentElement;
        const sibling = [...(group?.querySelectorAll(`[${attr}]`) ?? [])].find(
          (x) => x !== el && x.getAttribute(attr) !== on,
        );
        if (sibling && signature(el) === signature(sibling))
          out.push(`${attr}="${on}" looks the same as its siblings: ${name(el)}`);
      }
    }

    // 4. Custom-drawn switches keep a visible thumb, and on/off differ in colour, not only in position.
    const thumbs = new Map<string, string>();
    for (const el of document.querySelectorAll<HTMLInputElement>("main [role=switch]")) {
      const s = getComputedStyle(el);
      const thumb = getComputedStyle(el, "::before").backgroundColor;
      if (thumb === "rgba(0, 0, 0, 0)" || thumb === s.backgroundColor)
        out.push(`switch thumb invisible: ${name(el)}`);
      if (!el.disabled) thumbs.set(String(el.checked), thumb);
    }
    if (thumbs.size === 2 && thumbs.get("true") === thumbs.get("false"))
      out.push("switch on and off thumbs share a colour");
    return out;
  });
}

/** Tabs through the fixture and reports focus stops without a visible outline (box-shadow is dropped in forced colors). */
async function focusAudit(page: Page): Promise<string[]> {
  const out = new Set<string>();
  for (let i = 0; i < 16; i++) {
    await page.keyboard.press("Tab");
    await settle(page);
    const problem = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el?.closest("main")) return null;
      const ring = (s: CSSStyleDeclaration) =>
        s.outlineStyle !== "none" && Number.parseFloat(s.outlineWidth) >= 2;
      if (ring(getComputedStyle(el)) || ring(getComputedStyle(el, "::after"))) return null;
      return `focus not visible: ${el.tagName.toLowerCase()}${[...el.classList].map((c) => `.${c}`).join("")}`;
    });
    if (problem) out.add(problem);
  }
  return [...out];
}

for (const component of manifest.components) {
  component.examples.forEach((example, i) => {
    for (const theme of THEMES) {
      test(`${component.name} · ${example.title} · ${theme}`, async ({ page }) => {
        await renderFixture(page, { html: example.html, theme });
        await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
        await settle(page);
        expect([...(await audit(page)), ...(await focusAudit(page))], `example ${i}`).toEqual([]);
      });
    }
  });
}

test("the emulation is active (guards against a silently disabled suite)", async ({ page }) => {
  await renderFixture(page, { html: "<p>x</p>" });
  await page.emulateMedia({ forcedColors: "active" });
  expect(await page.evaluate(() => matchMedia("(forced-colors: active)").matches)).toBe(true);
});
