import { describe, expect, it } from "vitest";
import { BLUEPRINTS } from "../src/blueprints/index.ts";
import { buildPage } from "../src/lib/build-page.ts";
import type { ToolError } from "../src/lib/errors.ts";
import { validateMarkup } from "../src/lib/validate-markup.ts";
import { LIMITS, ValidateMarkupOutput } from "../src/schemas/index.ts";

// specs/003 T028 (validation fixtures) and US5 acceptance — validate_markup.

const codes = (html: string, level?: "AA" | "AAA") =>
  validateMarkup({ html, ...(level ? { level } : {}) }).diagnostics.map(
    (d) => `${d.code} ${d.path ?? ""}`,
  );

describe("validate_markup", () => {
  it("reports each problem with its location (US5-1)", () => {
    const html = [
      '<section class="bg-surface-subtle">',
      '  <div class="nb-card__body pd-4">Body</div>',
      '  <img src="team.jpg">',
      '  <button class="nb-btn"></button>',
      '  <p class="text-subtle">Fine print</p>',
      "</section>",
    ].join("\n");
    const r = validateMarkup({ html });
    expect(ValidateMarkupOutput.parse(r)).toEqual(r);
    expect(r.valid).toBe(false);
    expect(r.summary).toEqual({ errors: 3, warnings: 2 });
    expect(r.diagnostics.map((d) => [d.code, d.path, d.class])).toEqual([
      ["NB_UNKNOWN_CLASS", "L2:C3 <div>", "pd-4"],
      ["NB_ANATOMY_INVALID", "L2:C3 <div>", "nb-card__body"],
      ["NB_MISSING_ALT", "L3:C3 <img>", undefined],
      ["NB_MISSING_NAME", "L4:C3 <button>", undefined],
      ["NB_CONTRAST_FAIL", "L5:C3 <p>", "text-subtle"],
    ]);
    expect(r.diagnostics[0]?.suggestion).toBe("p-4");
    expect(r.diagnostics[4]?.message).toMatch(
      /\.text-subtle on \.bg-surface-subtle is [\d.]+:1 in light/,
    );
  });

  it("passes every build_page blueprint and variant with no findings", () => {
    for (const [type, blueprint] of BLUEPRINTS)
      for (const variant of blueprint.variants) {
        const page = buildPage({
          title: "Check",
          sections: [{ type, variant, props: blueprint.example as Record<string, unknown> }],
        });
        expect(validateMarkup({ html: page.html }).diagnostics, `${type}/${variant}`).toEqual([]);
      }
    const full = buildPage({
      title: "Full",
      style: "neon",
      theme: { seeds: { brand: "#7c4a2d" } },
      sections: ["navbar", "hero", "feature-grid", "pricing", "faq", "footer"]
        .filter((t) => BLUEPRINTS.has(t))
        .map((type) => ({ type, props: BLUEPRINTS.get(type)?.example as Record<string, unknown> })),
    });
    expect(validateMarkup({ html: full.html })).toMatchObject({ valid: true, diagnostics: [] });
  }, 60_000);

  it("checks anatomy: parts need their component, modifiers their root", () => {
    expect(
      codes('<article class="nb-card"><div><div class="nb-card__body">x</div></div></article>'),
    ).toEqual([]);
    expect(codes('<span class="nb-btn--primary">x</span>')).toEqual([
      "NB_ANATOMY_INVALID L1:C1 <span>",
    ]);
    expect(codes('<button class="nb-btn nb-btn--primary nb-btn--sm">Go</button>')).toEqual([]);
    expect(
      codes(
        '<div class="nb-btn-group"><button class="nb-btn">A</button></div><button class="nb-btn">B</button>',
      ),
    ).toEqual([]);
  });

  it("checks accessible names and labels", () => {
    expect(
      codes('<a href="/x"><img src="i.png" alt="Home"></a><button aria-label="Close"></button>'),
    ).toEqual([]);
    expect(codes('<a href="/x"><span aria-hidden="true">→</span></a>')).toEqual([
      "NB_MISSING_NAME L1:C1 <a>",
    ]);
    expect(codes('<img src="i.png" alt="">')).toEqual([]); // decorative
    expect(codes('<label for="e">Email</label><input id="e" type="email">')).toEqual([]);
    expect(codes('<label>Name <input></label><textarea aria-label="Note"></textarea>')).toEqual([]);
    expect(codes('<input type="hidden" name="t"><input type="submit" value="Send">')).toEqual([]);
    expect(codes("<select><option>A</option></select>")).toEqual([
      "NB_MISSING_LABEL L1:C1 <select>",
    ]);
  });

  it("checks ids, URLs, headings and the document language", () => {
    expect(codes('<p id="a">1</p><p id="a">2</p>')).toEqual(["NB_DUPLICATE_ID L1:C16 <p>"]);
    expect(
      codes('<a href="javascript:alert(1)">x</a><form action=" data:text/html,x"></form>'),
    ).toEqual(["NB_UNSAFE_URL L1:C1 <a>", "NB_UNSAFE_URL L1:C36 <form>"]);
    expect(
      codes('<img src="data:image/png;base64,AAAA" alt="Dot"><a href="mailto:a@b.c">Mail</a>'),
    ).toEqual([]);
    expect(codes("<h1>A</h1>\n<h3>B</h3>\n<h1>C</h1>")).toEqual([
      "NB_HEADING_ORDER L2:C1 <h3>",
      "NB_HEADING_ORDER L3:C1 <h1>",
    ]);
    expect(
      codes("<!DOCTYPE html>\n<html><head><title>x</title></head><body><p>x</p></body></html>"),
    ).toEqual(["NB_MISSING_LANG L2:C1 <html>"]);
    expect(codes('<!doctype html><html lang="fr"><title>x</title></html>')).toEqual([]);
  });

  it("rejects invalid utilities and checks contrast at AA or AAA", () => {
    const r = validateMarkup({ html: '<div class="w-[;x]">x</div>' });
    expect(r.diagnostics[0]).toMatchObject({
      code: "NB_ARBITRARY_REJECTED",
      severity: "error",
      class: "w-[;x]",
    });
    expect(r.valid).toBe(false);
    expect(codes('<p class="text-muted">Muted</p>')).toEqual([]); // 4.5:1 or better on the page surface
    expect(codes('<p class="text-muted">Muted</p>', "AAA")).toEqual(["NB_CONTRAST_FAIL L1:C1 <p>"]);
    // Components set their own colours: no guess is made inside them.
    expect(
      codes(
        '<div class="bg-surface-subtle"><div class="nb-alert"><p class="text-subtle">x</p></div></div>',
      ),
    ).toEqual([]);
    // One finding per colour pair, not per element.
    expect(
      codes(
        '<div class="bg-surface-subtle"><p class="text-subtle">a</p><p class="text-subtle">b</p></div>',
      ),
    ).toHaveLength(1);
    // Variants are not guessed at.
    expect(codes('<p class="dark:text-subtle hover:text-subtle">x</p>')).toEqual([]);
  });

  it("limits input size", () => {
    try {
      validateMarkup({ html: "x".repeat(LIMITS.htmlBytes + 1) });
      expect.unreachable();
    } catch (e) {
      expect((e as ToolError).diagnostic.code).toBe("NB_INPUT_TOO_LARGE");
    }
  });
});
