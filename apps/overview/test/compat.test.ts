import { describe, expect, it } from "vitest";
import { addColorFallbacks, compat, flattenLayers, parse } from "../compat.ts";

const squash = (css: string) => css.replace(/\s+/g, "");

describe("parse", () => {
  it("splits statements and blocks, ignoring braces in strings and comments", () => {
    const nodes = parse(
      `@layer a, b; /* { */ .x{content:"}"} @media (min-width:1px){.y{color:red}}`,
    );
    expect(nodes.map((n) => n.prelude)).toEqual(["@layer a, b", ".x", "@media (min-width:1px)"]);
    expect(nodes[1]?.body).toBe(`content:"}"`);
  });
});

describe("flattenLayers", () => {
  it("emits rules in layer order (from the order statement), unlayered rules last", () => {
    const out = flattenLayers(
      "@layer nb.reset, nb.tokens, nb.utilities; .page{a:1} @layer nb.utilities{.u{a:2}} @layer nb.tokens{:root{a:3}} @layer nb.reset{*{a:4}}",
    );
    expect(squash(out)).toBe("*{a:4}:root{a:3}.u{a:2}.page{a:1}");
  });

  it("clones conditional group rules into each layer they contribute to", () => {
    const out = flattenLayers(
      "@layer a, b; @media (min-width:1px){@layer b{.b{x:1}} @layer a{.a{x:2}} .c{x:3}}",
    );
    expect(squash(out)).toBe(
      "@media(min-width:1px){.a{x:2}}@media(min-width:1px){.b{x:1}}@media(min-width:1px){.c{x:3}}",
    );
  });

  it("puts sub-layers before their parent's own rules", () => {
    expect(squash(flattenLayers("@layer p{.own{x:1} @layer child{.child{x:2}}}"))).toBe(
      ".child{x:2}.own{x:1}",
    );
  });

  it("leaves unlayered CSS untouched", () => {
    expect(squash(flattenLayers(".a{x:1}@media print{.b{x:2}}"))).toBe(
      ".a{x:1}@mediaprint{.b{x:2}}",
    );
  });
});

describe("addColorFallbacks", () => {
  it("guards var()-based color-mix and relative colours behind @supports with a plain fallback", () => {
    const out = addColorFallbacks(
      ".n{position:sticky;background-color:color-mix(in oklch, var(--s) 85%, transparent)}",
    );
    expect(out).toBe(
      ".n{position:sticky;background-color:var(--s)}@supports (color:color-mix(in oklch,red 50%,red)) and (color:oklch(from red l c h)){.n{background-color:color-mix(in oklch, var(--s) 85%, transparent)}}",
    );
  });
});

describe("compat", () => {
  it("removes cascade layers and lowers OKLCH for older engines, keeping the license", () => {
    const out = compat("/*! license */\n@layer a{.x{color:oklch(60% .2 250);margin-inline:1rem}}");
    expect(out.startsWith("/*! license */")).toBe(true);
    expect(out).not.toContain("@layer");
    expect(out).toMatch(/\.x\{color:#[0-9a-f]{3,6};/);
    expect(out).toContain("margin-inline-start:1rem");
  });
});
