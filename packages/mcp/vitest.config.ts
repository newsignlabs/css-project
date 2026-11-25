import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { defineConfig } from "vitest/config";

// Load the newBrush stylesheets as text, as the tsup build does. The virtual id must not end in .css, or Vite's CSS
// pipeline would still claim the module.
const require = createRequire(import.meta.url);
const TEXT = new Set([
  "newbrush/css",
  "newbrush/core.css",
  "newbrush/themes/light.css",
  "newbrush/themes/dark.css",
  "newbrush/themes/contrast.css",
]);
const PREFIX = "\0nb-text:";

export default defineConfig({
  plugins: [
    {
      name: "newbrush-css-text",
      enforce: "pre",
      resolveId: (id) => (TEXT.has(id) ? `${PREFIX}${require.resolve(id)}.txt` : null),
      load: (id) =>
        id.startsWith(PREFIX)
          ? `export default ${JSON.stringify(readFileSync(id.slice(PREFIX.length, -".txt".length), "utf8"))};`
          : null,
    },
  ],
  test: { testTimeout: 30_000 },
});
