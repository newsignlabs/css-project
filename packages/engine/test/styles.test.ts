import { describe, expect, it } from "vitest";
import { BUILT_IN_STYLES, createEngine, pruneStyles, styleSelectorList } from "../src/index.ts";
import { cssFor, normalize } from "./helpers.ts";

// specs/004 T026–T028: style variants (`neon:p-4`) resolve the nearest style; config `styles` picks the styles a
// build includes, for variants and for the stylesheet itself.

const selector = createEngine({ content: ["x"], themeVariants: "selector" });
const query = createEngine({ content: ["x"], themeVariants: "style-query" });
const neon = '.neon,.nb-neon,[data-nb-style="neon"]';

describe("style variants", () => {
  it("registers every built-in style and alias, after the theme variants", () => {
    const names = selector.variants().map((v) => v.name);
    for (const s of BUILT_IN_STYLES)
      for (const n of [s.name, ...s.aliases]) expect(names).toContain(n);
    expect(names.indexOf("neon")).toBeGreaterThan(names.indexOf("contrast"));
    // Sorting follows registration: a style variant's rule comes after a theme variant's.
    const css = cssFor(["neon:p-4", "dark:p-2"], selector);
    expect(css.indexOf("neon\\:p-4")).toBeGreaterThan(css.indexOf("dark\\:p-2"));
  });

  it("selector strategy: inside the style unless another style or .style-default is nearer, and on the element itself", () => {
    const css = cssFor(["neon:p-4"], selector);
    expect(css).toContain(`:where(${neon}) .neon\\:p-4:not(:where(${neon}):is(`);
    expect(css).toContain('.style-default,.nb-style-default,[data-nb-style="default"]) *)');
    expect(css).toContain(`:is(${neon}).neon\\:p-4{padding:var(--nb-space-4)}`);
  });

  it("style-query strategy: @container style(--nb-style), plus the styled element itself", () => {
    const css = cssFor(["neon:p-4"], query);
    expect(css).toContain(
      "@container style(--nb-style:neon){.neon\\:p-4{padding:var(--nb-space-4)}}",
    );
    expect(css).toContain(`:is(${neon}).neon\\:p-4{`);
  });

  it("aliases resolve to their style; prefix.styles prefixes bare names and aliases", () => {
    expect(cssFor(["glass:p-4"], selector)).toContain(
      ':where(.g-morph,.nb-g-morph,.glass,[data-nb-style="g-morph"]) .glass\\:p-4',
    );
    const prefixed = createEngine({
      content: ["x"],
      themeVariants: "selector",
      prefix: { styles: "ui-" },
    });
    expect(normalize(prefixed.generate(["neon:p-4"]).css)).toContain(
      ':is(.ui-neon,.nb-neon,[data-nb-style="neon"]).neon\\:p-4',
    );
    expect(styleSelectorList({ name: "g-morph", aliases: ["glass"] }, "nb-")).toEqual([
      ".nb-g-morph",
      ".nb-glass",
      '[data-nb-style="g-morph"]',
    ]);
  });

  it("config styles: only the included styles get variants; false gives none", () => {
    const only = createEngine({ content: ["x"], styles: ["neon"] });
    expect(only.generate(["neon:p-4"]).classes.used).toEqual(["neon:p-4"]);
    expect(only.generate(["glass:p-4"]).classes.used).toEqual([]);
    const none = createEngine({ content: ["x"], styles: false });
    expect(none.variants().some((v) => v.name === "neon")).toBe(false);
  });
});

describe("pruneStyles / selectStyles (config styles)", () => {
  const css = [
    "@layer nb.styles{",
    '.neon,.nb-neon,[data-nb-style="neon"]{--nb-style:neon}',
    ".cyber,.nb-cyber,[data-nb-style=cyber]{--nb-style:cyber}",
    ':where(.cyber,[data-nb-style="cyber"]) .nb-card:where(:not(:where([data-nb-style="cyber"]) :is([data-nb-style="neon"]) .nb-card)){clip-path:none}',
    "@media (forced-colors:active){.cyber,[data-nb-style=cyber]{color:red}}",
    "@keyframes nb-cyber-glitch{0%{translate:0}}",
    ".neon,[data-nb-style=neon],.cyber,[data-nb-style=cyber]{--merged:1}",
    '.style-default,.nb-style-default,[data-nb-style="default"]{--nb-style:default}',
    "}",
    ".app{color:red}",
  ].join("");

  it("keeps the chosen styles, the reset and everything else; drops the rest and their keyframes", () => {
    const out = pruneStyles(css, ["neon"]);
    expect(out).toContain('.neon,.nb-neon,[data-nb-style="neon"]{--nb-style:neon}');
    expect(out).not.toContain("--nb-style:cyber");
    expect(out).not.toContain("clip-path");
    expect(out).not.toContain("@media"); // emptied at-rules go too
    expect(out).not.toContain("nb-cyber-glitch");
    expect(out).toContain(".neon,[data-nb-style=neon]{--merged:1}"); // a merged rule keeps the kept style's part
    expect(out).toContain("--nb-style:default");
    expect(out).toContain(".app{color:red}");
  });

  it("false removes every style, strings and comments are left alone", () => {
    const out = pruneStyles(`${css}/* {[data-nb-style=neon]} */.x{content:"}"}`, false);
    expect(out).not.toMatch(/--nb-style:(neon|cyber)/);
    expect(out).toContain('.x{content:"}"}');
    expect(out).toContain("--nb-style:default");
  });

  it("selectStyles applies config styles, and leaves CSS untouched for all", () => {
    expect(createEngine({ content: ["x"] }).selectStyles(css)).toBe(css);
    expect(createEngine({ content: ["x"], styles: ["cyber"] }).selectStyles(css)).not.toContain(
      "--nb-style:neon",
    );
  });
});
