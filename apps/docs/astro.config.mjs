// @ts-check
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import explicitIndex from "./src/explicit-index.mjs";

// specs/001 T080 — the newBrush docs, built with Starlight and themed with newBrush itself. Reference pages are
// generated from newbrush/manifest.json (T081), so the sidebar lists exactly what the manifest has.
const manifest = JSON.parse(
  readFileSync(createRequire(import.meta.url).resolve("newbrush/manifest.json"), "utf8"),
);
const repo = "https://github.com/newsignlabs/css-project";
// Catalyst Slate serves the repository root, and the built site is committed to /site (see README), so pages live
// under /site/. Starlight adds the base to sidebar links itself.
const base = "/site";

/** Components grouped by manifest category, in manifest order. */
const componentGroups = Object.entries(
  Object.groupBy(manifest.components, (/** @type {{category: string}} */ c) => c.category),
).map(([category, items]) => ({
  label: category[0].toUpperCase() + category.slice(1),
  collapsed: false,
  items: (items ?? []).map((/** @type {{name: string, title: string}} */ c) => ({
    label: c.title,
    link: `/components/${c.name}/`,
  })),
}));

export default defineConfig({
  site: "https://css-project-fyqaeqal.onslate.in",
  base,
  // Keep the site's own CSS in files (not inlined) so the layer-order statement always comes first.
  build: { inlineStylesheets: "never" },
  integrations: [
    starlight({
      title: "newBrush",
      description:
        "A platform-native CSS framework: token-driven themes, accessible components, on-demand utilities and design styles.",
      social: [{ icon: "github", label: "GitHub", href: repo }],
      editLink: { baseUrl: `${repo}/edit/main/apps/docs/` },
      lastUpdated: false,
      // Wrap long lines: a horizontally scrolling code block is not keyboard reachable (axe scrollable-region-focusable).
      expressiveCode: { defaultProps: { wrap: true } },
      customCss: [
        // Order matters: layers.css must be the first CSS on the page (see the file).
        "./src/styles/layers.css",
        "newbrush/css",
        "./src/styles/theme.css",
      ],
      head: [
        // Starlight's theme picker sets data-theme; newBrush themes follow data-nb-theme.
        {
          tag: "script",
          content: readFileSync(new URL("./src/theme-sync.js", import.meta.url), "utf8"),
        },
      ],
      sidebar: [
        {
          label: "Start here",
          items: [
            { label: "Getting started", link: "/guides/getting-started/" },
            { label: "CDN", link: "/guides/cdn/" },
            { label: "Bundlers & frameworks", link: "/guides/bundlers/" },
            { label: "Theming", link: "/guides/theming/" },
            { label: "Coming from another framework", link: "/guides/from-other-frameworks/" },
          ],
        },
        {
          label: "Components",
          items: [{ label: "Overview", link: `/components/` }, ...componentGroups],
        },
        {
          label: "Reference",
          items: [
            { label: "Design tokens", link: `/reference/tokens/` },
            { label: "Utilities", link: `/reference/utilities/` },
            { label: "Themes & variants", link: `/reference/themes/` },
            { label: "Design styles", link: `/reference/styles/` },
          ],
        },
      ],
    }),
    // After Starlight (its search index is replaced): links name index.html files for Catalyst Slate.
    explicitIndex(base),
  ],
});
