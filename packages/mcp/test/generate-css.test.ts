import { describe, expect, it } from "vitest";
import { ToolError } from "../src/lib/errors.ts";
import { classesInHtml, generateCss } from "../src/lib/generate-css.ts";
import { suggest } from "../src/lib/suggest.ts";

// specs/003 T005 — generate_css: classes and HTML in, CSS and diagnostics out; deterministic; limits.

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof ToolError ? e.diagnostic.code : String(e);
  }
  return "no error";
};

describe("generate_css", () => {
  it("generates utilities for class names", () => {
    const r = generateCss({ classes: ["p-4", "md:grid-cols-2", "hover:bg-accent"] });
    expect(r.used).toEqual(["hover:bg-accent", "md:grid-cols-2", "p-4"].sort());
    expect(r.css).toContain(".p-4");
    expect(r.css).toContain("padding: var(--nb-space-4)");
    expect(r.css).toContain("@layer nb.utilities");
    expect(r.stats.bytes).toBe(new TextEncoder().encode(r.css).length);
    expect(r.stats.rules).toBeGreaterThanOrEqual(3);
  });

  it("reads class attributes from HTML, not text", () => {
    const html = '<div class="grid gap-6"><p className="text-muted">hidden table border</p></div>';
    expect(classesInHtml(html)).toEqual(["grid", "gap-6", "text-muted"]);
    expect(generateCss({ html }).used.sort()).toEqual(["gap-6", "grid", "text-muted"]);
  });

  it("reports rejected arbitrary values and unknown classes with suggestions; components are not unknown", () => {
    const r = generateCss({
      classes: ["w-[;evil]", "pd-4", "md:hoverr:p-4", "nb-btn", "nb-btn--primary", "neon"],
    });
    expect(r.rejected.map((d) => [d.code, d.class])).toEqual([
      ["NB_ARBITRARY_REJECTED", "w-[;evil]"],
    ]);
    const unknown = Object.fromEntries(r.unknown.map((u) => [u.class, u.suggestions]));
    expect(Object.keys(unknown).sort()).toEqual(["md:hoverr:p-4", "pd-4"]);
    expect(unknown["pd-4"]).toContain("p-4");
  });

  it("suggests the nearest known classes, keeping variants", () => {
    expect(suggest("md:bg-acent")).toContain("md:bg-accent");
    expect(suggest("nb-buton")).toContain("nb-btn");
    expect(suggest("zzzzzzzz")).toEqual([]);
  });

  it("adds core or full newBrush CSS on request", () => {
    const plain = generateCss({ classes: ["p-4"] }).css;
    const core = generateCss({ classes: ["p-4"], include: { preflight: true } }).css;
    const full = generateCss({ classes: ["p-4"], include: { components: true } }).css;
    expect(plain).not.toContain("@layer nb.reset {");
    expect(core).toContain("@layer nb.reset");
    expect(core).not.toContain(".nb-btn");
    expect(full).toContain(".nb-btn");
    expect(full.length).toBeGreaterThan(core.length);
  });

  it("derives tokens from brand seeds", () => {
    const r = generateCss({
      classes: ["bg-accent"],
      theme: { seeds: { brand: "oklch(60% 0.2 150)" } },
    });
    expect(r.css).toContain("--nb-color-brand-500");
    expect(r.css).toContain("oklch(");
    expect(r.css.indexOf("@layer nb.tokens")).toBeLessThan(r.css.indexOf(".bg-accent"));
  });

  it("is deterministic", () => {
    const input = { html: '<a class="p-4 md:p-8 hover:underline text-accent">x</a>' };
    expect(generateCss(input)).toEqual(generateCss(input));
  });

  it("enforces limits and requires input", () => {
    expect(code(() => generateCss({ html: "x".repeat(256 * 1024 + 1) }))).toBe(
      "NB_INPUT_TOO_LARGE",
    );
    expect(
      code(() => generateCss({ classes: Array.from({ length: 5001 }, (_, i) => `p-${i}`) })),
    ).toBe("NB_INPUT_TOO_LARGE");
    expect(code(() => generateCss({}))).toBe("NB_SCHEMA_INVALID");
    expect(code(() => generateCss({ classes: ["p-4"], extra: 1 } as never))).toBe(
      "NB_SCHEMA_INVALID",
    );
  });
});
