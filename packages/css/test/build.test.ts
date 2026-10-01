import { readdir, readFile } from "node:fs/promises";
import { LAYERS, Manifest } from "@newbrush/schema";
import { describe, expect, it } from "vitest";

const dist = (file: string) => readFile(new URL(`../dist/${file}`, import.meta.url), "utf8");

/** Layer names in order of first appearance — the order the cascade actually uses. */
function layerOrder(css: string): string[] {
  const seen: string[] = [];
  for (const m of css.matchAll(/@layer\s+([^{;]+)[{;]/g)) {
    for (const name of (m[1] ?? "").split(",").map((s) => s.trim()))
      if (name && !seen.includes(name)) seen.push(name);
  }
  return seen;
}

const bundles = ["newbrush-core.css", "newbrush.css", "newbrush-full.css"];
const minified = bundles.map((b) => b.replace(".css", ".min.css"));

describe("bundles", () => {
  it.each([...bundles, ...minified])("%s declares layers in constitutional order", async (file) => {
    const order = layerOrder(await dist(file));
    expect(order.filter((l) => l.startsWith("nb."))).toEqual(
      LAYERS.filter((l) => order.includes(l)),
    );
    expect(order[0]).toBe("nb.reset");
  });

  it.each(bundles)("%s has no rules outside nb.* layers", async (file) => {
    const css = (await dist(file)).replace(/\/\*[\s\S]*?\*\//g, "");
    let depth = 0;
    let inLayer = 0;
    const stack: boolean[] = [];
    for (const m of css.matchAll(/@layer[^{;]*\{|@[a-z-]+[^{;]*\{|[^{};]+\{|\}/g)) {
      const token = m[0].trim();
      if (token === "}") {
        if (stack.pop()) inLayer--;
        depth--;
        continue;
      }
      const isLayer = token.startsWith("@layer");
      const isAtRule = token.startsWith("@");
      if (!isAtRule && inLayer === 0 && !/^\s*(from|to|\d+%)/.test(token)) {
        throw new Error(`Unlayered rule in ${file}: ${token.trim()}`);
      }
      stack.push(isLayer);
      if (isLayer) inLayer++;
      depth++;
    }
    expect(depth).toBe(0);
  });

  it("ships source maps for minified bundles", async () => {
    for (const file of minified) {
      expect(await dist(file)).toContain(`sourceMappingURL=${file}.map`);
      expect(JSON.parse(await dist(`${file}.map`)).version).toBe(3);
    }
  });

  it("ships light, dark and contrast themes", async () => {
    expect((await readdir(new URL("../dist/themes/", import.meta.url))).sort()).toEqual([
      "contrast.css",
      "dark.css",
      "light.css",
    ]);
  });
});

describe("manifest.json", () => {
  it("validates against @newbrush/schema", async () => {
    const manifest = Manifest.parse(JSON.parse(await dist("manifest.json")));
    expect(manifest.layers).toEqual(LAYERS);
    expect(manifest.tokens.length).toBeGreaterThan(200);
    expect(manifest.themes.map((t) => t.name)).toEqual(["light", "dark", "contrast"]);
  });
});
