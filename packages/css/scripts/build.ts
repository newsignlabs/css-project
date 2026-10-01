/**
 * Builds the `newbrush` package (specs/001-core-framework T014, T034).
 * Lightning CSS bundles @imports, lowers syntax for .browserslistrc and minifies;
 * component metadata (*.meta.ts) is validated and written to dist/manifest.json.
 */
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Component, LAYERS, Manifest } from "@newbrush/schema";
import browserslist from "browserslist";
import { browserslistToTargets, bundleAsync } from "lightningcss";

const root = new URL("../", import.meta.url);
const path = (rel: string) => fileURLToPath(new URL(rel, root));
const pkg = JSON.parse(await readFile(path("package.json"), "utf8")) as { version: string };
const targets = browserslistToTargets(browserslist(undefined, { path: path(".") }));
const banner = `/*! newBrush v${pkg.version} | MIT License | https://github.com/newsignlabs/css-project */\n`;

const resolver = {
  resolve(specifier: string, from: string) {
    if (specifier.startsWith(".") || specifier.startsWith("/"))
      return fileURLToPath(new URL(specifier, pathToFileURL(from)));
    return fileURLToPath(import.meta.resolve(specifier));
  },
};

async function bundle(entry: string, outName: string): Promise<void> {
  const filename = path(entry);
  for (const minify of [false, true]) {
    const out = minify ? outName.replace(/\.css$/, ".min.css") : outName;
    const { code, map } = await bundleAsync({
      filename,
      minify,
      targets,
      resolver,
      sourceMap: minify,
      projectRoot: path("."),
    });
    const mapRef = map ? `\n/*# sourceMappingURL=${out.split("/").pop()}.map */\n` : "";
    await writeFile(path(`dist/${out}`), banner + code.toString() + mapRef);
    if (map) await writeFile(path(`dist/${out}.map`), map);
  }
}

async function componentNames(): Promise<string[]> {
  const entries = await readdir(path("src/components"), { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

async function loadComponents(names: string[]): Promise<Component[]> {
  const components: Component[] = [];
  for (const name of names) {
    const mod = (await import(
      pathToFileURL(path(`src/components/${name}/${name}.meta.ts`)).href
    )) as { default: unknown };
    const parsed = Component.safeParse(mod.default);
    if (!parsed.success)
      throw new Error(`Invalid meta for component "${name}":\n${parsed.error.message}`);
    if (parsed.data.name !== name)
      throw new Error(`Component folder "${name}" declares name "${parsed.data.name}"`);
    components.push(parsed.data);
  }
  return components;
}

await rm(path("dist"), { recursive: true, force: true });
await mkdir(path("dist/components"), { recursive: true });
await mkdir(path("dist/themes"), { recursive: true });

await bundle("src/core.css", "newbrush-core.css");
await bundle("src/index.css", "newbrush.css");
await bundle("src/full.css", "newbrush-full.css");

const names = await componentNames();
for (const name of names)
  await bundle(`src/components/${name}/${name}.css`, `components/${name}.css`);

for (const theme of ["light", "dark", "contrast"]) {
  await copyFile(
    fileURLToPath(import.meta.resolve(`@newbrush/tokens/css/themes/${theme}.css`)),
    path(`dist/themes/${theme}.css`),
  );
}

const tokens = JSON.parse(
  await readFile(fileURLToPath(import.meta.resolve("@newbrush/tokens/tokens.json")), "utf8"),
);
const manifest = Manifest.parse({
  name: "newbrush",
  version: pkg.version,
  schemaVersion: 1,
  layers: [...LAYERS],
  tokens: tokens.tokens,
  themes: tokens.themes,
  variants: [],
  utilities: [],
  components: await loadComponents(names),
});
await writeFile(path("dist/manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  `newbrush: built ${3 + names.length} bundles, ${manifest.components.length} components, ${manifest.tokens.length} tokens`,
);
