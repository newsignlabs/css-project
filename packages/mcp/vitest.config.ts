import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { defineConfig } from "vitest/config";

// Load the newBrush stylesheets as text, as the tsup build does. The virtual id must not end in .css, or Vite's CSS
// pipeline would still claim the module.
const require = createRequire(import.meta.url);
/** Every newBrush stylesheet import (newbrush/css, newbrush/core.css, newbrush/components/x.css…). */
const isText = (id: string) =>
  id === "newbrush/css" || (id.startsWith("newbrush/") && id.endsWith(".css"));
const PREFIX = "\0nb-text:";

export default defineConfig({
  plugins: [
    {
      name: "newbrush-css-text",
      enforce: "pre",
      resolveId: (id) => (isText(id) ? `${PREFIX}${require.resolve(id)}.txt` : null),
      load: (id) =>
        id.startsWith(PREFIX)
          ? `export default ${JSON.stringify(readFileSync(id.slice(PREFIX.length, -".txt".length), "utf8"))};`
          : null,
    },
  ],
  test: { testTimeout: 30_000 },
});
