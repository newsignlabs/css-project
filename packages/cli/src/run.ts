/**
 * The `nb` command (specs/001-core-framework contracts/engine-api.md §@newbrush/cli).
 * Exit codes: 0 ok · 1 build/usage error · 2 invalid config · 3 contrast/budget failure.
 */
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { DirectiveError, type Engine, hasDirectives, processDirectives } from "@newbrush/engine";
import { ConfigError, createProjectEngine, optimize, Scanner, watch } from "@newbrush/engine/node";
import { bundleAsync } from "lightningcss";

export interface IO {
  cwd: string;
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  /** Stops watch mode. */
  signal?: AbortSignal;
}

const USAGE = `Usage: nb <command> [options]

Commands:
  init      Create newbrush.config.ts and an entry stylesheet   [--template plain|vite|next|astro] [--prefix nb-] [--force]
  build     Build CSS (framework + used utilities)               [-i input.css] [-o output.css] [--minify] [--watch] [-c config]
  watch     Alias for build --watch
  explain   Show how classes parse and the CSS they generate     <class...>
  doctor    Check config, content globs, browserslist and class collisions
  tokens    Export design tokens                                 [--format css|json|ts|figma] [-o dir]

Options:
  -h, --help      Show this help
  -v, --version   Show the version
`;

const EXIT = { ok: 0, error: 1, config: 2, budget: 3 } as const;

class UsageError extends Error {}

export async function run(argv: string[], io: IO): Promise<number> {
  const [command, ...rest] = argv;
  try {
    switch (command) {
      case undefined:
      case "-h":
      case "--help":
      case "help":
        io.stdout(USAGE);
        return EXIT.ok;
      case "-v":
      case "--version":
        io.stdout(`${await version()}\n`);
        return EXIT.ok;
      case "init":
        return await init(rest, io);
      case "build":
        return await buildCommand(rest, io);
      case "watch":
        return await buildCommand([...rest, "--watch"], io);
      case "explain":
        return await explain(rest, io);
      case "doctor":
        return await doctor(rest, io);
      case "tokens":
        return await tokens(rest, io);
      default:
        io.stderr(`nb: Unknown command "${command}"\n\n${USAGE}`);
        return EXIT.error;
    }
  } catch (error) {
    if (error instanceof ConfigError) {
      io.stderr(`nb: ${error.message}\n`);
      return EXIT.config;
    }
    if (
      error instanceof UsageError ||
      error instanceof DirectiveError ||
      (error as { code?: string }).code === "ERR_PARSE_ARGS_UNKNOWN_OPTION"
    ) {
      io.stderr(`nb: ${(error as Error).message}\n`);
      return EXIT.error;
    }
    io.stderr(`nb: ${(error as Error).stack ?? error}\n`);
    return EXIT.error;
  }
}

async function version(): Promise<string> {
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")) as {
    version: string;
  };
  return pkg.version;
}

// ── init ─────────────────────────────────────────────────────────────────────

const TEMPLATES: Record<string, { content: string[]; entry: string }> = {
  plain: { content: ["./**/*.html"], entry: "newbrush.css" },
  vite: {
    content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx,vue,svelte}"],
    entry: "src/app.css",
  },
  next: {
    content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx}"],
    entry: "app/newbrush.css",
  },
  astro: {
    content: ["./src/**/*.{astro,html,md,mdx,js,ts,jsx,tsx,vue,svelte}"],
    entry: "src/styles/app.css",
  },
};

async function init(argv: string[], io: IO): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      template: { type: "string", default: "vite" },
      prefix: { type: "string" },
      force: { type: "boolean", default: false },
    },
  });
  const template = TEMPLATES[values.template as string];
  if (!template)
    throw new UsageError(
      `Unknown template "${values.template}" (choose ${Object.keys(TEMPLATES).join(", ")})`,
    );
  const configPath = join(io.cwd, "newbrush.config.ts");
  const entryPath = join(io.cwd, template.entry);
  for (const path of [configPath, entryPath]) {
    if (existsSync(path) && !values.force)
      throw new UsageError(`${relative(io.cwd, path)} already exists (use --force to overwrite)`);
  }
  const prefix = values.prefix
    ? `  prefix: { utilities: ${JSON.stringify(values.prefix)} },\n`
    : "";
  const config = `import { defineConfig } from "newbrush/config";\n\nexport default defineConfig({\n${prefix}  content: ${JSON.stringify(template.content).replace(/","/g, '", "')},\n});\n`;
  await writeFile(configPath, config);
  await mkdir(dirname(entryPath), { recursive: true });
  await writeFile(entryPath, '@import "newbrush";\n@newbrush utilities;\n');
  io.stdout(
    `Created newbrush.config.ts and ${template.entry}\n\nNext:\n  npx nb build -i ${template.entry} -o dist/app.css --watch\n` +
      `  (or use @newbrush/vite / @newbrush/postcss in your bundler)\n`,
  );
  return EXIT.ok;
}

// ── build / watch ────────────────────────────────────────────────────────────

function resolveBare(specifier: string, cwd: string): string {
  try {
    return createRequire(join(cwd, "noop.js")).resolve(specifier);
  } catch {
    return createRequire(import.meta.url).resolve(specifier);
  }
}

async function compileCss(
  input: string | undefined,
  engine: Engine,
  candidates: Set<string>,
  cwd: string,
  minify: boolean,
): Promise<string> {
  if (!input)
    return optimize(engine.generate(candidates, { reportUnknown: false }).css, { minify, cwd })
      .code;
  const { code } = await bundleAsync({
    filename: input,
    minify,
    resolver: {
      async read(file: string) {
        const css = await readFile(file, "utf8");
        return hasDirectives(css) ? processDirectives(css, engine, candidates).css : css;
      },
      resolve(specifier: string, from: string) {
        return specifier.startsWith(".") || specifier.startsWith("/")
          ? resolve(dirname(from), specifier)
          : resolveBare(specifier, cwd);
      },
    },
  });
  // Lower nesting from @nb-apply and other modern syntax for the project's browserslist.
  return optimize(code.toString(), { minify, cwd, filename: input }).code;
}

async function buildCommand(argv: string[], io: IO): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      input: { type: "string", short: "i" },
      output: { type: "string", short: "o" },
      minify: { type: "boolean", default: false },
      watch: { type: "boolean", default: false },
      config: { type: "string", short: "c" },
    },
  });
  const input = values.input ? resolve(io.cwd, values.input) : undefined;
  if (input && !existsSync(input)) throw new UsageError(`Input file not found: ${values.input}`);
  const output = resolve(io.cwd, values.output ?? "newbrush.out.css");
  const { engine, config } = await createProjectEngine(io.cwd, values.config);
  const scanner = new Scanner(config.content, io.cwd);
  await scanner.scanAll();

  const build = async () => {
    const start = performance.now();
    const candidates = scanner.candidates();
    const css = await compileCss(input, engine, candidates, io.cwd, values.minify ?? false);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, css.endsWith("\n") ? css : `${css}\n`);
    const used = engine.generate(candidates, { reportUnknown: false }).classes.used.length;
    io.stderr(
      `nb: wrote ${relative(io.cwd, output)} (${used} utilities, ${(Buffer.byteLength(css) / 1024).toFixed(1)} kB) in ${Math.round(performance.now() - start)} ms\n`,
    );
  };

  await build();
  if (!values.watch) return EXIT.ok;

  engine.addCandidates(scanner.candidates());
  io.stderr("nb: watching for changes…\n");
  let queue = Promise.resolve();
  const close = watch(
    [...config.content, ...(input ? [relative(io.cwd, input)] : [])],
    io.cwd,
    (path, event) => {
      queue = queue.then(async () => {
        try {
          if (path === input) return await build();
          if (event === "unlink") scanner.remove(path);
          const fresh = event === "unlink" ? new Set<string>() : await scanner.update(path);
          if (engine.addCandidates(fresh).changed) await build();
        } catch (error) {
          io.stderr(`nb: ${(error as Error).message}\n`);
        }
      });
    },
  );
  await new Promise<void>((done) => {
    if (io.signal?.aborted) return done();
    io.signal?.addEventListener("abort", () => done(), { once: true });
    if (!io.signal) process.once("SIGINT", () => done());
  });
  await close();
  await queue;
  return EXIT.ok;
}

// ── explain ──────────────────────────────────────────────────────────────────

async function explain(argv: string[], io: IO): Promise<number> {
  const { positionals } = parseArgs({ args: argv, allowPositionals: true, options: {} });
  if (positionals.length === 0)
    throw new UsageError("explain needs at least one class, e.g. nb explain md:px-6");
  const { engine } = await createProjectEngine(io.cwd);
  let failed = false;
  for (const cls of positionals) {
    const result = engine.explain(cls);
    if ("code" in result) {
      failed = true;
      io.stdout(`${cls}\n  ✗ ${result.code}: ${result.message}\n\n`);
    } else {
      io.stdout(
        `${cls}\n${JSON.stringify({ family: result.family, parsed: result.parsed }, null, 2)}\n${result.css}\n`,
      );
    }
  }
  return failed ? EXIT.error : EXIT.ok;
}

// ── doctor ───────────────────────────────────────────────────────────────────

async function doctor(_argv: string[], io: IO): Promise<number> {
  const { config, configPath } = await createProjectEngine(io.cwd);
  const ok = (text: string) => io.stdout(`✓ ${text}\n`);
  const warn = (text: string) => io.stdout(`⚠ ${text}\n`);
  ok(
    `config: ${configPath ? relative(io.cwd, configPath) : "defaults (no newbrush.config.* found)"}`,
  );
  ok(`theme variants: ${config.themeVariants} strategy (from browserslist)`);

  const files = await new Scanner(config.content, io.cwd).listFiles();
  if (files.length)
    ok(
      `content: ${files.length} file${files.length === 1 ? "" : "s"} match ${config.content.join(", ")}`,
    );
  else warn(`content: no files match ${config.content.join(", ")}`);

  try {
    resolveBare("newbrush", io.cwd);
    ok("newbrush: installed");
  } catch {
    warn("newbrush is not installed — run npm i newbrush");
  }

  const pkgPath = join(io.cwd, "package.json");
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(await readFile(pkgPath, "utf8")) as Record<
      string,
      Record<string, string> | undefined
    >;
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const other of ["tailwindcss", "bootstrap"]) {
      if (deps[other] && !config.prefix?.utilities) {
        warn(
          `${other} is installed and newBrush utilities are unprefixed — set prefix: { utilities: "nb-" } to avoid class collisions (FR-009)`,
        );
      }
    }
  }
  return EXIT.ok;
}

// ── tokens ───────────────────────────────────────────────────────────────────

async function tokens(argv: string[], io: IO): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      format: { type: "string", default: "css" },
      output: { type: "string", short: "o", default: "tokens" },
    },
  });
  const require = createRequire(import.meta.url);
  const dist = dirname(require.resolve("@newbrush/tokens/tokens.json"));
  const files: Record<string, string[]> = {
    css: ["css/tokens.css"],
    json: ["tokens.json"],
    ts: ["tokens.js", "tokens.d.ts"],
    figma: ["figma-variables.json"],
  };
  const selected = files[values.format as string];
  if (!selected)
    throw new UsageError(
      `Unknown format "${values.format}" (choose ${Object.keys(files).join(", ")})`,
    );
  const outDir = resolve(io.cwd, values.output as string);
  await mkdir(outDir, { recursive: true });
  for (const file of selected)
    await copyFile(join(dist, file), join(outDir, file.split("/").pop() as string));
  io.stdout(`Exported ${values.format} tokens to ${relative(io.cwd, outDir) || "."}\n`);
  return EXIT.ok;
}
