import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ConfigError,
  loadConfig,
  optimize,
  resolveThemeVariants,
  Scanner,
  supportsStyleQueries,
} from "../src/node/index.ts";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "nb-engine-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("loadConfig()", () => {
  it("loads a TypeScript config and applies defaults", async () => {
    await writeFile(
      join(dir, "newbrush.config.ts"),
      'const c: { content: string[] } = { content: ["src/**/*.html"] };\nexport default c;\n',
    );
    const { config, path } = await loadConfig(dir);
    expect(path).toBe(join(dir, "newbrush.config.ts"));
    expect(config.content).toEqual(["src/**/*.html"]);
    expect(config.darkMode).toBe("both");
  });

  it("falls back to sensible content globs without a config file", async () => {
    const { config, path } = await loadConfig(dir);
    expect(path).toBeNull();
    expect(config.content[0]).toContain("html");
  });

  it("throws ConfigError with the offending path for invalid config", async () => {
    await writeFile(
      join(dir, "newbrush.config.json"),
      JSON.stringify({ content: [], colour: "red" }),
    );
    await expect(loadConfig(dir)).rejects.toThrow(ConfigError);
    await expect(loadConfig(dir)).rejects.toThrow(/content/);
  });
});

describe("Scanner", () => {
  it("scans globs and reports only new candidates on update", async () => {
    const file = join(dir, "a.html");
    await writeFile(file, '<div class="p-4 flex">');
    const scanner = new Scanner(["**/*.html"], dir);
    expect([...(await scanner.scanAll())]).toEqual(expect.arrayContaining(["p-4", "flex"]));
    await writeFile(file, '<div class="p-4 flex md:grid">');
    expect([...(await scanner.update(file))]).toEqual(["md:grid"]);
    expect(scanner.size).toBe(1);
  });

  it("ignores node_modules and dist", async () => {
    await writeFile(join(dir, "ok.html"), '<i class="p-1">');
    await import("node:fs/promises").then((fs) =>
      fs.mkdir(join(dir, "node_modules"), { recursive: true }),
    );
    await writeFile(join(dir, "node_modules", "x.html"), '<i class="p-9">');
    const found = await new Scanner(["**/*.html"], dir).scanAll();
    expect(found.has("p-1")).toBe(true);
    expect(found.has("p-9")).toBe(false);
  });
});

describe("theme variant strategy", () => {
  it("uses style queries only when every target supports them", () => {
    expect(supportsStyleQueries(["chrome 130", "safari 18.2", "ios_saf 18.1"])).toBe(true);
    expect(supportsStyleQueries(["chrome 130", "firefox 135"])).toBe(false);
    expect(supportsStyleQueries(["safari 17.6"])).toBe(false);
  });

  it("resolves auto from the repository browserslist (includes Firefox → selector)", async () => {
    const { config } = await loadConfig(dir);
    expect(resolveThemeVariants(config, process.cwd()).themeVariants).toBe("selector");
  });
});

describe("optimize()", () => {
  it("lowers nesting and minifies", () => {
    const { code } = optimize(".a { & .b { color: red; } }", { minify: true });
    expect(code).toBe(".a .b{color:red}");
  });
});
