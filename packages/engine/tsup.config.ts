import { defineConfig } from "tsup";

// The browser-safe core (src/index.ts) bundles the resolved token list and the theme.seeds generator
// (@newbrush/tokens/seeds) so it runs anywhere (CLI, Vite, Workers, the docs playground, the MCP server).
// Node-only helpers live in src/node.
export default defineConfig({
  entry: { index: "src/index.ts", "node/index": "src/node/index.ts" },
  format: ["esm"],
  dts: true,
  clean: true,
  target: "es2022",
  external: [
    "culori",
    "lightningcss",
    "browserslist",
    "chokidar",
    "fast-glob",
    "jiti",
    "picomatch",
  ],
});
