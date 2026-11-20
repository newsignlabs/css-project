import { expect, type Page, test } from "@playwright/test";
import { manifest, renderFixture } from "../harness/fixtures.ts";

// specs/004 T018 — motion in design styles: with prefers-reduced-motion nothing animates (glitch, flicker, pulse,
// scanline drift); when motion is allowed, every animation is finite and only moves or clips (transform, translate,
// clip-path), so nothing flashes (no colour, opacity or filter change: well under 3 flashes per second).

const STYLES = manifest.styles.filter((s) => s.tokens.length || s.recipes.length);
const html = `
  <div class="nb-cluster">
    <button class="nb-btn" type="button">Secondary</button>
    <button class="nb-btn nb-btn--primary" type="button">Primary</button>
    <a class="nb-btn nb-btn--ghost" href="#x">Ghost</a>
  </div>
  <div class="nb-card"><div class="nb-card__body"><input class="nb-input" aria-label="Name"></div></div>`;

const MOVES = new Set(["transform", "translate", "rotate", "scale", "clipPath", "offsetDistance"]);

interface Seen {
  name: string;
  properties: string[];
  iterations: number;
}

/**
 * Hovers and focuses every control and reports every CSS animation that ran. Animations are recorded as they start
 * (animationstart) as well as sampled after each step, so a one-shot animation shorter than a Playwright round-trip
 * (cyber's 240 ms glitch, in Firefox on CI) is never missed.
 */
async function exercise(page: Page): Promise<Seen[]> {
  await page.evaluate(() => {
    const w = window as unknown as { __nbSeen: Seen[]; __nbDescribe: (a: CSSAnimation) => Seen };
    w.__nbSeen = [];
    w.__nbDescribe = (a) => {
      const effect = a.effect as KeyframeEffect;
      const properties = new Set(
        effect
          .getKeyframes()
          .flatMap((k) => Object.keys(k))
          .filter((k) => !["offset", "computedOffset", "easing", "composite"].includes(k)),
      );
      return {
        name: a.animationName,
        properties: [...properties],
        iterations: Number(effect.getTiming().iterations ?? 1),
      };
    };
    document.addEventListener(
      "animationstart",
      (event) => {
        for (const a of (event.target as Element).getAnimations())
          if (a instanceof CSSAnimation && a.animationName === event.animationName)
            w.__nbSeen.push(w.__nbDescribe(a));
      },
      true,
    );
  });
  const sample = () =>
    page.evaluate(() => {
      const w = window as unknown as { __nbSeen: Seen[]; __nbDescribe: (a: CSSAnimation) => Seen };
      for (const a of document.getAnimations())
        if (a instanceof CSSAnimation) w.__nbSeen.push(w.__nbDescribe(a));
    });
  for (const control of await page.locator(".nb-btn, .nb-input").all()) {
    await control.hover();
    await sample();
    await control.focus();
    await sample();
  }
  // Let any animation that is about to start fire its animationstart.
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(resolve)), 400),
      ),
  );
  const seen = await page.evaluate(() => (window as unknown as { __nbSeen: Seen[] }).__nbSeen);
  const unique = new Map(seen.map((a) => [`${a.name}|${a.properties.join()}|${a.iterations}`, a]));
  return [...unique.values()];
}

for (const style of STYLES) {
  test(`${style.name}: nothing animates with prefers-reduced-motion`, async ({ page }) => {
    await renderFixture(page, { html, style: style.name }); // the fixture emulates reduced motion
    expect(await exercise(page)).toEqual([]);
  });

  test(`${style.name}: with motion allowed, animations are finite and only move or clip (no flashing)`, async ({
    page,
  }) => {
    await renderFixture(page, { html, style: style.name });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    for (const animation of await exercise(page)) {
      expect(Number.isFinite(animation.iterations), animation.name).toBe(true);
      for (const property of animation.properties)
        expect(MOVES.has(property), `${animation.name} animates ${property}`).toBe(true);
    }
  });
}

test("cyber's glitch runs on hover when motion is allowed and the device can hover (the checks above are not vacuous)", async ({
  page,
}) => {
  await renderFixture(page, { html, style: "cyber" });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  // The glitch is behind @media (hover: hover): touch-only devices (and some headless engines) never run it.
  const canHover = await page.evaluate(() => matchMedia("(hover: hover)").matches);
  const names = (await exercise(page)).map((a) => a.name);
  if (canHover) expect(names).toContain("nb-cyber-glitch");
  else expect(names).not.toContain("nb-cyber-glitch");
});
