import { BLUEPRINTS, buildPage } from "@newbrush/mcp/lib";
import { expect, type Page, test } from "@playwright/test";
import { expectNoAxeViolations } from "../harness/fixtures.ts";

// specs/003 T015 / SC-002 — every build_page blueprint × variant, in light and dark, passes axe (WCAG 2.2 AA); and a
// full landing page passes in every design style (specs/004 T037's style argument).

const example = (type: string) => BLUEPRINTS.get(type)?.example as Record<string, unknown>;

async function render(page: Page, html: string) {
  // Example images point at a placeholder host: answer them locally instead of reaching the network.
  await page.route(/^https?:\/\/(?!localhost)/, (route) =>
    route.fulfill({ status: 204, body: "" }),
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setContent(html, { waitUntil: "load" });
}

for (const scheme of ["light", "dark"] as const) {
  for (const blueprint of BLUEPRINTS.values()) {
    for (const variant of blueprint.variants) {
      test(`${blueprint.name} (${variant}, ${scheme}) has no axe violations`, async ({ page }) => {
        const { html } = buildPage({
          title: `${blueprint.title} test`,
          theme: { colorScheme: scheme },
          // Pages normally open with a heading; give header/footer-only cases a hero so the outline is realistic.
          sections: [
            ...(blueprint.titled(blueprint.props.parse(blueprint.example))
              ? []
              : [{ type: "hero", props: example("hero") }]),
            { type: blueprint.name, variant, props: example(blueprint.name) },
          ],
        });
        await render(page, html);
        await expectNoAxeViolations(page);
      });
    }
  }
}

const landing = [
  "navbar",
  "hero",
  "feature-grid",
  "pricing",
  "testimonial",
  "faq",
  "cta",
  "footer",
].map((type) => ({
  type,
  props: example(type),
}));

for (const style of [
  undefined,
  "cyber",
  "g-morph",
  "minimal",
  "n-morph",
  "neon",
  "pixelate",
] as const) {
  for (const scheme of ["light", "dark"] as const) {
    test(`landing page in ${style ?? "the default style"} (${scheme}) has no axe violations`, async ({
      page,
    }) => {
      const { html } = buildPage({
        title: "Brewly",
        theme: { seeds: { brand: "#7c4a2d" }, colorScheme: scheme },
        ...(style ? { style } : {}),
        sections: landing,
      });
      await render(page, html);
      if (style) await expect(page.locator("body")).toHaveClass(style);
      await expectNoAxeViolations(page);
    });
  }
}
