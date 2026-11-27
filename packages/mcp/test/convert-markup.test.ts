import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { pattern, SEMANTIC, TABLE } from "../src/convert/bootstrap.ts";
import { PALETTE } from "../src/convert/tailwind.ts";
import { convertMarkup, isNewBrushClass } from "../src/lib/convert-markup.ts";
import type { ToolError } from "../src/lib/errors.ts";
import { validateMarkup } from "../src/lib/validate-markup.ts";
import { ConvertMarkupOutput, LIMITS } from "../src/schemas/index.ts";

// specs/003 T028 (conversion fixtures), T030 and US5-2 — convert_markup.

const tw = (html: string) => convertMarkup({ html, from: "tailwind" });
const bs = (html: string) => convertMarkup({ html, from: "bootstrap" });
/** The markup with every class attribute's value blanked: what must not change. */
const outsideClasses = (html: string) => html.replace(/\sclass="[^"]*"/g, "");
/** No class in the output is unknown to newBrush or rejected. */
const onlyNewBrush = (html: string) =>
  validateMarkup({ html }).diagnostics.filter((d) =>
    ["NB_UNKNOWN_CLASS", "NB_ARBITRARY_REJECTED"].includes(d.code),
  );

const TAILWIND_PAGE = `<section class="bg-gray-50 py-24 sm:py-32">
  <div class="mx-auto max-w-7xl px-6 lg:px-8">
    <h2 class="text-base font-semibold leading-7 text-indigo-600">Deploy faster</h2>
    <p class="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Everything you need</p>
    <div class="mt-10 grid grid-cols-1 gap-8 md:grid-cols-3">
      <div class="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-900/5"><p class="text-sm text-gray-600">Push to deploy.</p></div>
    </div>
    <a href="/start" class="mt-8 inline-flex items-center rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline-2">Get started</a>
    <input type="email" class="mt-4 w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500" aria-label="Email">
  </div>
</section>`;

const BOOTSTRAP_PAGE = `<div class="container">
  <div class="row g-4">
    <div class="col-md-6"><div class="card shadow-sm"><img src="a.jpg" class="card-img-top" alt="A"><div class="card-body"><h5 class="card-title">Title</h5><p class="card-text text-muted">Text</p><a href="#" class="btn btn-primary btn-sm">Go</a></div></div></div>
    <div class="col-md-6">
      <div class="alert alert-warning" role="alert"><strong>Heads up!</strong> <button type="button" class="btn-close" aria-label="Close"></button></div>
      <form><div class="mb-3"><label for="e" class="form-label">Email</label><input type="email" class="form-control" id="e"><div class="form-text">Never shared.</div></div>
      <span class="badge bg-success">New</span>
      <button class="btn btn-outline-secondary d-none d-md-inline-block mt-3">More</button></form>
    </div>
  </div>
  <div class="row"><div class="col">A</div><div class="col">B</div></div>
  <p class="text-center fw-bold fs-4 mb-0">Done</p>
</div>`;

describe("convert_markup from Tailwind", () => {
  it("converts a landing section with only newBrush classes and nothing else changed (US5-2)", () => {
    const r = tw(TAILWIND_PAGE);
    expect(ConvertMarkupOutput.parse(r)).toEqual(r);
    expect(r.unmapped).toEqual([]);
    expect(r.mapped).toBeGreaterThan(40);
    expect(outsideClasses(r.html)).toBe(outsideClasses(TAILWIND_PAGE));
    expect(onlyNewBrush(r.html)).toEqual([]);
    expect(r.html).toContain('class="bg-neutral-50 py-24 sm:py-32"');
    expect(r.html).toContain('class="mx-auto max-w-[80rem] px-6 lg:px-8"');
    expect(r.html).toContain("text-brand-600");
    expect(r.html).toContain("leading-relaxed");
    expect(r.html).toContain("ring-neutral-900/5");
  });

  it("turns utility buttons and inputs into components", () => {
    expect(tw(TAILWIND_PAGE).html).toContain(
      '<a href="/start" class="nb-btn nb-btn--primary mt-8">',
    );
    expect(tw(TAILWIND_PAGE).html).toContain(
      '<input type="email" class="nb-input mt-4 w-full" aria-label="Email">',
    );
    expect(tw('<button class="rounded bg-red-600 px-4 py-2 text-white">Delete</button>').html).toBe(
      '<button class="nb-btn nb-btn--danger">Delete</button>',
    );
    expect(
      tw('<button class="rounded border border-gray-300 px-4 py-2">Cancel</button>').html,
    ).toBe('<button class="nb-btn">Cancel</button>');
    // A plain coloured div is not a button.
    expect(tw('<div class="rounded bg-blue-600 px-4 py-2">x</div>').html).toBe(
      '<div class="rounded bg-brand-600 px-4 py-2">x</div>',
    );
  });

  it("keeps variants, maps every palette and uses logical sides", () => {
    expect(tw('<p class="dark:hover:text-blue-300 md:pl-4 !mt-2 text-left">x</p>').html).toBe(
      '<p class="dark:hover:text-brand-300 md:ps-4 mt-2! text-start">x</p>',
    );
    for (const [colour, palette] of Object.entries(PALETTE))
      expect(tw(`<p class="bg-${colour}-100">x</p>`).html, colour).toBe(
        `<p class="bg-${palette}-100">x</p>`,
      );
  });

  it("leaves out what has no equivalent, with the reason", () => {
    const r = tw('<div class="bg-gradient-to-r float-left my-widget p-4">x</div>');
    expect(r.html).toBe('<div class="p-4">x</div>');
    expect(r.mapped).toBe(1);
    expect(r.unmapped).toEqual([
      { class: "bg-gradient-to-r", reason: expect.stringContaining("gradients") },
      { class: "float-left", reason: expect.stringContaining("flex or grid") },
      { class: "my-widget", reason: "no newBrush equivalent" },
    ]);
    // An element left with no classes loses the attribute; repeated classes are listed once.
    expect(tw('<p class="float-left">a</p><p class="float-left">b</p>')).toMatchObject({
      html: "<p>a</p><p>b</p>",
      unmapped: [{ class: "float-left" }],
    });
  });
});

describe("convert_markup from Bootstrap", () => {
  it("converts components, the grid and utilities (US5-2)", () => {
    const r = bs(BOOTSTRAP_PAGE);
    expect(r.unmapped).toEqual([]);
    expect(outsideClasses(r.html)).toBe(outsideClasses(BOOTSTRAP_PAGE));
    expect(onlyNewBrush(r.html)).toEqual([]);
    expect(validateMarkup({ html: r.html }).valid).toBe(true); // anatomy holds: parts sit in their components
    for (const fragment of [
      '<div class="nb-container">',
      '<div class="grid grid-cols-12 gap-6">',
      '<div class="col-span-12 md:col-span-6"><div class="nb-card shadow-sm"><img src="a.jpg" class="nb-card__media" alt="A"><div class="nb-card__body"><h5 class="nb-card__title">Title</h5><p class="text-muted">',
      '<a href="#" class="nb-btn nb-btn--primary nb-btn--sm">Go</a>',
      '<div class="nb-alert nb-alert--warning" role="alert">',
      '<button type="button" class="nb-alert__close" aria-label="Close">',
      '<div class="nb-field mb-4"><label for="e" class="nb-field__label">Email</label><input type="email" class="nb-input" id="e"><div class="nb-field__hint">',
      '<span class="nb-badge nb-badge--success">New</span>',
      '<button class="nb-btn hidden md:inline-block mt-4">More</button>',
      '<div class="grid gap-6 md:grid-flow-col md:auto-cols-fr"><div>A</div><div>B</div></div>',
      '<p class="text-center font-bold text-xl mb-0">Done</p>',
    ])
      expect(r.html).toContain(fragment);
  });

  it("maps spacing to newBrush's scale, with breakpoints and negatives", () => {
    expect(bs('<div class="mt-3 px-md-4 m-n2 mx-auto py-xxl-5 gap-2">x</div>').html).toBe(
      '<div class="mt-4 md:px-6 -m-2 mx-auto 2xl:py-12 gap-2">x</div>',
    );
    expect(
      bs(
        '<div class="d-flex flex-column flex-lg-row justify-content-between align-items-center">x</div>',
      ).html,
    ).toBe('<div class="flex flex-col lg:flex-row justify-between items-center">x</div>');
  });

  it("reports what needs Bootstrap's JavaScript or a different structure", () => {
    const r = bs(
      '<div class="modal fade"><select class="form-select"><option>a</option></select><button class="btn-close"></button></div>',
    );
    expect(r.unmapped.map((u) => u.class)).toEqual(["modal", "fade", "form-select", "btn-close"]);
    expect(r.unmapped.find((u) => u.class === "form-select")?.reason).toContain(
      '<span class="nb-select">',
    );
    expect(r.unmapped.find((u) => u.class === "btn-close")?.reason).toContain("aria-label");
  });

  it("only ever targets newBrush classes", () => {
    const targets = [
      ...Object.values(TABLE).flatMap((v) => (Array.isArray(v) ? v : [])),
      ...Object.values(SEMANTIC).flat(),
    ];
    expect(targets.filter((c) => !isNewBrushClass(c))).toEqual([]);
    const samples = [
      "mt-3",
      "px-md-4",
      "m-n2",
      "g-3",
      "gx-2",
      "d-md-flex",
      "flex-fill",
      "align-self-end",
      "text-md-center",
      "order-last",
      "offset-md-2",
      "row-cols-3",
      "w-50",
      "h-100",
      "top-50",
      "z-1",
      "text-primary",
      "bg-success",
      "border-danger",
      "text-bg-warning",
    ];
    expect(
      samples
        .flatMap((s) => pattern(s) ?? [`no pattern for ${s}`])
        .filter((c) => !isNewBrushClass(c)),
    ).toEqual([]);
  });
});

describe("convert_markup", () => {
  it("never changes anything outside class attributes (fuzz)", () => {
    const cls = fc.constantFrom(
      "p-4",
      "bg-blue-600",
      "btn",
      "row",
      "col-6",
      "x-y",
      "mt-3",
      "card-body",
      "rounded",
      "float-left",
      "&",
      '"',
    );
    const el = fc.record({
      tag: fc.constantFrom("div", "p", "button", "span", "a"),
      classes: fc.array(cls, { maxLength: 5 }),
      text: fc.string({ maxLength: 8 }).map((s) => s.replace(/[<&"]/g, "")),
    });
    fc.assert(
      fc.property(
        fc.array(el, { maxLength: 6 }),
        fc.constantFrom("tailwind", "bootstrap") as fc.Arbitrary<"tailwind" | "bootstrap">,
        (els, from) => {
          const html = els
            .map(
              (e) =>
                `<${e.tag}${e.classes.length ? ` class="${e.classes.join(" ").replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"` : ""} data-x="1">${e.text}</${e.tag}>`,
            )
            .join("\n");
          const r = convertMarkup({ html, from });
          expect(outsideClasses(r.html)).toBe(outsideClasses(html));
          expect(onlyNewBrush(r.html)).toEqual([]);
        },
      ),
      { numRuns: 300 },
    );
  }, 60_000);

  it("converts whole documents and limits input size", () => {
    const doc =
      '<!DOCTYPE html>\n<html lang="en"><body class="bg-gray-100"><p class="p-4">x</p></body></html>';
    expect(tw(doc).html).toBe(
      '<!DOCTYPE html>\n<html lang="en"><body class="bg-neutral-100"><p class="p-4">x</p></body></html>',
    );
    try {
      tw("x".repeat(LIMITS.htmlBytes + 1));
      expect.unreachable();
    } catch (e) {
      expect((e as ToolError).diagnostic.code).toBe("NB_INPUT_TOO_LARGE");
    }
  });
});
