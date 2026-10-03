import { describe, expect, it } from "vitest";
import { createEngine } from "../src/index.ts";
import { cssFor, engine, normalize } from "./helpers.ts";

// T036 — the contract table in specs/001-core-framework/contracts/class-grammar.md.
describe("class grammar contract", () => {
  const rows: [string, string][] = [
    ["p-4", ".p-4{padding:var(--nb-space-4)}"],
    ["-mt-2", ".-mt-2{margin-block-start:calc(var(--nb-space-2) * -1)}"],
    [
      "md:grid-cols-3",
      "@media (width >= 48rem){.md\\:grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}}",
    ],
    ["@lg:flex-row", "@container (width >= 64rem){.\\@lg\\:flex-row{flex-direction:row}}"],
    [
      "hover:bg-brand-600/80",
      "@media (hover:hover){.hover\\:bg-brand-600\\/80:hover{background-color:oklch(from var(--nb-color-brand-600) l c h / 0.8)}}",
    ],
    [
      "group-hover:opacity-100",
      "@media (hover:hover){:where(.group):hover .group-hover\\:opacity-100{opacity:1}}",
    ],
    ["w-[37ch]", ".w-\\[37ch\\]{inline-size:37ch}"],
    ["p-4!", ".p-4\\!{padding:var(--nb-space-4) !important}"],
  ];

  it.each(rows)("%s", (cls, expected) => {
    expect(cssFor([cls])).toContain(normalize(expected));
  });

  it("has-[:checked]:ring-2 adds a :has() condition", () => {
    expect(cssFor(["has-[:checked]:ring-2"])).toContain(
      ".has-\\[\\:checked\\]\\:ring-2:has(:checked){",
    );
  });

  it("declares the full layer order, then wraps utilities in nb.utilities", () => {
    expect(cssFor(["p-4"])).toMatch(
      /^@layer nb\.reset,nb\.tokens,nb\.base,nb\.layout,nb\.components,nb\.utilities;@layer nb\.utilities\{/,
    );
  });
});

describe("parse()", () => {
  it("returns the AST from data-model.md", () => {
    expect(engine.parse("md:hover:-mt-2!")).toEqual({
      raw: "md:hover:-mt-2!",
      variants: ["md", "hover"],
      negative: true,
      utility: "mt",
      value: "2",
      important: true,
    });
  });

  it("resolves the longest registered root", () => {
    expect(engine.parse("grid-cols-3")).toMatchObject({ utility: "grid-cols", value: "3" });
    expect(engine.parse("bg-brand-600/80")).toMatchObject({
      utility: "bg",
      value: "brand-600",
      modifier: "80",
    });
  });

  it("keeps fractions as values", () => {
    expect(engine.parse("w-1/2")).toMatchObject({ utility: "w", value: "1/2" });
  });

  it("parses arbitrary values and converts underscores to spaces", () => {
    expect(engine.parse("grid-cols-[1fr_auto]")).toMatchObject({
      utility: "grid-cols",
      arbitrary: "1fr auto",
    });
    expect(cssFor(["grid-cols-[1fr_auto]"])).toContain("grid-template-columns:1fr auto");
  });

  it("supports custom-property shorthand", () => {
    expect(cssFor(["bg-(--brand)"])).toContain("background-color:var(--brand)");
  });

  it("parses static utilities", () => {
    expect(engine.parse("flex")).toMatchObject({ utility: "flex", variants: [] });
  });

  it("returns null for unknown utilities and variants", () => {
    expect(engine.parse("not-a-utility")).toBeNull();
    expect(engine.parse("bogus:p-4")).toBeNull();
    expect(engine.parse("p-banana")).toBeNull();
  });

  it("honours the utility prefix from config", () => {
    const prefixed = createEngine({ content: ["x"], prefix: { utilities: "nb-" } });
    expect(prefixed.parse("md:nb-p-4")).toMatchObject({ utility: "p", value: "4" });
    expect(prefixed.parse("p-4")).toBeNull();
    expect(cssFor(["-nb-mt-2"], prefixed)).toContain(".-nb-mt-2{");
  });
});

describe("variants", () => {
  it("orders responsive variants mobile-first", () => {
    const css = cssFor(["lg:p-8", "p-2", "md:p-4", "sm:p-3"]);
    const order = ["p-2", "sm\\:p-3", "md\\:p-4", "lg\\:p-8"].map((c) => css.indexOf(`.${c}{`));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order.every((i) => i >= 0)).toBe(true);
  });

  it("keeps pseudo-elements after pseudo-classes", () => {
    expect(cssFor(["hover:before:opacity-50"])).toContain(":hover::before{");
  });

  it("composes peer, aria, data and arbitrary selector variants", () => {
    expect(cssFor(["peer-checked:opacity-100"])).toContain(
      ":where(.peer):checked~.peer-checked\\:opacity-100{",
    );
    expect(cssFor(["aria-expanded:rotate-180"])).toContain('[aria-expanded="true"]{');
    expect(cssFor(["data-[state=open]:block"])).toContain("[data-state=open]{");
    expect(cssFor(["[&>*]:p-2"])).toContain(".\\[\\&\\>\\*\\]\\:p-2>*{");
  });

  it("supports motion, print, direction, supports and forced-colors variants", () => {
    expect(cssFor(["motion-reduce:transition-none"])).toContain(
      "@media (prefers-reduced-motion:reduce)",
    );
    expect(cssFor(["print:hidden"])).toContain("@media print");
    expect(cssFor(["rtl:rotate-180"])).toContain(":dir(rtl){");
    expect(cssFor(["supports-[display:grid]:grid"])).toContain("@supports (display:grid)");
    expect(cssFor(["forced-colors:border"])).toContain("@media (forced-colors:active)");
  });

  it("resolves dark: against the nearest theme with the selector strategy (class-grammar.md §Theme variants)", () => {
    const css = cssFor(["dark:text-neutral-50"]);
    expect(css).toContain(
      ":where([data-nb-theme=dark]) .dark\\:text-neutral-50:not(:where([data-nb-theme=dark] [data-nb-theme=light]) *)",
    );
    expect(css).toContain("[data-nb-theme=dark].dark\\:text-neutral-50");
    expect(css).toContain("@media (prefers-color-scheme:dark)");
  });

  it("uses a style query with the style-query strategy", () => {
    const e = createEngine({ content: ["x"], themeVariants: "style-query" });
    const css = cssFor(["dark:text-neutral-50"], e);
    expect(css).toContain("@container style(--nb-scheme:dark){.dark\\:text-neutral-50{");
    expect(css).toContain("[data-nb-theme=dark].dark\\:text-neutral-50{");
  });
});
