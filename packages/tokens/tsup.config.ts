import { defineConfig } from "tsup";

// `@newbrush/tokens/seeds`: the seed → palette generator for config `theme.seeds` (T061). Runs after build.ts,
// so it must not clean dist. culori stays external (a dependency); the default seeds JSON is bundled.
export default defineConfig({
  entry: { seeds: "lib/seeds.ts" },
  format: ["esm"],
  dts: true,
  clean: false,
  target: "es2022",
  external: ["culori"],
});
