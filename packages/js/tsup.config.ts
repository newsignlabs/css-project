import { defineConfig } from "tsup";
import { define } from "./styles.config.ts";

// Browser ESM, no dependencies; the built-in style names are injected at build time (styles.config.ts).
export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm"],
  dts: true,
  clean: true,
  target: "es2022",
  platform: "browser",
  define,
});
