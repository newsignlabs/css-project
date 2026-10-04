import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import postcss from "postcss";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import newbrush from "../src/index.ts";

// T093 — PostCSS plugin contract.
let dir: string;
beforeEach(async () => {
  const tmp = new URL("./.tmp/", import.meta.url).pathname;
  await mkdir(tmp, { recursive: true });
  dir = await mkdtemp(join(tmp, "case-"));
  await writeFile(
    join(dir, "newbrush.config.json"),
    JSON.stringify({ content: ["src/**/*.html"] }),
  );
  await mkdir(join(dir, "src"));
  await writeFile(join(dir, "src/index.html"), '<div class="p-4 md:flex hover:text-muted">');
});
afterEach(() => rm(dir, { recursive: true, force: true }));

const processCss = (css: string) =>
  postcss([newbrush({ cwd: dir })]).process(css, { from: join(dir, "src/app.css") });

describe("@newbrush/postcss", () => {
  it("is a PostCSS 8 plugin", () => {
    expect(newbrush.postcss).toBe(true);
    expect((newbrush() as { postcssPlugin: string }).postcssPlugin).toBe("@newbrush/postcss");
  });

  it("replaces @newbrush utilities with the utilities used in content files", async () => {
    const { css } = await processCss("@newbrush utilities;\n");
    expect(css).toContain("@layer nb.utilities");
    expect(css).toContain(".p-4");
    expect(css).toContain(".md\\:flex");
    expect(css).not.toContain("@newbrush");
  });

  it("expands @nb-apply, including variants via nesting", async () => {
    const { css } = await processCss(".card { @nb-apply p-6 hover:shadow-lg; color: red; }\n");
    expect(css).toMatch(/\.card \{\s*padding: var\(--nb-space-6\);/);
    expect(css).toContain("&:hover");
    expect(css).toContain("color: red");
  });

  it("fails the build for unknown @nb-apply utilities", async () => {
    await expect(processCss(".card { @nb-apply p-6 nope; }")).rejects.toThrow(/nope/);
  });

  it("is deterministic", async () => {
    const a = (await processCss("@newbrush utilities;")).css;
    const b = (await processCss("@newbrush utilities;")).css;
    expect(a).toBe(b);
  });

  it("registers content globs and the config file as dependencies for watchers", async () => {
    const result = await processCss("@newbrush utilities;");
    const messages = result.messages.map((m) => ({ type: m.type, glob: m.glob, file: m.file }));
    expect(messages).toContainEqual({ type: "dir-dependency", glob: "**/*.html", file: undefined });
    expect(messages).toContainEqual({
      type: "dependency",
      glob: undefined,
      file: join(dir, "newbrush.config.json"),
    });
  });

  it("picks up content changes on the next run", async () => {
    await processCss("@newbrush utilities;");
    await writeFile(join(dir, "src/index.html"), '<div class="gap-12">');
    expect((await processCss("@newbrush utilities;")).css).toContain(".gap-12");
  });

  it("leaves CSS without directives untouched", async () => {
    expect((await processCss(".a { color: red; }")).css).toBe(".a { color: red; }");
  });
});
