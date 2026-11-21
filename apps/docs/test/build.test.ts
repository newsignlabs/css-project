import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { manifest } from "../src/lib/manifest.ts";

// specs/001 T080–T081 — the built site (turbo runs `build` before `test`): a page per manifest component with its
// live examples, and reference tables listing every token, utility family, variant, theme and style.

const dist = new URL("../dist/", import.meta.url);
const page = (path: string) =>
  readFileSync(new URL(path ? `${path}/index.html` : "index.html", dist), "utf8");
const squash = (html: string) => html.replace(/\s+/g, " ").replace(/> </g, "><").trim();

describe("docs build", () => {
  it("has a page per component, with every example rendered live", () => {
    for (const c of manifest.components) {
      const html = squash(page(`components/${c.name}`));
      expect(html, c.name).toMatch(
        new RegExp(`<h1 id="_top"[^>]*>${c.title.replace("&", "&amp;")}</h1>`),
      );
      for (const e of c.examples) {
        expect(html, `${c.name}: ${e.title}`).toContain(
          `data-example="${e.title}">${squash(e.html)}</div>`,
        );
      }
      for (const m of c.modifiers) expect(html, c.name).toContain(`.${m.className}`);
    }
  });

  it("lists every component in the sidebar and on the overview", () => {
    const overview = page("components");
    for (const c of manifest.components) {
      expect(overview).toContain(`href="/components/${c.name}/"`);
    }
  });

  it("lists every token, utility family, variant, theme and style", () => {
    const tokens = page("reference/tokens");
    for (const t of manifest.tokens) expect(tokens).toContain(`data-token="${t.cssVar}"`);
    const utilities = page("reference/utilities");
    for (const u of manifest.utilities) expect(utilities).toContain(`data-utility="${u.name}"`);
    const themes = page("reference/themes");
    for (const v of manifest.variants) expect(themes).toContain(`data-variant="${v.name}"`);
    for (const t of manifest.themes) expect(themes).toContain(`data-theme-name="${t.name}"`);
    const styles = page("reference/styles");
    for (const s of manifest.styles) expect(styles).toContain(`data-style="${s.name}"`);
  });

  it("has the home page and the getting-started guide", () => {
    expect(page("")).toContain("Get started");
    expect(page("guides/getting-started")).toContain("@newbrush/vite");
  });

  it("orders cascade layers: newBrush defaults < Starlight < newBrush components and utilities", () => {
    const css = readdirSync(new URL("_astro/", dist))
      .filter((f) => f.endsWith(".css"))
      .map((f) => readFileSync(new URL(`_astro/${f}`, dist), "utf8"));
    const withNb = css.find((c) => c.includes("nb.components"));
    expect(withNb).toBeDefined();
    const order: string[] = [];
    for (const m of (withNb ?? "").matchAll(/@layer\s+([a-z][a-z.,\s]*?)\s*[;{]/g)) {
      for (const name of (m[1] ?? "")
        .split(",")
        .map((s) => s.trim().split(".").slice(0, 2).join(".")))
        if (!order.includes(name) && !name.startsWith("starlight.")) order.push(name);
    }
    expect(order).toEqual([
      "nb.reset",
      "nb.tokens",
      "nb.base",
      "starlight",
      "nb.layout",
      "nb.components",
      "nb.styles",
      "nb.utilities",
    ]);
  });

  it("syncs newBrush themes with Starlight's theme picker", () => {
    expect(page("")).toContain('setAttribute("data-nb-theme"');
    expect(existsSync(new URL("pagefind/", dist))).toBe(true);
  });
});
