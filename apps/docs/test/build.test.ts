import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { manifest } from "../src/lib/manifest.ts";

// specs/001 T080–T081 — the built site (turbo runs `build` before `test`): a page per manifest component with its
// live examples, and reference tables listing every token, utility family, variant, theme and style.

const dist = new URL("../dist/", import.meta.url);
const page = (path: string) =>
  readFileSync(new URL(path ? `${path}/index.html` : "index.html", dist), "utf8");
const BASE = "/site/";
/** Every built HTML file, relative to dist (index.html, components/button/index.html…). */
const htmlFiles = (dir = ""): string[] =>
  readdirSync(new URL(dir || ".", dist)).flatMap((name) => {
    const rel = dir + name;
    if (statSync(new URL(rel, dist)).isDirectory()) return htmlFiles(`${rel}/`);
    return rel.endsWith(".html") ? [rel] : [];
  });
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
      expect(overview).toContain(`href="${BASE}components/${c.name}/"`);
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

  it("keeps every internal link and asset under /site/, pointing at a built file", () => {
    // The site is served from /site/ on Catalyst Slate, so a root-relative URL outside it would 404.
    const broken: string[] = [];
    for (const file of htmlFiles()) {
      const html = readFileSync(new URL(file, dist), "utf8");
      // Relative links (the MDX pages use them) are resolved against the page's own URL.
      const pageUrl = new URL(`http://x${BASE}${file.replace(/index\.html$/, "")}`);
      for (const [, attr] of html.matchAll(/\s(?:href|src)="([^"#?]+)[^"]*"/g)) {
        if (!attr || /^(https?:|mailto:|data:|\/\/)/.test(attr)) continue;
        const path = new URL(attr, pageUrl).pathname;
        if (!path.startsWith(BASE)) {
          broken.push(`${file}: ${attr} (outside ${BASE})`);
          continue;
        }
        const target = decodeURIComponent(path.slice(BASE.length));
        const onDisk = target === "" || target.endsWith("/") ? `${target}index.html` : target;
        if (!existsSync(new URL(onDisk, dist))) broken.push(`${file}: ${attr}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it("is published: site/ (served by Catalyst Slate) matches this build — run `pnpm site` if not", () => {
    const site = new URL("../../../site/", import.meta.url);
    const files = (root: URL, dir = ""): string[] =>
      readdirSync(new URL(dir || ".", root)).flatMap((name) =>
        statSync(new URL(dir + name, root)).isDirectory()
          ? files(root, `${dir}${name}/`)
          : [dir + name],
      );
    const built = files(dist).sort();
    expect(files(site).sort()).toEqual(built);
    const stale = built.filter(
      (f) => !readFileSync(new URL(f, dist)).equals(readFileSync(new URL(f, site))),
    );
    expect(stale).toEqual([]);
  });

  it("never names other CSS frameworks", () => {
    for (const file of htmlFiles()) {
      expect(readFileSync(new URL(file, dist), "utf8"), file).not.toMatch(/bootstrap|tailwind/i);
    }
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
