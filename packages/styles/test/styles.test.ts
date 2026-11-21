import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { Style } from "@newbrush/schema";
import { describe, expect, it } from "vitest";
import {
  authorityCss,
  checkRecipes,
  checkUnique,
  expandRecipes,
  type LoadedStyle,
  parseStyle,
  resetCss,
  resolveOverrides,
  restoreValue,
  styleClasses,
  styleCss,
  styleSelectors,
  tokenIndex,
} from "../lib/styles.ts";

// specs/004-design-styles T006–T007: style.json validation, marker + override CSS, .style-default reset.
const require = createRequire(import.meta.url);
const tokens = tokenIndex(
  JSON.parse(readFileSync(require.resolve("@newbrush/tokens/tokens.json"), "utf8")),
  readFileSync(require.resolve("@newbrush/tokens/tokens.css"), "utf8"),
);
const dist = (file: string) => readFileSync(new URL(`../dist/${file}`, import.meta.url), "utf8");
const style = (
  extra: Record<string, unknown> = {},
  more: Partial<LoadedStyle> = {},
): LoadedStyle => ({
  source: parseStyle(
    {
      name: "g-morph",
      aliases: ["glass"],
      title: "G-morph",
      description: "Glass.",
      since: "0.4.0",
      ...extra,
    },
    "test",
  ),
  ...more,
});

describe("built-in styles", () => {
  const manifest = JSON.parse(dist("manifest.json")) as { styles: Style[] };
  const names = manifest.styles.map((s) => s.name);

  it("ships the six v1.0 styles with the contract's aliases", () => {
    expect(names.sort()).toEqual(["cyber", "g-morph", "minimal", "n-morph", "neon", "pixelate"]);
    const aliases = Object.fromEntries(manifest.styles.map((s) => [s.name, s.aliases]));
    expect(aliases).toMatchObject({
      "g-morph": ["glass"],
      "n-morph": ["neumorph"],
      pixelate: ["pixel"],
    });
    for (const s of manifest.styles) expect(() => Style.parse(s)).not.toThrow();
  });

  it("all six styles have a look of their own (S1, S2)", () => {
    for (const name of ["minimal", "g-morph", "neon", "cyber", "n-morph", "pixelate"]) {
      const s = manifest.styles.find((x) => x.name === name);
      expect(s?.tokens.length, name).toBeGreaterThan(0);
      expect(s?.recipes.length, name).toBeGreaterThan(0);
    }
    expect(dist("g-morph.css")).toContain("backdrop-filter");
  });

  it("has one folder per style whose name matches", () => {
    const dirs = readdirSync(new URL("../src/", import.meta.url));
    expect(dirs.sort()).toEqual(names.sort());
  });

  it("writes dist/<name>.css per style and styles.css with all of them, reset last", () => {
    const all = dist("styles.css");
    for (const name of names) {
      expect(dist(`${name}.css`)).toContain(`--nb-style: ${name};`);
      expect(all).toContain(`[data-nb-style="${name}"]`);
    }
    expect(all.lastIndexOf(".style-default")).toBeGreaterThan(
      all.lastIndexOf("--nb-style: pixelate"),
    );
  });

  it("only ever matches inside a style or .style-default (the default style is untouched)", () => {
    const code = dist("styles.css").replace(/\/\*[\s\S]*?\*\//g, "");
    const selectors = [...code.matchAll(/([^{};]+)\{/g)]
      .map((m) => (m[1] ?? "").trim())
      .filter((s) => !s.startsWith("@"));
    expect(selectors.length).toBeGreaterThan(0);
    // Split each list at top-level commas only (`:where(a, b)` stays whole).
    const split = (list: string) => {
      const out = [""];
      let depth = 0;
      for (const ch of list) {
        if (ch === "(") depth++;
        if (ch === ")") depth--;
        if (ch === "," && depth === 0) out.push("");
        else out[out.length - 1] += ch;
      }
      return out.map((x) => x.replace(/\s+/g, " ").trim());
    };
    // A bare marker (.g-morph, .style-default, [data-nb-style=…]) or a selector that requires one: the guard in
    // apps/visual-tests/specs/styles-default.spec.ts relies on every rule mentioning data-nb-style.
    // Keyframe steps (0%, 33%, 100%, from, to) are not selectors.
    const keyframe = /^(\d+%|from|to)(\s*,\s*(\d+%|from|to))*$/;
    const rules = selectors.filter((list) => !keyframe.test(list));
    for (const list of rules)
      for (const sel of split(list))
        expect(sel).toMatch(/^\.[a-z0-9-]+$|\[data-nb-style="[a-z0-9-]+"\]/);
    for (const list of rules) expect(list).toContain("data-nb-style");
  });
});

describe("selectors", () => {
  it("bare, nb- and alias classes plus the attribute", () => {
    expect(styleSelectors(style().source)).toEqual([
      ".g-morph",
      ".nb-g-morph",
      ".glass",
      '[data-nb-style="g-morph"]',
    ]);
  });

  it("prefix.styles prefixes bare names and aliases; the nb- form stays", () => {
    expect(styleClasses(style().source, "ui-")).toEqual(["ui-g-morph", "nb-g-morph", "ui-glass"]);
    expect(styleClasses(style().source, "nb-")).toEqual(["nb-g-morph", "nb-glass"]);
  });
});

describe("style.json validation", () => {
  it("reserves default and generated nb- aliases", () => {
    expect(() => style({ name: "default" })).toThrow(/reserved/);
    expect(() => style({ aliases: ["nb-glass"] })).toThrow(/nb-/);
  });

  it("allows per-scheme overrides for colours only (they compile to light-dark())", () => {
    expect(() => style({ schemes: { dark: { radius: { md: { $value: "0" } } } } })).toThrow(
      /only colours can differ per scheme/,
    );
    expect(() =>
      style({ schemes: { dark: { color: { surface: { default: { $value: "black" } } } } } }),
    ).not.toThrow();
  });

  it("rejects names or aliases used twice", () => {
    expect(() =>
      checkUnique([
        { name: "g-morph", aliases: ["glass"] },
        { name: "glass", aliases: [] },
      ]),
    ).toThrow(/glass/);
  });
});

describe("token overrides", () => {
  it("turns references into var() and a self-derived token into its -base alias", () => {
    const overrides = resolveOverrides(
      style({
        tokens: {
          radius: { md: { $value: "{radius.lg}" } },
          color: {
            surface: {
              raised: { $value: "color-mix(in oklch, {color.surface.raised} 60%, transparent)" },
              default: { $value: "{color.surface.raised}" },
            },
          },
        },
      }).source,
      tokens,
    );
    expect(overrides).toEqual([
      { path: "radius.md", cssVar: "--nb-radius-md", value: "var(--nb-radius-lg)" },
      {
        path: "color.surface.raised",
        cssVar: "--nb-color-surface-raised",
        value: "color-mix(in oklch, var(--nb-color-surface-raised-base) 60%, transparent)",
      },
      {
        path: "color.surface.default",
        cssVar: "--nb-color-surface",
        value: "var(--nb-color-surface-raised-base)",
      },
    ]);
  });

  it("a reference to another token the style overrides means that token's default value", () => {
    const overrides = resolveOverrides(
      style({
        tokens: {
          radius: { md: { $value: "{radius.lg}" }, lg: { $value: "{radius.xl}" } },
          color: {
            border: { default: { $value: "{color.border.strong}" }, strong: { $value: "red" } },
          },
        },
      }).source,
      tokens,
    );
    const lg = tokens.get("radius.lg")?.declared;
    expect(lg).toMatch(/rem$/);
    expect(overrides.find((o) => o.path === "radius.md")?.value).toBe(lg);
    expect(overrides.find((o) => o.path === "color.border.default")?.value).toBe(
      "var(--nb-color-border-strong-base)",
    );
  });

  it("refuses to derive from a themed token without a -base alias that it also overrides", () => {
    // Every semantic colour has an alias now; a themed token without one is synthetic.
    const without = new Map(tokens);
    const accent = without.get("color.accent.default");
    if (accent) without.set(accent.name, { ...accent, hasBase: false });
    expect(() =>
      resolveOverrides(
        style({
          tokens: {
            color: {
              accent: { default: { $value: "red" } },
              "on-accent": { $value: "{color.accent}" },
            },
          },
        }).source,
        without,
      ),
    ).toThrow(/derives from \{color.accent\}/);
  });

  it("compiles schemes to light-dark(), the missing side being the theme's own value", () => {
    const overrides = resolveOverrides(
      style({
        schemes: {
          dark: {
            color: {
              surface: {
                default: { $value: "color-mix(in oklch, {color.surface.default} 50%, black)" },
              },
            },
          },
          light: { color: { text: { default: { $value: "{color.accent}" } } } },
        },
      }).source,
      tokens,
    );
    expect(overrides.find((o) => o.path === "color.surface.default")).toMatchObject({
      value:
        "light-dark(var(--nb-color-surface-base), color-mix(in oklch, var(--nb-color-surface-base) 50%, black))",
      schemes: { light: "var(--nb-color-surface-base)" },
    });
    expect(overrides.find((o) => o.path === "color.text.default")?.value).toBe(
      "light-dark(var(--nb-color-accent), var(--nb-color-text-base))",
    );
    expect(() =>
      resolveOverrides(
        style({
          tokens: { color: { text: { default: { $value: "red" } } } },
          schemes: { dark: { color: { text: { default: { $value: "blue" } } } } },
        }).source,
        tokens,
      ),
    ).toThrow(/both in tokens and in schemes/);
  });

  it("rejects unknown tokens, unknown references and values that would break out of the rule", () => {
    const bad = (tokensTree: Record<string, unknown>) => () =>
      resolveOverrides(style({ tokens: tokensTree }).source, tokens);
    expect(bad({ radius: { huge: { $value: "9rem" } } })).toThrow(/unknown token "radius.huge"/);
    expect(bad({ radius: { md: { $value: "{radius.huge}" } } })).toThrow(
      /unknown token \{radius.huge\}/,
    );
    expect(bad({ radius: { md: { $value: "0} body{color:red" } } })).toThrow(/invalid value/);
  });

  it("emits the marker and overrides in nb.styles, also on <html> via <body> and on theme islands inside", () => {
    const css = styleCss(style({ tokens: { radius: { md: { $value: "{radius.lg}" } } } }), {
      tokens,
      others: [".neon", ".style-default"],
    });
    expect(css).toContain(
      '@layer nb.styles {\n  .g-morph,\n  .nb-g-morph,\n  .glass,\n  [data-nb-style="g-morph"],\n  :where(',
    );
    const is = ':is(.g-morph, .nb-g-morph, .glass, [data-nb-style="g-morph"])';
    expect(css).toContain(
      `:where(:root:has(> body${is}), ${is} [data-nb-theme]:not(:is(.neon, .style-default), ${is} :is(.neon, .style-default) [data-nb-theme]))`,
    );
    expect(css).toContain("--nb-style: g-morph;\n    --nb-radius-md: var(--nb-radius-lg);");
    expect(css).not.toContain("nb.tokens");
    expect(css).not.toContain("Dark-first");
  });

  it("dark-first styles take the dark theme unless a theme is explicit, never over the contrast theme", () => {
    const dark = new Map([
      ["color-scheme", "dark"],
      ["--nb-color-surface-base", "var(--nb-color-neutral-950)"],
    ]);
    const css = styleCss(style({ preferredScheme: "dark" }), { tokens, darkTheme: dark });
    const is = ':is(.g-morph, .nb-g-morph, .glass, [data-nb-style="g-morph"])';
    expect(css).toContain("@media not (prefers-contrast: more) {");
    expect(css).toContain(`:where(${is}:not([data-nb-theme], [data-nb-theme] *)),`);
    expect(css).toContain(`:where(:root:not([data-nb-theme]):has(> body${is}))`);
    expect(css).toContain("color-scheme: dark;");
    expect(css.indexOf("Dark-first")).toBeLessThan(css.indexOf("--nb-style: g-morph"));
    // A dark-first style repaints itself: colours inherited from above were computed in the light scheme.
    expect(css).toContain("color: var(--nb-color-text);");
    expect(css).toContain("background-color: var(--nb-color-surface);");
    expect(() => styleCss(style({ preferredScheme: "dark" }), { tokens })).toThrow(/dark theme/);
  });

  it("repaints only what the style changes", () => {
    const css = (tree: Record<string, unknown>) => styleCss(style({ tokens: tree }), { tokens });
    expect(css({ radius: { md: { $value: "0" } } })).not.toContain("color: var(--nb-color-text)");
    const text = css({ color: { text: { muted: { $value: "red" } } } });
    expect(text).toContain("color: var(--nb-color-text);");
    expect(text).not.toContain("background-color: var(--nb-color-surface)");
    expect(css({ font: { family: { sans: { $value: "serif" } } } })).toContain(
      "font-family: var(--nb-font-family-sans);",
    );
  });
});

describe("recipes", () => {
  it("expands :--style to the zero-specificity style selector", () => {
    const css = styleCss(
      style(
        {},
        { recipes: "@layer nb.styles {\n  :--style .nb-card { backdrop-filter: blur(8px); }\n}\n" },
      ),
      { tokens },
    );
    expect(css).toContain(
      '@layer nb.styles {\n  :where(.g-morph, .nb-g-morph, .glass, [data-nb-style="g-morph"]) .nb-card',
    );
  });

  it("keeps recipes to the nearest style: another style or a reset in between turns them off", () => {
    expect(expandRecipes("@layer nb.styles { :--style .x, .y { a: b } }", [".s"], [".o"])).toBe(
      "@layer nb.styles { :where(.s) .x:where(:not(:where(.s) :is(.o) .x)), .y { a: b } }",
    );
    // Pseudo-elements stay last; rules without a descendant (body:--style::after) are left alone.
    expect(expandRecipes(":--style .x::after {}", [".s"], [".o"])).toBe(
      ":where(.s) .x:where(:not(:where(.s) :is(.o) .x))::after {}",
    );
    expect(expandRecipes("body:--style::after {}", [".s"], [".o"])).toBe(
      "body:where(.s)::after {}",
    );
  });

  it("expands :--contrast to the style inside, on or around the contrast theme", () => {
    expect(expandRecipes(":--contrast .x {}", [".s"])).toBe(
      ':where([data-nb-theme="contrast"]:is(.s), [data-nb-theme="contrast"] :is(.s), :is(.s) [data-nb-theme="contrast"]) .x {}',
    );
  });

  it("requires every rule to sit in @layer nb.styles", () => {
    expect(() => checkRecipes("@layer nb.styles { a { b: c } }", "x")).not.toThrow();
    expect(() => checkRecipes(".nb-card { color: red }", "x")).toThrow(/@layer nb.styles/);
    expect(() => checkRecipes("@layer nb.utilities { a { b: c } }", "x")).toThrow();
    expect(() => checkRecipes("@import url(x.css);", "x")).toThrow();
    expect(() => checkRecipes("@layer nb.styles { a { b: c }", "x")).toThrow(/unbalanced/);
  });
});

describe("contrast theme and forced colors outrank the style", () => {
  it("restores every overridden colour under the contrast theme, prefers-contrast and forced colors", () => {
    const css = authorityCss(
      style({
        tokens: {
          radius: { md: { $value: "0" } },
          color: { surface: { raised: { $value: "red" } } },
        },
      }),
      tokens,
      styleSelectors(style().source),
    );
    expect(css).toContain("@layer nb.styles {");
    expect(css).toContain(
      '[data-nb-theme="contrast"]:is(.g-morph, .nb-g-morph, .glass, [data-nb-style="g-morph"])',
    );
    expect(css).toContain("@media (prefers-contrast: more) and (prefers-color-scheme: light)");
    expect(css).toContain("@media (forced-colors: active)");
    // Theme islands inside the style and <html> styled through <body> are covered too.
    expect(css).toContain(
      ':is(.g-morph, .nb-g-morph, .glass, [data-nb-style="g-morph"]) [data-nb-theme="contrast"]',
    );
    expect(css).toContain(':root[data-nb-theme="contrast"]:has(> body:is(');
    expect(
      css.split("--nb-color-surface-raised: var(--nb-color-surface-raised-base);"),
    ).toHaveLength(4);
    expect(css).not.toContain("--nb-radius-md"); // only colours: radius and density stay styled
  });

  it("is empty when the style changes no colour", () => {
    expect(
      authorityCss(style({ tokens: { radius: { md: { $value: "0" } } } }), tokens, [".x"]),
    ).toBe("");
  });
});

describe(".style-default", () => {
  it("restores every overridden token: -base aliases for themed tokens, the declaration otherwise", () => {
    const css = resetCss(
      [
        style({
          tokens: {
            radius: { md: { $value: "0" } },
            color: { surface: { raised: { $value: "red" } } },
          },
        }),
      ],
      tokens,
    );
    const radius = tokens.get("radius.md");
    expect(css).toContain('.style-default,\n  .nb-style-default,\n  [data-nb-style="default"] {');
    expect(css).toContain("--nb-style: default;");
    expect(css).toContain(`--nb-radius-md: ${radius?.declared};`);
    expect(css).toContain("--nb-color-surface-raised: var(--nb-color-surface-raised-base);");
  });

  it("restores in nb.styles, after the styles", () => {
    expect(resetCss([style()], tokens)).toContain("@layer nb.styles {");
  });

  it("refuses to override a themed token it could not restore", () => {
    // Every semantic colour has a -base alias; a themed token without one is synthetic.
    expect(tokens.get("color.on-accent")?.hasBase).toBe(true);
    expect(() =>
      restoreValue({
        name: "x.y",
        cssVar: "--nb-x-y",
        themed: true,
        declared: "red",
        hasBase: false,
      }),
    ).toThrow(/BASE_ALIAS_GROUPS/);
  });
});
