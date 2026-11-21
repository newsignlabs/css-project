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
import { checkContrast, formatContrast, type PairResult } from "@newbrush/tokens/contrast";
import { checkThemeName, customThemeCss } from "@newbrush/tokens/theme";
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
  contrast  Report semantic colour contrast (WCAG 2 + APCA)       [--level AA|AAA] [--all] [--json] [-c config]
  theme     Scaffold a named theme: theme create <name>           --seed <color> [--accent c] [--neutral c] [--from light|dark|contrast] [-o file] [--force]
  style     Design styles: style list | style create <name>       list: [--json] [-c config] · create: [--from <style>] [-o dir] [--force]
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
      case "contrast":
        return await contrast(rest, io);
      case "theme":
        return await theme(rest, io);
      case "style":
        return await style(rest, io);
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
    return optimize(engine.themeCss + engine.generate(candidates, { reportUnknown: false }).css, {
      minify,
      cwd,
    }).code;
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
  // Drop the design styles config `styles` leaves out, then lower nesting from @nb-apply and other modern syntax
  // for the project's browserslist.
  return optimize(engine.selectStyles(code.toString()), { minify, cwd, filename: input }).code;
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
  if (!reportContrast(engine, io)) return EXIT.budget;
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

/** Prints contrast warnings/fixes for a build; false when `contrast.onFail: "error"` must stop it (exit 3). */
function reportContrast(engine: Engine, io: IO): boolean {
  const { messages, fail } = engine.contrastVerdict();
  for (const message of messages) io.stderr(`nb: contrast: ${message}\n`);
  if (fail)
    io.stderr(
      `nb: ${engine.contrast.failures.length} semantic colour pair(s) fail ${engine.contrast.level} contrast (contrast.onFail: "error"); run \`nb contrast\` for details\n`,
    );
  return !fail;
}

// ── contrast ─────────────────────────────────────────────────────────────────

async function contrast(argv: string[], io: IO): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      level: { type: "string" },
      all: { type: "boolean", default: false },
      json: { type: "boolean", default: false },
      config: { type: "string", short: "c" },
    },
  });
  if (values.level && values.level !== "AA" && values.level !== "AAA")
    throw new UsageError(`--level must be AA or AAA (got "${values.level}")`);
  const { config } = await createProjectEngine(io.cwd, values.config);
  const level = (values.level ?? config.contrast?.level ?? "AA") as "AA" | "AAA";
  const report = checkContrast({
    seeds: config.theme?.seeds,
    level,
    fix: config.contrast?.onFail === "fix",
  });
  if (values.json) {
    io.stdout(`${JSON.stringify(report, null, 2)}\n`);
    return report.failures.length ? EXIT.budget : EXIT.ok;
  }

  const ratio = (n: number) => `${n.toFixed(2)}:1`;
  const lines = [`newBrush contrast · WCAG 2 ${level} · APCA Lc for reference`, ""];
  for (const theme of ["light", "dark", "contrast"] as const) {
    const rows = report.results.filter((p) => p.theme === theme);
    const passed = rows.filter((p) => p.pass).length;
    const lowest = rows.reduce<PairResult | undefined>(
      (low, p) => (!low || p.ratio / p.min < low.ratio / low.min ? p : low),
      undefined,
    );
    lines.push(
      `  ${theme.padEnd(9)} ${passed === rows.length ? "✓" : "✗"} ${passed}/${rows.length} pass` +
        (lowest
          ? `   closest: ${lowest.fg} on ${lowest.bg} ${ratio(lowest.ratio)} (needs ${ratio(lowest.min)})`
          : ""),
    );
  }
  if (values.all) {
    lines.push("", "  theme     ratio    min     APCA Lc  pair");
    for (const p of report.results)
      lines.push(
        `  ${p.pass ? "✓" : "✗"} ${p.theme.padEnd(8)} ${ratio(p.ratio).padStart(7)} ${ratio(p.min).padStart(7)} ${p.lc.toFixed(1).padStart(8)}  ${p.fg} on ${p.bg}`,
      );
  }
  const details = formatContrast(report);
  if (details.length) lines.push("", ...details.map((d) => `  ${d}`));
  lines.push(
    "",
    report.failures.length
      ? `✗ ${report.failures.length} pair(s) below ${level}` +
          (config.contrast?.onFail === "fix" ? " that no palette colour can fix" : "")
      : report.fixes.length
        ? `✓ all pairs pass ${level} with ${report.fixes.length} fix(es) (contrast.onFail: "fix")`
        : `✓ all ${report.results.length} pairs pass ${level}`,
  );
  io.stdout(`${lines.join("\n")}\n`);
  return report.failures.length ? EXIT.budget : EXIT.ok;
}

async function doctor(_argv: string[], io: IO): Promise<number> {
  const { engine, config, configPath, customStyles } = await createProjectEngine(io.cwd);
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

  // Design styles (specs/004 T029): what the build includes, and markup that cannot work as written.
  const builtIn = await builtInStyles();
  const all = [...builtIn, ...customStyles.info];
  const prefix = config.prefix?.styles ?? "";
  const classes = styleClassMap(all, prefix);
  ok(
    `styles: ${config.styles === "all" ? "all built-in" : config.styles === false ? "none built-in" : config.styles.join(", ")}${customStyles.info.length ? ` + custom ${customStyles.info.map((c) => c.name).join(", ")}` : ""}`,
  );
  const known = new Set([...all.map((st) => st.name), "default"]);
  const used = new Set<string>();
  for (const file of files) {
    const text = await readFile(file, "utf8").catch(() => "");
    const where = relative(io.cwd, file);
    for (const m of text.matchAll(/\bclass(?:Name)?=["'`]([^"'`]*)["'`]/g)) {
      const list = (m[1] ?? "").split(/\s+/);
      for (const c of list) used.add(c);
      const styled = [...new Set(list.map((c) => classes.get(c)).filter(Boolean))];
      if (styled.length > 1)
        warn(
          `${where}: one element has several styles (${styled.join(", ")}) — the last in the stylesheet wins; keep one`,
        );
    }
    for (const m of text.matchAll(/data-nb-style=["']([^"']*)["']/g))
      if (!known.has(m[1] ?? ""))
        warn(`${where}: data-nb-style="${m[1]}" is not a style (${[...known].join(", ")})`);
  }
  const utilities = new Set(engine.knownClasses());
  // Only classes the content actually uses, e.g. a custom style or alias named like a utility (`grid`).
  const clashes = [...classes.keys()].filter((c) => utilities.has(c) && used.has(c));
  if (clashes.length)
    warn(
      `${clashes.join(", ")} applies both a style and a utility of the same name — use the style's own name or nb- form (e.g. nb-g-morph), or set prefix: { styles: "s-" }`,
    );

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

// ── style ────────────────────────────────────────────────────────────────────

interface BuiltInStyle {
  name: string;
  aliases: string[];
  title: string;
  preferredScheme: string;
  status: string;
}

async function builtInStyles(): Promise<BuiltInStyle[]> {
  const require = createRequire(import.meta.url);
  const manifest = JSON.parse(
    await readFile(require.resolve("@newbrush/styles/manifest.json"), "utf8"),
  ) as { styles: BuiltInStyle[] };
  return manifest.styles;
}

/** Every class that applies a style (bare with prefix.styles, nb-, aliases), by style name. */
function styleClassMap(
  styles: { name: string; aliases: string[] }[],
  prefix: string,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const st of styles)
    for (const cls of [
      `${prefix}${st.name}`,
      `nb-${st.name}`,
      ...st.aliases.map((a) => `${prefix}${a}`),
    ])
      map.set(cls, st.name);
  for (const cls of [`${prefix}style-default`, "nb-style-default"]) map.set(cls, "default");
  return map;
}

const STYLE_NAME = /^[a-z][a-z0-9-]*$/;

/** nb style list | nb style create <name> (specs/004 T029). */
async function style(argv: string[], io: IO): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      json: { type: "boolean", default: false },
      config: { type: "string", short: "c" },
      from: { type: "string", default: "minimal" },
      output: { type: "string", short: "o" },
      force: { type: "boolean", default: false },
    },
  });
  const [action, name] = positionals;
  const builtIn = await builtInStyles();

  if (action === "list") {
    const { config, customStyles } = await createProjectEngine(io.cwd, values.config);
    const included = (n: string) =>
      config.styles === "all" || (config.styles !== false && config.styles.includes(n));
    const rows = [
      ...builtIn.map((st) => ({ ...st, source: "built-in", included: included(st.name) })),
      ...customStyles.info.map((st) => ({ ...st, source: st.path, included: true })),
    ];
    if (values.json) {
      io.stdout(`${JSON.stringify(rows, null, 2)}\n`);
      return EXIT.ok;
    }
    for (const r of rows)
      io.stdout(
        `${r.included ? "●" : "○"} ${r.name.padEnd(12)} ${(r.aliases.length ? `(${r.aliases.join(", ")})` : "").padEnd(12)} ${r.preferredScheme.padEnd(5)} ${r.status.padEnd(6)} ${r.source}\n`,
      );
    io.stdout(
      `\n● included in the build (config styles: ${JSON.stringify(config.styles)}), ○ left out. Use one: <body class="neon">, variants: neon:p-4\n`,
    );
    return EXIT.ok;
  }

  if (action === "create" && name) {
    if (!STYLE_NAME.test(name))
      throw new UsageError(
        `style name "${name}" must start with a letter and use only lowercase letters, digits and hyphens`,
      );
    if (name === "default" || name.startsWith("nb-"))
      throw new UsageError(`"${name}" is reserved; choose another name`);
    if (builtIn.some((st) => st.name === name || st.aliases.includes(name)))
      throw new UsageError(`"${name}" is a built-in style or alias; choose another name`);
    const from = values.from as string;
    if (!builtIn.some((st) => st.name === from))
      throw new UsageError(
        `--from must be a built-in style: ${builtIn.map((st) => st.name).join(", ")} (got "${from}")`,
      );
    const dir = resolve(io.cwd, values.output ?? join("styles", name));
    if (existsSync(join(dir, "style.json")) && !values.force)
      throw new UsageError(`${relative(io.cwd, dir)}/style.json exists (use --force to overwrite)`);
    const require = createRequire(import.meta.url);
    const src = join(dirname(require.resolve("@newbrush/styles/package.json")), "src", from);
    const source = JSON.parse(await readFile(join(src, "style.json"), "utf8")) as Record<
      string,
      unknown
    >;
    const json = {
      ...source,
      $schema: "https://newbrush.dev/schema/style-source.v1.json",
      name,
      aliases: [],
      title: name.replace(
        /(^|-)([a-z])/g,
        (_, dash: string, c: string) => `${dash ? " " : ""}${c.toUpperCase()}`,
      ),
      description: `Custom style based on ${from}.`,
      status: "beta",
    };
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "style.json"), `${JSON.stringify(json, null, 2)}\n`);
    for (const file of ["recipes.css", "preview.html"])
      if (existsSync(join(src, file))) await copyFile(join(src, file), join(dir, file));
    const rel = relative(io.cwd, dir);
    io.stdout(
      `Created ${rel}/ (style "${name}", based on ${from})\n\nUse it:\n  1. add "./${rel}" to customStyles in newbrush.config\n  2. <body class="${name}">   or   <section class="${name}">\n  3. nb build — the style is validated and its colours are contrast-checked\n`,
    );
    return EXIT.ok;
  }
  throw new UsageError(
    "Usage: nb style list [--json] | nb style create <name> [--from <style>] [-o dir] [--force]",
  );
}

// ── tokens ───────────────────────────────────────────────────────────────────

// ── theme ────────────────────────────────────────────────────────────────────

async function theme(argv: string[], io: IO): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      seed: { type: "string" },
      accent: { type: "string" },
      neutral: { type: "string" },
      from: { type: "string", default: "light" },
      output: { type: "string", short: "o" },
      force: { type: "boolean", default: false },
    },
  });
  const [action, name] = positionals;
  if (action !== "create" || !name)
    throw new UsageError(
      "Usage: nb theme create <name> --seed <color> [--from light|dark|contrast]",
    );
  const nameProblem = checkThemeName(name);
  if (nameProblem) throw new UsageError(nameProblem);
  const from = values.from as string;
  if (from !== "light" && from !== "dark" && from !== "contrast")
    throw new UsageError(`--from must be light, dark or contrast (got "${from}")`);
  const seeds = Object.fromEntries(
    (
      [
        ["brand", values.seed],
        ["accent", values.accent],
        ["neutral", values.neutral],
      ] as const
    ).filter(([, color]) => color),
  ) as { brand?: string; accent?: string; neutral?: string };
  if (!Object.keys(seeds).length)
    throw new UsageError(
      "Give at least one seed: --seed <brand colour> (and optionally --accent, --neutral)",
    );

  const output = resolve(io.cwd, values.output ?? join("themes", `${name}.css`));
  if (existsSync(output) && !values.force)
    throw new UsageError(`${relative(io.cwd, output)} exists (use --force to overwrite)`);
  const require = createRequire(import.meta.url);
  const tokensCss = await readFile(require.resolve("@newbrush/tokens/tokens.css"), "utf8");
  const command = ["nb theme create", name, ...argv.slice(2).filter((a) => a !== "--force")].join(
    " ",
  );
  let css: string;
  try {
    css = customThemeCss({ name, from, seeds, tokensCss, command });
  } catch (error) {
    throw new UsageError((error as Error).message);
  }
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, css);

  // Same palettes, same base theme: the built-in checker's results for `from` are this theme's results.
  const report = checkContrast({ seeds });
  const rows = report.results.filter((p) => p.theme === from);
  const failures = rows.filter((p) => !p.pass);
  const file = relative(io.cwd, output);
  io.stdout(
    [
      `Created ${file} (theme "${name}", based on ${from})`,
      `Contrast (${report.level}): ${failures.length ? `✗ ${failures.length} of ${rows.length} pairs fail` : `✓ all ${rows.length} pairs pass`}`,
      ...formatContrast({ ...report, results: rows, failures, fixes: [] }).map((l) => `  ${l}`),
      "",
      "Use it:",
      `  <link rel="stylesheet" href="${file}">   <!-- after newbrush.css -->`,
      `  <html data-nb-theme="${name}">   or   <section data-nb-theme="${name}">`,
      "",
    ].join("\n"),
  );
  return failures.length ? EXIT.budget : EXIT.ok;
}

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
