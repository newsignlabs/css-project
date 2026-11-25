import { brotliCompressSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { BLUEPRINTS } from "../src/blueprints/index.ts";
import { buildPage } from "../src/lib/build-page.ts";
import { ToolError } from "../src/lib/errors.ts";

// specs/003 T024, T017 and US3 acceptance — build_page.

const example = (type: string) => BLUEPRINTS.get(type)?.example as Record<string, unknown>;
const section = (type: string, extra: Record<string, unknown> = {}) => ({
  type,
  props: { ...example(type), ...extra },
});
const error = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    if (e instanceof ToolError) return e.diagnostic;
  }
  throw new Error("expected a ToolError");
};

describe("build_page", () => {
  it("builds the acceptance page: hero, feature grid, pricing, testimonial, footer with a brand seed (US3-2)", () => {
    const r = buildPage({
      title: "Brewly — coffee subscriptions",
      description: "Small-batch coffee, delivered.",
      theme: { seeds: { brand: "#7c4a2d" } },
      sections: ["hero", "feature-grid", "pricing", "testimonial", "footer"].map((t) => section(t)),
    });
    expect(r.html).toMatch(/^<!DOCTYPE html>\n<html lang="en" dir="ltr">/);
    expect(r.html).toContain("<title>Brewly — coffee subscriptions</title>");
    expect(r.html).toContain('<meta name="color-scheme" content="light dark">');
    expect(r.html).toContain('<main id="main">');
    expect(r.html).toContain('href="#main">Skip to content</a>');
    expect((r.html.match(/<h1[\s>]/g) ?? []).length).toBe(1);
    expect(r.css).toContain("--nb-color-brand-500");
    expect(r.css).toContain(".nb-card");
    expect(r.css).not.toContain(".nb-modal");
    expect(r.sections.map((s) => s.id)).toEqual([
      "hero",
      "feature-grid",
      "pricing",
      "testimonial",
      "footer",
    ]);
    expect(r.diagnostics).toEqual([]);
  });

  it("keeps a 6-section landing page's CSS under 15 KB brotli (SC-004)", () => {
    const r = buildPage({
      title: "Budget",
      theme: { seeds: { brand: "#2563eb" } },
      sections: ["navbar", "hero", "feature-grid", "pricing", "faq", "footer"].map((t) =>
        section(t),
      ),
    });
    expect(brotliCompressSync(Buffer.from(r.css)).length).toBeLessThanOrEqual(15 * 1024);
  });

  it("returns fragments for an existing site (US3-3), wrapped in the style when given", () => {
    const r = buildPage({
      title: "x",
      output: "fragments",
      style: "neon",
      sections: [section("hero")],
    });
    expect(r.html.startsWith('<div class="neon">')).toBe(true);
    expect(r.html).not.toContain("<!DOCTYPE");
    expect(r.css).toContain('[data-nb-style="neon"]');
  });

  it("applies language, direction, colour scheme and design style", () => {
    const r = buildPage({
      title: "x",
      lang: "ar",
      dir: "rtl",
      theme: { colorScheme: "dark" },
      style: "cyber",
      sections: [section("hero")],
    });
    expect(r.html).toContain('<html lang="ar" dir="rtl" data-nb-theme="dark">');
    expect(r.html).toContain('<body class="cyber">');
    expect(r.html).not.toContain('name="color-scheme"');
  });

  it("gives repeated sections unique ids and only the first titled section an h1", () => {
    const r = buildPage({
      title: "x",
      sections: [section("navbar"), section("cta"), section("cta"), section("hero")],
    });
    expect(r.sections.map((s) => s.id)).toEqual(["navbar", "cta", "cta-2", "hero"]);
    expect(r.html).toContain('<h1 id="cta-title"');
    expect(r.html).toContain('<h2 id="cta-2-title"');
    expect(r.html).toContain('<h2 id="hero-title"');
  });

  it("escapes text, sanitizes rich text and replaces unsafe URLs with a diagnostic", () => {
    const r = buildPage({
      title: "<script>x</script>",
      sections: [
        section("hero", {
          title: '<img src=x onerror="alert(1)">',
          subtitle: "ok <strong>bold</strong> <script>bad()</script>",
          primary: { text: "Go", href: "javascript:alert(1)" },
        }),
      ],
    });
    expect(r.html).not.toMatch(/<script|<img src=x|javascript:/);
    expect(r.html).toContain("<strong>bold</strong>");
    expect(r.diagnostics).toEqual([
      expect.objectContaining({ code: "NB_UNSAFE_URL", path: "sections[0].props.primary" }),
    ]);
  });

  it("warns about images without alt text", () => {
    const r = buildPage({
      title: "x",
      sections: [
        { type: "hero", variant: "split", props: { title: "Hi", image: { src: "/a.jpg" } } },
      ],
    });
    expect(r.diagnostics.map((d) => d.code)).toEqual(["NB_MISSING_ALT"]);
    expect(r.html).toContain('alt=""');
  });

  it("names the section and field in schema errors, and suggests section names", () => {
    expect(error(() => buildPage({ title: "x", sections: [{ type: "heroo" }] }))).toMatchObject({
      code: "NB_UNKNOWN_SECTION",
      suggestion: "hero",
    });
    expect(
      error(() =>
        buildPage({
          title: "x",
          sections: [{ type: "hero", variant: "huge", props: { title: "x" } }],
        }),
      ),
    ).toMatchObject({
      code: "NB_SCHEMA_INVALID",
      path: "sections[0].variant",
    });
    expect(
      error(() =>
        buildPage({
          title: "x",
          sections: [{ type: "pricing", props: { title: "x", tiers: [] } }],
        }),
      ),
    ).toMatchObject({
      code: "NB_SCHEMA_INVALID",
      path: "sections[0].props.tiers",
    });
  });

  it("is deterministic", () => {
    const spec = {
      title: "x",
      sections: ["navbar", "hero", "faq", "footer"].map((t) => section(t)),
    };
    expect(buildPage(spec)).toEqual(buildPage(spec));
  });
});
