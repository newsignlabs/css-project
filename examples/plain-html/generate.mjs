// Regenerates index.html from the built manifest so the showcase never drifts from the tested examples.
// Usage: node examples/plain-html/generate.mjs (after `pnpm build`).
import { readFileSync, writeFileSync } from "node:fs";

const manifest = JSON.parse(
  readFileSync(new URL("../../packages/css/dist/manifest.json", import.meta.url), "utf8"),
);
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
const byCategory = Object.groupBy(manifest.components, (c) => c.category);

const sections = order
  .filter((cat) => byCategory[cat])
  .map(
    (cat) => `
    <section class="nb-stack" aria-labelledby="cat-${cat}">
      <h2 id="cat-${cat}">${cat[0].toUpperCase()}${cat.slice(1)}</h2>
      ${byCategory[cat]
        .map(
          (c) => `<article class="nb-stack nb-stack--sm" id="${c.name}">
        <h3>${esc(c.title)} <code>.${c.className}</code></h3>
        <p>${esc(c.description)}</p>
        ${c.examples.map((e) => `<div class="demo">${e.html}</div>`).join("\n        ")}
      </article>`,
        )
        .join("\n      ")}
    </section>`,
  )
  .join("\n");

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>newBrush — plain HTML showcase</title>
  <!-- Zero build: one stylesheet. From npm: node_modules/newbrush/dist/newbrush.css; from a CDN: see README. -->
  <link rel="stylesheet" href="../../packages/css/dist/newbrush.css">
  <style>
    /* Page-only styles (unlayered, so they win over newBrush without !important). */
    .demo { padding: var(--nb-space-5); border: 1px dashed var(--nb-color-border); border-radius: var(--nb-radius-lg); }
  </style>
</head>
<body>
  <header class="nb-navbar nb-navbar--sticky">
    <a class="nb-navbar__brand" href="#top">newBrush</a>
    <nav class="nb-navbar__nav" aria-label="Sections">
      <ul class="nb-navbar__links">
        ${order
          .filter((c) => byCategory[c])
          .map(
            (c) =>
              `<li><a class="nb-navbar__link" href="#cat-${c}">${c[0].toUpperCase()}${c.slice(1)}</a></li>`,
          )
          .join("\n        ")}
      </ul>
    </nav>
    <div class="nb-navbar__actions">
      <label class="nb-switch-label"><input class="nb-switch" type="checkbox" role="switch" id="dark"> Dark</label>
    </div>
  </header>
  <main class="nb-container nb-stack nb-stack--xl" id="top" style="padding-block: var(--nb-space-fluid-xl)">
    <div class="nb-stack nb-stack--sm">
      <h1>newBrush</h1>
      <p>Platform-native CSS framework — v${manifest.version}. ${manifest.components.length} components and layout primitives, ${manifest.tokens.length} design tokens, light/dark/contrast themes, zero JavaScript required.</p>
    </div>
    ${sections}
  </main>
  <script>
    // Optional: the page follows the OS theme without this; the switch just forces one.
    const toggle = document.getElementById("dark");
    toggle.checked = matchMedia("(prefers-color-scheme: dark)").matches;
    toggle.addEventListener("change", () => document.documentElement.dataset.nbTheme = toggle.checked ? "dark" : "light");
  </script>
</body>
</html>
`;
writeFileSync(new URL("./index.html", import.meta.url), html);
console.log(`plain-html: ${manifest.components.length} components`);
