import { readdir, readFile } from "node:fs/promises";
import { ResolvedToken } from "@newbrush/schema";
import { beforeAll, describe, expect, it } from "vitest";
import { aliasPath, cssVarName } from "../lib/names.ts";

type Built = { themes: { name: string }[]; tokens: ResolvedToken[] };
let built: Built;
let css: string;
const sources: Record<string, unknown> = {};

async function readTree(dir: URL): Promise<void> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const url = new URL(entry.name + (entry.isDirectory() ? "/" : ""), dir);
    if (entry.isDirectory()) await readTree(url);
    else sources[url.pathname] = JSON.parse(await readFile(url, "utf8"));
  }
}

beforeAll(async () => {
  built = JSON.parse(await readFile(new URL("../dist/tokens.json", import.meta.url), "utf8"));
  css = await readFile(new URL("../dist/css/tokens.css", import.meta.url), "utf8");
  await readTree(new URL("../src/", import.meta.url));
});

describe("naming", () => {
  it("drops a trailing default segment", () => {
    expect(cssVarName(["color", "surface", "default"])).toBe("--nb-color-surface");
    expect(cssVarName(["space", "0-5"])).toBe("--nb-space-0-5");
  });

  it("parses single aliases only", () => {
    expect(aliasPath("{color.neutral.50}")).toEqual(["color", "neutral", "50"]);
    expect(aliasPath("calc({space.1} * 2)")).toBeNull();
    expect(aliasPath(4)).toBeNull();
  });

  it("produces unique CSS variable names", () => {
    const vars = built.tokens.map((t) => t.cssVar);
    expect(new Set(vars).size).toBe(vars.length);
  });
});

describe("resolved tokens", () => {
  it("validate against @newbrush/schema", () => {
    for (const token of built.tokens) expect(() => ResolvedToken.parse(token)).not.toThrow();
  });

  it("resolve every alias to an existing token", () => {
    const names = new Set(built.tokens.map((t) => t.name));
    for (const t of built.tokens)
      for (const ref of t.references) expect(names, `${t.name} → ${ref}`).toContain(ref);
  });

  it("contain no unresolved aliases", () => {
    for (const t of built.tokens) {
      expect(t.value, t.name).not.toMatch(/\{[^}]+\}/);
      for (const v of Object.values(t.themes)) expect(v, t.name).not.toMatch(/\{[^}]+\}/);
    }
  });

  it("theme every semantic color for dark and contrast (no orphans)", () => {
    const semanticColors = built.tokens.filter((t) => t.tier === "semantic" && t.type === "color");
    expect(semanticColors.length).toBeGreaterThan(30);
    for (const t of semanticColors)
      expect(Object.keys(t.themes).sort(), t.name).toEqual(["contrast", "dark"]);
  });

  it("only let semantic/component tokens carry theme overrides", () => {
    for (const t of built.tokens.filter((x) => x.tier === "primitive"))
      expect(t.themes, t.name).toEqual({});
  });

  it("keep semantic and component tokens referencing other tokens, never raw colors", () => {
    for (const t of built.tokens.filter((x) => x.tier !== "primitive" && x.type === "color")) {
      expect(t.references.length, t.name).toBe(1);
    }
  });

  it("are all read from source files", () => {
    expect(Object.keys(sources).length).toBeGreaterThan(10);
  });
});

describe("tokens.css", () => {
  it("lives entirely in the nb.tokens layer", () => {
    expect(css.match(/@layer [^{;]+/g)).toEqual(["@layer nb.tokens "]);
  });

  it("sets the --nb-scheme marker for every theme (class-grammar.md §Theme variants)", () => {
    expect(css).toContain("--nb-scheme: light;");
    expect(css.match(/--nb-scheme: dark;/g)).toHaveLength(2); // attribute + prefers-color-scheme
    expect(css).toMatch(/\[data-nb-theme="dark"\]/);
    expect(css).toMatch(/@media \(prefers-color-scheme: dark\)/);
    expect(css).toMatch(/@media \(prefers-contrast: more\)/);
  });

  it("re-declares semantic tokens on light and contrast islands", () => {
    expect(css).toMatch(
      /:root,\n\s+\[data-nb-theme="light"\],\n\s+\[data-nb-theme="contrast"\] \{/,
    );
  });

  it("keeps references live through var()", () => {
    expect(css).toContain("--nb-color-surface: var(--nb-color-neutral-50);");
  });

  it("matches the snapshot", async () => {
    await expect(css).toMatchFileSnapshot("./__snapshots__/tokens.css");
  });
});
