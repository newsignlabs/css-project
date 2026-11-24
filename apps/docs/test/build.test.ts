import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { manifest } from "../src/lib/manifest.ts";
import { codeFromHash, decode } from "../src/playground/share.ts";

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
      expect(overview).toContain(`href="${BASE}components/${c.name}/index.html"`);
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
    const styles = page("styles");
    for (const s of manifest.styles) expect(styles).toContain(`data-style="${s.name}"`);
  });

  it("has the home page and the guides", () => {
    expect(page("")).toContain("Get started");
    expect(page("guides/getting-started")).toContain("@newbrush/vite");
    expect(page("guides/cdn")).toContain("cdn.jsdelivr.net/npm/newbrush@1/dist/newbrush.min.css");
    expect(page("guides/bundlers")).toContain("@newbrush/postcss");
    expect(page("guides/theming")).toContain("nb theme create");
    expect(page("guides/from-other-frameworks")).toContain("prefix");
  });

  it("has the Styles section: overview grid, a page per style, custom styles (specs/004 T033, T035)", () => {
    const overview = page("styles");
    for (const st of manifest.styles) {
      expect(overview).toContain(`data-style="${st.name}"`);
      const html = page(`styles/${st.name}`);
      for (const section of [
        "use-it",
        "full-page-demo",
        "every-component",
        "tokens-it-changes",
        "accessibility",
        "pairs-well-with",
      ])
        expect(html, `${st.name}: ${section}`).toContain(`id="${section}"`);
      for (const c of manifest.components) expect(html).toContain(`id="gallery-${c.name}"`);
      for (const t of st.tokens) expect(html).toContain(t.cssVar);
      for (const note of st.a11y) expect(html).toContain(note.replace(/"/g, "&quot;").slice(0, 30));
    }
    expect(page("styles/custom")).toContain("nb style create");
    expect(page("guides/getting-started")).toContain("2. Choose your style");
  });

  it("previews every component's example in every style, with identical markup (specs/004 T036)", () => {
    for (const c of manifest.components) {
      const html = page(`components/${c.name}`);
      for (const st of ["default", ...manifest.styles.map((s) => s.name)])
        expect(html, `${c.name}: ${st}`).toContain(`data-style-tab="${st}"`);
    }
  });

  it("puts a design-style picker in the header, restored before first paint (specs/004 T034)", () => {
    const html = page("");
    expect(html).toContain("<nb-style-select>");
    for (const st of manifest.styles) expect(html).toContain(`<option value="${st.name}"`);
    expect(html).toContain(`const styles = ${JSON.stringify(manifest.styles.map((s) => s.name))}`);
  });

  it("never repeats an element id on a page (examples shown several times get scoped ids)", () => {
    const repeated: string[] = [];
    for (const file of htmlFiles()) {
      const html = readFileSync(new URL(file, dist), "utf8").replace(
        /<script\b[^>]*>[\s\S]*?<\/script>/g,
        "",
      );
      const seen = new Set<string>();
      for (const [, id] of html.matchAll(/\sid="([^"]+)"/g)) {
        if (id && seen.has(id)) repeated.push(`${file}: #${id}`);
        if (id) seen.add(id);
      }
    }
    expect(repeated).toEqual([]);
  });

  it("has the playground: editor, sandboxed preview (no scripts) and toolbar (T083)", () => {
    const html = page("playground");
    expect(html).toContain('id="pg-editor"');
    const iframe = html.match(/<iframe[^>]*data-pg="preview"[^>]*>/)?.[0] ?? "";
    expect(iframe).toMatch(/\ssandbox(=""|\s|>)/);
    expect(iframe).not.toContain("allow-scripts");
    for (const control of ["theme", "style", "width", "dir", "copy-link", "copy-html", "reset"])
      expect(html).toContain(`data-control="${control}"`);
  });

  it('links every example to the playground with its markup ("Open in playground", T083)', async () => {
    for (const c of manifest.components) {
      const html = page(`components/${c.name}`);
      const links = [...html.matchAll(/href="([^"]*playground\/index\.html#code=[^"]+)"/g)].map(
        (m) => m[1] ?? "",
      );
      expect(links.length, c.name).toBe(c.examples.length);
      const decoded = await Promise.all(
        links.map((l) => decode(codeFromHash(l.slice(l.indexOf("#"))) ?? "")),
      );
      expect(decoded).toEqual(c.examples.map((e) => e.html));
    }
  });

  it("gives every live example a toolbar: theme, style, width, direction and copy (T082)", () => {
    for (const c of manifest.components) {
      const html = page(`components/${c.name}`);
      const examples = html.match(/<nb-example[\s>]/g) ?? [];
      expect(examples.length, c.name).toBe(c.examples.length);
      for (const control of ["theme", "style", "width", "dir", "copy"])
        expect(html.split(`data-control="${control}"`).length - 1, `${c.name}: ${control}`).toBe(
          c.examples.length,
        );
      for (const s of manifest.styles) expect(html).toContain(`<option value="${s.name}">`);
    }
  });

  it("keeps every internal link and asset under /site/, pointing at a built file", () => {
    // The site is served from /site/ on Catalyst Slate, so a root-relative URL outside it would 404.
    const broken: string[] = [];
    for (const file of htmlFiles()) {
      // Inline scripts can contain markup templates (the playground builds its preview), which are not links.
      const html = readFileSync(new URL(file, dist), "utf8").replace(
        /<script\b[^>]*>[\s\S]*?<\/script>/g,
        "",
      );
      // Relative links (the MDX pages use them) are resolved against the page's own URL.
      const pageUrl = new URL(`http://x${BASE}${file.replace(/index\.html$/, "")}`);
      for (const [, attr] of html.matchAll(/\s(?:href|src)="([^"#?]+)[^"]*"/g)) {
        if (!attr || /^(https?:|mailto:|data:|\/\/)/.test(attr)) continue;
        // Catalyst Slate does not serve a folder's index.html for a folder URL: links must name the file.
        if (attr.endsWith("/")) broken.push(`${file}: ${attr} (folder URL)`);
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
    // Astro derives scoped-style ids (data-astro-cid-*) from file paths, so builds in different checkouts differ in
    // those ids and the asset hashes that follow from them. Compare pages and stylesheets with both normalised; the
    // search index (pagefind/) is generated from the same pages.
    const site = new URL(process.env.NB_SITE_DIR ?? "../../../site/", import.meta.url);
    const normalise = (text: string) =>
      text
        .replace(/data-astro-cid-[a-z0-9]+/g, "data-astro-cid")
        .replace(/(\/_astro\/[^"'\s]+?)\.[A-Za-z0-9_-]{8}\.(css|js)/g, "$1.$2");
    const files = (root: URL, dir = ""): string[] =>
      readdirSync(new URL(dir || ".", root)).flatMap((name) =>
        statSync(new URL(dir + name, root)).isDirectory()
          ? name === "pagefind" && dir === ""
            ? []
            : files(root, `${dir}${name}/`)
          : [dir + name],
      );
    const snapshot = (root: URL) =>
      Object.fromEntries(
        files(root).map((f) => [
          normalise(`/${f}`),
          /\.(html|css|js|xml|svg)$/.test(f)
            ? normalise(readFileSync(new URL(f, root), "utf8"))
            : "",
        ]),
      );
    const built = snapshot(dist);
    const published = snapshot(site);
    expect(Object.keys(published).sort()).toEqual(Object.keys(built).sort());
    const stale = Object.keys(built).filter((f) => built[f] !== published[f]);
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
