/** Node-only helpers for @newbrush/engine: config loading, content scanning, watching and minification. */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { Config, type ResolvedConfig } from "@newbrush/schema";
import browserslist from "browserslist";
import chokidar from "chokidar";
import fg from "fast-glob";
import { browserslistToTargets, transform } from "lightningcss";
import picomatch from "picomatch";
import { Engine } from "../engine.ts";
import { extractCandidates } from "../extract.ts";

export const CONFIG_FILES = [
  "newbrush.config.ts",
  "newbrush.config.mts",
  "newbrush.config.js",
  "newbrush.config.mjs",
  "newbrush.config.json",
];

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

/** Finds and validates newbrush.config.* in `cwd`. Throws ConfigError on invalid config. */
export async function loadConfig(
  cwd = process.cwd(),
  file?: string,
): Promise<{ config: ResolvedConfig; path: string | null }> {
  const path = file
    ? resolve(cwd, file)
    : CONFIG_FILES.map((f) => join(cwd, f)).find((f) => existsSync(f));
  if (!path)
    return {
      config: Config.parse({ content: ["./**/*.{html,js,jsx,ts,tsx,vue,svelte,astro,md,mdx}"] }),
      path: null,
    };
  let raw: unknown;
  if (path.endsWith(".json")) raw = JSON.parse(await readFile(path, "utf8"));
  else {
    const { createJiti } = await import("jiti");
    const jiti = createJiti(import.meta.url, { moduleCache: false });
    const mod = (await jiti.import(path)) as { default?: unknown };
    raw = mod.default ?? mod;
  }
  const parsed = Config.safeParse(raw);
  if (!parsed.success)
    throw new ConfigError(
      `Invalid ${path}:\n${parsed.error.issues.map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n")}`,
    );
  return { config: parsed.data, path };
}

/** Browsers that support custom-property style queries: Chromium 111+, Safari 18+. */
export function supportsStyleQueries(targets: string[]): boolean {
  return targets.every((t) => {
    const [name, version = "0"] = t.split(" ");
    const v = Number.parseFloat(version.split("-")[0] ?? "0");
    if (["chrome", "edge", "opera", "and_chr"].includes(name ?? ""))
      return v >= 111 || name === "and_chr";
    if (["safari", "ios_saf"].includes(name ?? "")) return v >= 18;
    if (name === "samsung") return v >= 22;
    return false;
  });
}

/** Resolves themeVariants "auto" from the project's browserslist (class-grammar.md §Theme variants). */
export function resolveThemeVariants(config: ResolvedConfig, cwd = process.cwd()): ResolvedConfig {
  if (config.themeVariants !== "auto") return config;
  const targets = browserslist(undefined, { path: cwd });
  return { ...config, themeVariants: supportsStyleQueries(targets) ? "style-query" : "selector" };
}

export async function createProjectEngine(
  cwd = process.cwd(),
  configFile?: string,
): Promise<{ engine: Engine; config: ResolvedConfig; configPath: string | null }> {
  const { config, path } = await loadConfig(cwd, configFile);
  const resolved = resolveThemeVariants(config, cwd);
  return { engine: new Engine(resolved), config: resolved, configPath: path };
}

const IGNORE = ["**/node_modules/**", "**/dist/**", "**/.git/**", "**/.turbo/**", "**/coverage/**"];

/** Incremental content scanner: caches candidates per file. */
export class Scanner {
  private readonly files = new Map<string, Set<string>>();

  constructor(
    readonly globs: string[],
    readonly cwd: string,
  ) {}

  async listFiles(): Promise<string[]> {
    return (
      await fg(this.globs, {
        cwd: this.cwd,
        absolute: true,
        ignore: IGNORE,
        onlyFiles: true,
        dot: false,
      })
    ).sort();
  }

  /** Scans every matching file and returns the union of candidates. */
  async scanAll(): Promise<Set<string>> {
    const paths = await this.listFiles();
    await Promise.all(paths.map((p) => this.update(p)));
    return this.candidates();
  }

  /** Re-reads one file; returns candidates not previously seen in that file. */
  async update(path: string): Promise<Set<string>> {
    let text: string;
    try {
      text = await readFile(path, "utf8");
    } catch {
      this.files.delete(path);
      return new Set();
    }
    const next = extractCandidates(text);
    const prev = this.files.get(path) ?? new Set<string>();
    this.files.set(path, next);
    return new Set([...next].filter((c) => !prev.has(c)));
  }

  remove(path: string): void {
    this.files.delete(path);
  }

  candidates(): Set<string> {
    const all = new Set<string>();
    for (const set of this.files.values()) for (const c of set) all.add(c);
    return all;
  }

  get size(): number {
    return this.files.size;
  }
}

export async function scan(globs: string[], cwd = process.cwd()): Promise<Set<string>> {
  return new Scanner(globs, cwd).scanAll();
}

/** Static directory prefix of a glob, e.g. "src" for a glob that starts with src/ followed by wildcards. */
export function globBase(glob: string): string {
  const parts = glob.replace(/^\.\//, "").split("/");
  const base: string[] = [];
  for (const part of parts) {
    if (/[*?[\]{}()!]/.test(part)) break;
    base.push(part);
  }
  return base.join("/") || ".";
}

/**
 * Watches content globs (chokidar v4 has no glob support, so each glob's static base is watched and events are
 * filtered with picomatch). Calls `onChange` with the absolute path. Returns a close function.
 */
export function watch(
  globs: string[],
  cwd: string,
  onChange: (path: string, event: "add" | "change" | "unlink") => void,
): () => Promise<void> {
  const patterns = globs.map((g) => g.replace(/^\.\//, ""));
  const isMatch = picomatch(patterns, { dot: false });
  const bases = [...new Set(patterns.map(globBase))].map((b) => resolve(cwd, b));
  const watcher = chokidar.watch(bases, {
    ignored: (p) => /node_modules|\.git[\\/]|[\\/]dist[\\/]/.test(p),
    ignoreInitial: true,
  });
  for (const event of ["add", "change", "unlink"] as const) {
    watcher.on(event, (p) => {
      const abs = resolve(cwd, p);
      if (isMatch(relative(cwd, abs).split(sep).join("/"))) onChange(abs, event);
    });
  }
  return () => watcher.close();
}

export interface MinifyOptions {
  filename?: string;
  minify?: boolean;
  sourceMap?: boolean;
  cwd?: string;
}

/** Lowers syntax for the project's browserslist and optionally minifies (Lightning CSS). */
export function optimize(css: string, options: MinifyOptions = {}): { code: string; map?: string } {
  const targets = browserslistToTargets(
    browserslist(undefined, { path: options.cwd ?? process.cwd() }),
  );
  const out = transform({
    filename: options.filename ?? "newbrush.css",
    code: Buffer.from(css),
    minify: options.minify ?? false,
    sourceMap: options.sourceMap ?? false,
    targets,
  });
  return { code: out.code.toString(), ...(out.map ? { map: out.map.toString() } : {}) };
}

export { Engine } from "../engine.ts";
