import { readdir, readFile } from "node:fs/promises";
import { LAYERS, Manifest } from "@newbrush/schema";
import ts from "typescript";
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

describe("newbrush-full.css utility preset (T057)", () => {
  it("contains utilities and common variants, layered after components", async () => {
    const css = await dist("newbrush-full.css");
    for (const cls of [
      ".p-4",
      ".md\\:grid-cols-3",
      ".hover\\:bg-accent",
      ".\\@md\\:flex-row",
      ".dark\\:bg-neutral-900",
      ".sr-only",
    ]) {
      expect(css).toContain(cls);
    }
    expect(layerOrder(css).at(-1)).toBe("nb.utilities");
  });

  it("is absent from newbrush.css", async () => {
    expect(await dist("newbrush.css")).not.toContain("nb.utilities {");
  });
});

describe("editor support (T058)", () => {
  const diagnosticsFor = (source: string) => {
    const file = new URL("../dist/__check.ts", import.meta.url).pathname;
    const host = ts.createCompilerHost({ strict: true, noEmit: true });
    const original = host.getSourceFile;
    host.getSourceFile = (name, lang) =>
      name === file ? ts.createSourceFile(name, source, lang) : original.call(host, name, lang);
    host.fileExists = (
      (exists) => (name: string) =>
        name === file || exists(name)
    )(host.fileExists);
    const program = ts.createProgram(
      [file],
      { strict: true, noEmit: true, skipLibCheck: true },
      host,
    );
    return ts
      .getPreEmitDiagnostics(program)
      .map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
  };

  it("classes.d.ts accepts real classes and rejects typos", () => {
    expect(
      diagnosticsFor(
        'import type { NewBrushClass } from "./classes";\nconst ok: NewBrushClass[] = ["nb-btn", "nb-btn--primary", "p-4", "md:grid-cols-3", "hover:bg-accent"];\nexport { ok };\n',
      ),
    ).toEqual([]);
    expect(
      diagnosticsFor(
        'import type { NewBrushClass } from "./classes";\nconst bad: NewBrushClass = "nb-buton";\nexport { bad };\n',
      ),
    ).toHaveLength(1);
  });

  it("ships VS Code custom data for directives and class completions", async () => {
    const cssData = JSON.parse(await dist("vscode.css-data.json"));
    expect(cssData.atDirectives.map((d: { name: string }) => d.name)).toEqual([
      "@nb-apply",
      "@newbrush",
    ]);
    const htmlData = JSON.parse(await dist("vscode.html-data.json"));
    const values = htmlData.globalAttributes[0].values.map((v: { name: string }) => v.name);
    expect(values).toEqual(
      expect.arrayContaining(["nb-btn", "nb-card__header", "p-4", "grid-cols-3"]),
    );
  });
});

describe("manifest.json", () => {
  it("validates against @newbrush/schema", async () => {
    const manifest = Manifest.parse(JSON.parse(await dist("manifest.json")));
    expect(manifest.layers).toEqual(LAYERS);
    expect(manifest.tokens.length).toBeGreaterThan(200);
    expect(manifest.themes.map((t) => t.name)).toEqual(["light", "dark", "contrast"]);
    expect(manifest.utilities.length).toBeGreaterThanOrEqual(100);
    expect(manifest.variants.map((v) => v.name)).toEqual(
      expect.arrayContaining(["md", "@md", "hover", "dark"]),
    );
  });
});
