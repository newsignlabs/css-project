import { defineConfig } from "tsup";

// `@newbrush/styles/lib` (specs/004 T030): the style compiler build.ts uses, for custom styles in the engine and CLI.
// Runs after build.ts, so it must not clean dist.
export default defineConfig({
  entry: { lib: "lib/styles.ts" },
  format: ["esm"],
  dts: true,
  clean: false,
  target: "es2022",
  external: ["@newbrush/schema"],
});
