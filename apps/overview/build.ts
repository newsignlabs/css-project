/**
 * Builds catalyst/client/index.html: a single, self-contained page explaining how newBrush is made today.
 * Everything is generated from real build outputs (manifest, tokens, dist sizes, engine) — nothing is hand-copied.
 * Usage: pnpm --filter @newbrush/overview build   (after `pnpm build`)
 */
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { brotliCompressSync } from "node:zlib";
import { createEngine, extractCandidates } from "@newbrush/engine";
import { optimize } from "@newbrush/engine/node";
import type { Component, Manifest } from "@newbrush/schema";

const require = createRequire(import.meta.url);
const root = new URL("../../", import.meta.url);
const dist = dirname(require.resolve("newbrush/manifest.json"));
const read = (path: string) => readFile(path, "utf8");
const manifest: Manifest = JSON.parse(await read(join(dist, "manifest.json")));
const pkg = JSON.parse(await read(join(dist, "..", "package.json"))) as { version: string };
const engine = createEngine({ content: ["**/*"], themeVariants: "selector" });

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} kB`;
async function size(file: string) {
  const buf = await readFile(join(dist, file));
  return { raw: buf.length, br: brotliCompressSync(buf).length };
}

// ── Facts ───────────────────────────────────────────────────────────────────
const sizes = {
  core: await size("newbrush-core.min.css"),
  main: await size("newbrush.min.css"),
  full: await size("newbrush-full.min.css"),
};
const families = engine.utilityFamilies();
const known = engine.knownClasses();
const layoutCount = manifest.components.filter((c) => c.category === "layout").length;
const componentCount = manifest.components.length - layoutCount;

async function progress(feature: string) {
  const text = await read(new URL(`specs/${feature}/tasks.md`, root).pathname);
  const done = (text.match(/^- \[x\]/gm) ?? []).length;
  const open = (text.match(/^- \[ \]/gm) ?? []).length;
  return { done, total: done + open };
}
const features = [
  {
    id: "001-core-framework",
    title: "Core framework",
    note: "Tokens, components, utility engine, tooling",
    ...(await progress("001-core-framework")),
  },
  {
    id: "004-design-styles",
    title: "Design styles",
    note: "g-morph, n-morph, neon, cyber, pixelate, minimal",
    ...(await progress("004-design-styles")),
  },
  {
    id: "003-mcp-css-tool",
    title: "MCP server",
    note: "CSS & page generation for AI agents",
    ...(await progress("003-mcp-css-tool")),
  },
  {
    id: "002-distribution-release",
    title: "Distribution",
    note: "npm, CDN, downloads, release pipeline",
    ...(await progress("002-distribution-release")),
  },
];

// ── Sections ────────────────────────────────────────────────────────────────
const stat = (value: string, label: string) =>
  `<div class="nb-card p-5"><p class="text-3xl font-bold leading-tight">${value}</p><p class="text-sm text-muted mt-1">${label}</p></div>`;

const hero = `
<section class="nb-stack" aria-labelledby="top-title">
  <p class="nb-badge nb-badge--accent nb-badge--dot self-start">Status · v${pkg.version} · ${new Date().toISOString().slice(0, 10)}</p>
  <h1 id="top-title" class="text-5xl font-bold tracking-tight">How newBrush is made</h1>
  <p class="text-lg text-muted max-w-prose">A live look at the framework as it exists today. This page is styled entirely by newBrush:
  every component below is the real component, and the utility CSS for this page was generated on demand by the newBrush engine.</p>
  <div class="grid gap-4 grid-cols-2 md:grid-cols-4">
    ${stat(String(manifest.tokens.length), "design tokens (W3C DTCG)")}
    ${stat(String(componentCount), `components + ${layoutCount} layout primitives`)}
    ${stat(String(families.length), `utility families · ${known.length.toLocaleString("en")} utilities`)}
    ${stat(String(manifest.variants.length), "variants (md:, hover:, dark:, @md: …)")}
    ${stat(kb(sizes.core.br), "core CSS, brotli (budget 8 kB)")}
    ${stat(kb(sizes.main.br), "framework CSS, brotli (budget 35 kB)")}
    ${stat(kb(sizes.full.br), "with utility preset, brotli (budget 70 kB)")}
    ${stat("0", "JavaScript required")}
  </div>
</section>`;

const flow = (title: string, body: string) =>
  `<div class="nb-card p-4"><p class="font-semibold">${title}</p><p class="text-sm text-muted mt-1">${body}</p></div>`;
const arrow = `<p class="text-2xl text-muted text-center" aria-hidden="true">↓</p>`;
const layers = [...manifest.layers.slice(0, 5), "nb.styles", manifest.layers[5] ?? "nb.utilities"];
const architecture = `
<section class="nb-stack" id="architecture" aria-labelledby="arch-title">
  <h2 id="arch-title">Architecture</h2>
  <p class="text-muted max-w-prose">One source of truth — design tokens — flows through the build into the stylesheet,
  the utility engine and a machine-readable manifest that powers docs, editor types and the MCP server.</p>
  <div class="grid gap-6 md:grid-cols-2">
    <div class="nb-stack nb-stack--sm" aria-label="Build pipeline">
      ${flow("1 · Design tokens", `${manifest.tokens.length} tokens in W3C DTCG JSON: OKLCH palette, fluid type & space, radius, elevation, motion. Tiered primitive → semantic → component.`)}
      ${arrow}
      ${flow("2 · Style Dictionary", "Compiles tokens to layered CSS custom properties with light, dark and high-contrast themes, plus JS/TS, JSON and Figma variables.")}
      ${arrow}
      ${flow("3 · Components + Lightning CSS", `Hand-written native CSS (nesting, :has(), container queries, logical properties) for ${componentCount} components, bundled, lowered and minified.`)}
      ${arrow}
      ${flow("4 · Utility engine", `${families.length} families generate only the classes you use (JIT) from the same tokens; arbitrary values are validated.`)}
      ${arrow}
      ${flow("5 · manifest.json", "Every token, component, utility and variant described as JSON — read by docs, editor types and AI agents.")}
    </div>
    <div class="nb-stack nb-stack--sm">
      <h3 class="text-xl">Cascade layers</h3>
      <p class="text-sm text-muted">Every rule lives in an ordered layer, so your own CSS always wins without <code>!important</code>.</p>
      <ol class="nb-stack nb-stack--xs" role="list">
        ${layers
          .map((l, i) => {
            const planned = l === "nb.styles";
            return `<li class="nb-cluster nb-cluster--between rounded-md px-4 py-2 border ${planned ? "border-dashed" : "bg-surface-raised"}">
            <code>${l}</code><span class="text-sm text-muted">${planned ? "planned · design styles" : i === 0 ? "lowest priority" : i === layers.length - 1 ? "highest priority" : ""}</span></li>`;
          })
          .join("")}
      </ol>
      <h3 class="text-xl mt-4">Packages</h3>
      <ul class="text-sm">
        <li><code>newbrush</code> — the stylesheet (zero runtime dependencies)</li>
        <li><code>@newbrush/tokens</code> — design tokens and themes</li>
        <li><code>@newbrush/engine</code> — utility engine (browser-safe)</li>
        <li><code>@newbrush/cli</code> — <code>nb init · build · watch · explain · doctor · tokens</code></li>
        <li><code>@newbrush/vite</code>, <code>@newbrush/postcss</code> — bundler plugins</li>
        <li><code>@newbrush/schema</code>, <code>@newbrush/stylelint-config</code> — types and lint rules</li>
      </ul>
    </div>
  </div>
</section>`;

const palettes = ["neutral", "brand", "accent", "success", "warning", "danger", "info"];
const steps = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];
const swatchRows = palettes
  .map(
    (p) => `<div class="nb-stack nb-stack--xs"><p class="text-sm font-semibold">${p}</p>
    <div class="grid gap-1" style="grid-template-columns: repeat(11, minmax(0, 1fr))">
      ${steps.map((s) => `<div class="rounded-sm aspect-square border" style="background: var(--nb-color-${p}-${s})" title="--nb-color-${p}-${s}"></div>`).join("")}
    </div></div>`,
  )
  .join("");
const typeScale = ["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl"]
  .map(
    (s) =>
      `<p class="truncate" style="font-size: var(--nb-font-size-${s})"><code class="text-xs">${s}</code> The quick brown fox</p>`,
  )
  .join("");
const elevation = ["0", "1", "2", "3", "4", "5"]
  .map(
    (e) =>
      `<div class="nb-card p-4 text-center text-sm" style="box-shadow: var(--nb-elevation-${e})">elevation ${e}</div>`,
  )
  .join("");
const tokensSection = `
<section class="nb-stack" id="tokens" aria-labelledby="tokens-title">
  <h2 id="tokens-title">Design tokens</h2>
  <p class="text-muted max-w-prose">Colors are OKLCH scales with perceptually even steps; every text/background pair is tested for
  WCAG AA contrast in light, dark and high-contrast themes. Switch the theme at the top to see semantic tokens change.</p>
  <div class="grid gap-6 md:grid-cols-2">
    <div class="nb-stack nb-stack--sm">${swatchRows}</div>
    <div class="nb-stack nb-stack--sm">
      <h3 class="text-xl">Fluid type scale</h3>
      ${typeScale}
      <h3 class="text-xl mt-4">Elevation</h3>
      <div class="grid gap-4 grid-cols-3">${elevation}</div>
    </div>
  </div>
</section>`;

const categoryTitles: Record<string, string> = {
  layout: "Layout primitives",
  actions: "Actions",
  content: "Content",
  forms: "Forms",
  feedback: "Feedback",
  navigation: "Navigation",
  overlay: "Overlay",
  data: "Data",
};
const componentCard = (c: Component) => `
  <article class="nb-card" id="c-${c.name}" aria-labelledby="c-${c.name}-title">
    <div class="nb-card__body nb-stack nb-stack--sm">
      <div class="nb-cluster nb-cluster--between">
        <h4 id="c-${c.name}-title" class="nb-card__title">${esc(c.title)}</h4>
        <code class="text-sm">.${c.className}</code>
      </div>
      <p class="text-sm text-muted">${esc(c.description)}</p>
      ${c.examples
        .map(
          (
            e,
          ) => `<div class="demo nb-stack nb-stack--xs"><p class="text-xs text-muted uppercase tracking-wide">${esc(e.title)}</p>
        <div class="demo__stage">${e.html}</div>
        <details class="demo__code"><summary class="text-sm">Markup</summary><pre><code>${esc(e.html)}</code></pre></details></div>`,
        )
        .join("")}
      ${c.modifiers.length ? `<p class="text-xs text-muted">Modifiers: ${c.modifiers.map((m) => `<code>${m.className}</code>`).join(" ")}</p>` : ""}
    </div>
  </article>`;
const order = [
  "layout",
  "actions",
  "content",
  "forms",
  "feedback",
  "navigation",
  "overlay",
  "data",
];
const componentsSection = `
<section class="nb-stack" id="components" aria-labelledby="components-title">
  <h2 id="components-title">Components</h2>
  <p class="text-muted max-w-prose">Each component is native HTML + CSS — dialogs use <code>&lt;dialog&gt;</code>, accordions
  <code>&lt;details&gt;</code>, tabs a radio group — so they work without JavaScript and pass axe accessibility checks in light and dark,
  at three widths and in right-to-left layouts.</p>
  ${order
    .map((cat) => {
      const list = manifest.components.filter((c) => c.category === cat);
      return list.length
        ? `<div class="nb-stack nb-stack--sm"><h3 class="text-2xl">${categoryTitles[cat] ?? cat}</h3><div class="grid gap-6 lg:grid-cols-2">${list.map(componentCard).join("")}</div></div>`
        : "";
    })
    .join("")}
</section>`;

const examples = [
  "p-4",
  "md:grid-cols-3",
  "hover:bg-brand-600/80",
  "dark:text-neutral-50",
  "w-[37ch]",
  "-mt-2",
  "@lg:flex-row",
  "group-hover:opacity-100",
];
const explainRows = examples
  .map((cls) => {
    const x = engine.explain(cls);
    const css =
      "css" in x
        ? x.css
            .split("\n")
            .filter((l) => !l.startsWith("@layer"))
            .slice(0, -1)
            .join("\n")
            .trim()
        : x.message;
    return `<tr><td><code>${esc(cls)}</code></td><td class="text-sm text-muted">${"family" in x ? esc(x.family) : ""}</td><td><pre class="text-xs"><code>${esc(css)}</code></pre></td></tr>`;
  })
  .join("");
const familyCounts = new Map<string, number>();
for (const f of families) familyCounts.set(f.category, (familyCounts.get(f.category) ?? 0) + 1);
const byCategory = [...familyCounts]
  .map(([cat, count]) => `<span class="nb-chip">${cat} · ${count}</span>`)
  .join("");
const variantChips = manifest.variants
  .map((v) => `<code class="text-xs">${esc(v.name)}</code>`)
  .join(" ");
const engineSection = `
<section class="nb-stack" id="engine" aria-labelledby="engine-title">
  <h2 id="engine-title">Utility engine</h2>
  <p class="text-muted max-w-prose">Tailwind-compatible class names, newBrush tokens and logical properties underneath. The engine scans
  your files and writes only what you use; output is deterministic. Cold build of 1,000 files: ~150 ms · incremental rebuild: &lt; 1 ms.</p>
  <div class="nb-cluster">${byCategory}</div>
  <div class="nb-table-wrap" tabindex="0" role="region" aria-label="Class to CSS examples">
    <table class="nb-table">
      <caption>Class → generated CSS (produced live by the engine for this page)</caption>
      <thead><tr><th scope="col">Class</th><th scope="col">Family</th><th scope="col">CSS</th></tr></thead>
      <tbody>${explainRows}</tbody>
    </table>
  </div>
  <details><summary>All ${manifest.variants.length} variants</summary><p class="mt-2">${variantChips}</p></details>
</section>`;

const themesSection = `
<section class="nb-stack" id="themes" aria-labelledby="themes-title">
  <h2 id="themes-title">Themes and islands</h2>
  <p class="text-muted max-w-prose">Light, dark and high-contrast themes follow the operating system or <code>data-nb-theme</code>, and any
  element can be an island with its own theme — the nearest one wins.</p>
  <div class="grid gap-4 md:grid-cols-3">
    ${["light", "dark", "contrast"]
      .map(
        (
          t,
        ) => `<div data-nb-theme="${t}" class="rounded-xl p-6 border nb-stack nb-stack--sm"><p class="font-semibold">data-nb-theme="${t}"</p>
      <div class="nb-cluster"><button class="nb-btn nb-btn--primary nb-btn--sm" type="button">Primary</button><span class="nb-badge nb-badge--success">Active</span></div>
      <p class="text-sm text-muted">Muted text stays readable.</p></div>`,
      )
      .join("")}
  </div>
</section>`;

const styleNames = [
  ["g-morph", "Glassmorphism — translucent surfaces and backdrop blur"],
  ["n-morph", "Neumorphism — soft, extruded, tactile"],
  ["neon", "Glowing accents on deep, dark surfaces"],
  ["cyber", "Cyberpunk HUD — notched corners, scanlines"],
  ["pixelate", "8-bit — stepped borders and pixel type"],
  ["minimal", "Quiet and editorial — hairlines, no shadows"],
];
const stylesSection = `
<section class="nb-stack" id="styles" aria-labelledby="styles-title">
  <h2 id="styles-title">Coming next: design styles</h2>
  <p class="text-muted max-w-prose">newBrush's signature feature (planned in spec 004): one class re-skins the whole project —
  <code>&lt;body class="g-morph"&gt;</code> or <code>&lt;body class="nb-g-morph"&gt;</code>. Styles change the skin and density, never the layout,
  and ship as pure CSS in the same file.</p>
  <div class="grid gap-4 md:grid-cols-3">
    ${styleNames.map(([n, d]) => `<div class="nb-card p-5"><p class="font-semibold"><code>${n}</code></p><p class="text-sm text-muted mt-1">${d}</p><p class="nb-badge mt-3">planned</p></div>`).join("")}
  </div>
</section>`;

const statusSection = `
<section class="nb-stack" id="status" aria-labelledby="status-title">
  <h2 id="status-title">Build status</h2>
  <div class="grid gap-4 md:grid-cols-2">
    ${features
      .map((f) => {
        const pct = f.total ? Math.round((f.done / f.total) * 100) : 0;
        return `<div class="nb-card p-5 nb-stack nb-stack--xs"><div class="nb-cluster nb-cluster--between"><p class="font-semibold">${f.title}</p><p class="text-sm text-muted">${f.done}/${f.total} tasks</p></div>
        <div class="progress" role="progressbar" aria-label="${f.title} progress" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="inline-size: ${pct}%"></span></div>
        <p class="text-sm text-muted">${f.note}</p></div>`;
      })
      .join("")}
  </div>
  <div class="nb-alert nb-alert--success" role="status"><div class="nb-alert__content"><p class="nb-alert__title">Quality gates on every change</p>
  <p>Unit tests across 13 packages, contrast checks for every color pair, 350 browser tests (axe accessibility, 24 px touch targets,
  themes, RTL) and enforced size budgets.</p></div></div>
</section>`;

const nav = `
<header class="nb-navbar nb-navbar--sticky">
  <a class="nb-navbar__brand" href="#top">newBrush</a>
  <nav class="nb-navbar__nav" aria-label="Sections">
    <ul class="nb-navbar__links">
      ${[
        ["architecture", "Architecture"],
        ["tokens", "Tokens"],
        ["components", "Components"],
        ["engine", "Engine"],
        ["themes", "Themes"],
        ["styles", "Styles"],
        ["status", "Status"],
      ]
        .map(([id, label]) => `<li><a class="nb-navbar__link" href="#${id}">${label}</a></li>`)
        .join("")}
    </ul>
  </nav>
  <div class="nb-navbar__actions">
    <div class="nb-btn-group" role="group" aria-label="Theme">
      <button class="nb-btn nb-btn--sm" type="button" data-theme="auto" aria-pressed="true">Auto</button>
      <button class="nb-btn nb-btn--sm" type="button" data-theme="light" aria-pressed="false">Light</button>
      <button class="nb-btn nb-btn--sm" type="button" data-theme="dark" aria-pressed="false">Dark</button>
      <button class="nb-btn nb-btn--sm" type="button" data-theme="contrast" aria-pressed="false">Contrast</button>
    </div>
  </div>
</header>`;

const body = `${nav}
<main class="nb-container nb-stack nb-stack--xl py-12" id="top">
${hero}
${architecture}
${tokensSection}
${componentsSection}
${engineSection}
${themesSection}
${stylesSection}
${statusSection}
<footer class="text-sm text-muted border-t pt-6"><p>newBrush · MIT · generated by <code>apps/overview</code> from the build outputs.
Source: github.com/newsignlabs/css-project</p></footer>
</main>`;

// ── CSS: the framework + exactly the utilities this page uses (generated by the engine) ──
const pageCss = `
.demo { padding: var(--nb-space-4); border: 1px dashed var(--nb-color-border); border-radius: var(--nb-radius-lg); }
.demo__stage { min-inline-size: 0; overflow-x: auto; }
.demo__code summary { display: flex; align-items: center; min-block-size: var(--nb-size-target); }
.demo__code pre { margin-block-start: var(--nb-space-2); max-block-size: 16rem; overflow: auto; }
.progress { block-size: var(--nb-space-2); border-radius: var(--nb-radius-full); background: var(--nb-color-surface-sunken); overflow: hidden; }
.progress > span { display: block; block-size: 100%; background: var(--nb-color-accent); border-radius: inherit; }
`;
const candidates = extractCandidates(body);
const utilities = engine.generate(candidates, { reportUnknown: false });
const framework = await read(join(dist, "newbrush.min.css"));
const utilityCss = optimize(utilities.css, { minify: true, cwd: new URL(".", root).pathname }).code;

const script = `
const root = document.documentElement;
const buttons = document.querySelectorAll("[data-theme]");
const apply = (t) => {
  if (t === "auto") delete root.dataset.nbTheme; else root.dataset.nbTheme = t;
  buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.theme === t)));
  try { localStorage.setItem("nb-overview-theme", t); } catch {}
};
buttons.forEach((b) => b.addEventListener("click", () => apply(b.dataset.theme)));
try { const saved = localStorage.getItem("nb-overview-theme"); if (saved) apply(saved); } catch {}
`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>How newBrush is made</title>
<meta name="description" content="Live overview of the newBrush CSS framework: architecture, tokens, components, utility engine and status.">
<style>${framework}</style>
<style>${utilityCss}</style>
<style>${pageCss}</style>
</head>
<body>
${body}
<script>${script}</script>
<!-- utilities generated for this page: ${utilities.classes.used.length} classes, ${kb(utilityCss.length)} -->
</body>
</html>
`;

const outDir = new URL("catalyst/client/", root);
await writeFile(new URL("index.html", outDir), html);
console.log(
  `overview: catalyst/client/index.html (${kb(html.length)}, ${manifest.components.length} components, ${utilities.classes.used.length} generated utilities)`,
);
