import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

/** Built-in style names and aliases only (the manifest also holds tokens and docs), injected at build time. */
const manifest = JSON.parse(
  readFileSync(createRequire(import.meta.url).resolve("@newbrush/styles/manifest.json"), "utf8"),
) as { styles: { name: string; aliases: string[] }[] };

export const define = {
  __NB_STYLES__: JSON.stringify(manifest.styles.map((s) => ({ name: s.name, aliases: s.aliases }))),
};
