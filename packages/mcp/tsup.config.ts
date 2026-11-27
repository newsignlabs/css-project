import { defineConfig } from "tsup";

// The manifest and the newBrush stylesheets are bundled (JSON and CSS as text), so the server needs no files at run
// time: the same build runs from npx, Docker or a Worker.
export default defineConfig({
  entry: {
    index: "src/index.ts",
    server: "src/server.ts",
    http: "src/transports/http.ts",
    "lib/index": "src/lib/index.ts",
  },
  format: ["esm"],
  dts: {
    entry: {
      server: "src/server.ts",
      http: "src/transports/http.ts",
      "lib/index": "src/lib/index.ts",
    },
  },
  clean: true,
  target: "node20",
  platform: "node",
  noExternal: ["newbrush"],
  loader: { ".css": "text" },
});
