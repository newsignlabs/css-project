import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { run } from "../src/run.ts";
import { fixture, nb, read } from "./fixture.ts";

// T092 — CLI contract (specs/001-core-framework/contracts/engine-api.md): outputs and exit codes 0/1/2/3.
let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
  await cleanup?.();
  cleanup = undefined;
});

describe("nb (no command)", () => {
  it("prints usage and exits 0 for --help", async () => {
    const f = await fixture();
    cleanup = f.cleanup;
    const r = await nb(f.dir, "--help");
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/Usage: nb <command>/);
    for (const cmd of ["init", "build", "watch", "explain", "doctor", "tokens"])
      expect(r.out).toContain(cmd);
  });

  it("exits 1 for an unknown command", async () => {
    const f = await fixture();
    cleanup = f.cleanup;
    const r = await nb(f.dir, "frobnicate");
    expect(r.code).toBe(1);
    expect(r.err).toMatch(/Unknown command "frobnicate"/);
  });
});

describe("nb init", () => {
  it("scaffolds config and entry CSS for the vite template", async () => {
    const f = await fixture();
    cleanup = f.cleanup;
    const r = await nb(f.dir, "init", "--template", "vite");
    expect(r.code).toBe(0);
    const config = await read(f.dir, "newbrush.config.ts");
    expect(config).toContain('from "newbrush/config"');
    expect(config).toContain("./src/**/*.{js,ts,jsx,tsx,vue,svelte}");
    expect(await read(f.dir, "src/app.css")).toBe('@import "newbrush";\n@newbrush utilities;\n');
  });

  it("writes the utility prefix when given", async () => {
    const f = await fixture();
    cleanup = f.cleanup;
    await nb(f.dir, "init", "--prefix", "nb-");
    expect(await read(f.dir, "newbrush.config.ts")).toContain('prefix: { utilities: "nb-" }');
  });

  it("refuses to overwrite without --force (exit 1)", async () => {
    const f = await fixture({ "newbrush.config.ts": "export default {}" });
    cleanup = f.cleanup;
    const r = await nb(f.dir, "init");
    expect(r.code).toBe(1);
    expect(r.err).toMatch(/already exists/);
    expect((await nb(f.dir, "init", "--force")).code).toBe(0);
  });
});

describe("nb build", () => {
  const files = {
    "newbrush.config.json": JSON.stringify({ content: ["src/**/*.html"] }),
    "src/index.html": '<main class="p-4 md:grid-cols-3 hover:bg-brand-600/80 nb-btn">',
    "src/app.css":
      '@import "newbrush";\n@newbrush utilities;\n.card { @nb-apply p-6 rounded-xl hover:shadow-lg; }\n',
  };

  it("bundles newbrush, generates used utilities and expands @nb-apply", async () => {
    const f = await fixture(files);
    cleanup = f.cleanup;
    const r = await nb(f.dir, "build", "-i", "src/app.css", "-o", "dist/app.css");
    expect(r.code).toBe(0);
    const css = await read(f.dir, "dist/app.css");
    expect(css).toContain("@layer nb.reset");
    expect(css).toContain(".nb-btn");
    expect(css).toContain(".p-4");
    expect(css).toContain(".md\\:grid-cols-3");
    expect(css).not.toContain("@newbrush");
    expect(css).not.toContain("@nb-apply");
    expect(css).toMatch(/\.card\s*\{[^}]*padding:\s*var\(--nb-space-6\)/);
    expect(css).toMatch(/\.card:hover/);
    expect(r.err).toMatch(/wrote dist\/app\.css/);
  });

  it("minifies with --minify and is deterministic", async () => {
    const f = await fixture(files);
    cleanup = f.cleanup;
    await nb(f.dir, "build", "-i", "src/app.css", "-o", "a.css", "--minify");
    await nb(f.dir, "build", "-i", "src/app.css", "-o", "b.css", "--minify");
    const [a, b] = [await read(f.dir, "a.css"), await read(f.dir, "b.css")];
    expect(a).toBe(b);
    expect(a.split("\n").length).toBeLessThan(5);
  });

  it("writes utilities only when no input is given", async () => {
    const f = await fixture(files);
    cleanup = f.cleanup;
    expect((await nb(f.dir, "build", "-o", "u.css")).code).toBe(0);
    const css = await read(f.dir, "u.css");
    expect(css).toContain(".p-4");
    expect(css).not.toMatch(/@layer nb\.reset\s*\{/);
  });

  it("re-tints the bundle for theme.seeds (T061)", async () => {
    const seeded = {
      ...files,
      "newbrush.config.json": JSON.stringify({
        content: ["src/**/*.html"],
        theme: { seeds: { brand: "#16a34a" } },
      }),
    };
    const f = await fixture(seeded);
    cleanup = f.cleanup;
    for (const flags of [[], ["--minify"]]) {
      expect((await nb(f.dir, "build", "-i", "src/app.css", "-o", "out.css", ...flags)).code).toBe(
        0,
      );
      const css = await read(f.dir, "out.css");
      // framework defaults stay, followed by the seeded override that outranks them
      expect(css.match(/--nb-color-brand-600:/g)?.length).toBeGreaterThanOrEqual(3);
      expect(css).toMatch(
        /:root:root,\s*:root ::backdrop,\s*\[data-nb-theme\]\[data-nb-theme\]\s*\{[^}]*--nb-color-brand-600:/,
      );
    }
    expect((await nb(f.dir, "build", "-o", "u.css")).code).toBe(0);
    expect(await read(f.dir, "u.css")).toMatch(/:root:root[^{]*\{[^}]*--nb-color-brand-50:/);
  });

  it("exits 2 for an invalid theme seed", async () => {
    const f = await fixture({
      ...files,
      "newbrush.config.json": JSON.stringify({
        content: ["src/**/*.html"],
        theme: { seeds: { brand: "bluish" } },
      }),
    });
    cleanup = f.cleanup;
    const r = await nb(f.dir, "build", "-o", "out.css");
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/theme\.seeds\.brand: "bluish" is not a valid CSS colour/);
  });

  it("exits 1 for unknown @nb-apply utilities", async () => {
    const f = await fixture({ ...files, "src/app.css": ".x { @nb-apply p-4 not-real; }\n" });
    cleanup = f.cleanup;
    const r = await nb(f.dir, "build", "-i", "src/app.css", "-o", "out.css");
    expect(r.code).toBe(1);
    expect(r.err).toContain("not-real");
  });

  it("exits 1 when the input file is missing", async () => {
    const f = await fixture(files);
    cleanup = f.cleanup;
    expect((await nb(f.dir, "build", "-i", "nope.css", "-o", "out.css")).code).toBe(1);
  });

  it("exits 2 for an invalid config", async () => {
    const f = await fixture({
      ...files,
      "newbrush.config.json": JSON.stringify({ content: [], bogus: true }),
    });
    cleanup = f.cleanup;
    const r = await nb(f.dir, "build", "-o", "out.css");
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/Invalid/);
  });

  it("rebuilds in --watch mode when content changes", async () => {
    const f = await fixture(files);
    cleanup = f.cleanup;
    const controller = new AbortController();
    let err = "";
    const done = run(["build", "-o", "w.css", "--watch"], {
      cwd: f.dir,
      stdout: () => {},
      stderr: (s) => (err += s),
      signal: controller.signal,
    });
    const waitFor = async (pred: () => Promise<boolean>) => {
      for (let i = 0; i < 100; i++) {
        if (await pred()) return;
        await new Promise((r) => setTimeout(r, 50));
      }
      throw new Error(`timed out; stderr: ${err}`);
    };
    await waitFor(
      async () => existsSync(join(f.dir, "w.css")) && (await read(f.dir, "w.css")).includes(".p-4"),
    );
    await writeFile(join(f.dir, "src/index.html"), '<main class="p-4 gap-12">');
    await waitFor(async () => (await read(f.dir, "w.css")).includes(".gap-12"));
    controller.abort();
    expect(await done).toBe(0);
  });
});

describe("nb explain", () => {
  it("prints the parse tree and CSS", async () => {
    const f = await fixture();
    cleanup = f.cleanup;
    const r = await nb(f.dir, "explain", "md:hover:bg-brand-600/80");
    expect(r.code).toBe(0);
    expect(r.out).toContain('"utility": "bg"');
    expect(r.out).toContain("oklch(from var(--nb-color-brand-600) l c h / 0.8)");
  });

  it("reports rejected arbitrary values and exits 1", async () => {
    const f = await fixture();
    cleanup = f.cleanup;
    const r = await nb(f.dir, "explain", "w-[;evil]");
    expect(r.code).toBe(1);
    expect(r.out + r.err).toContain("NB_ARBITRARY_REJECTED");
  });
});

describe("nb contrast (T062)", () => {
  const cfg = (contrast?: object, seeds?: object) => ({
    "newbrush.config.json": JSON.stringify({
      content: ["src/**/*.html"],
      ...(contrast ? { contrast } : {}),
      ...(seeds ? { theme: { seeds } } : {}),
    }),
    "src/index.html": '<p class="p-4">x</p>',
    "src/app.css": '@import "newbrush";\n@newbrush utilities;\n',
  });

  it("passes AA for the defaults and summarises every theme", async () => {
    const f = await fixture(cfg());
    cleanup = f.cleanup;
    const r = await nb(f.dir, "contrast");
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/WCAG 2 AA · APCA Lc/);
    for (const theme of ["light", "dark", "contrast"])
      expect(r.out).toMatch(new RegExp(`${theme}\\s+✓`));
    expect(r.out).toMatch(/✓ all \d+ pairs pass AA/);
  });

  it("exits 3 and lists failures at AAA; --all prints every pair with APCA Lc", async () => {
    const f = await fixture(cfg());
    cleanup = f.cleanup;
    const r = await nb(f.dir, "contrast", "--level", "AAA", "--all");
    expect(r.code).toBe(3);
    expect(r.out).toMatch(
      /✗ light\s+[\d.]+:1\s+7\.00:1\s+-?[\d.]+\s+color\.text\.link on color\.surface/,
    );
    expect(r.out).toMatch(/light: color\.text\.link on color\.surface\.subtle [\d.]+:1 < 7\.00:1/);
    expect(r.out).toMatch(/✗ \d+ pair\(s\) below AAA/);
  });

  it("applies contrast.onFail: fix and reports the fixes", async () => {
    const f = await fixture(cfg({ level: "AAA", onFail: "fix" }));
    cleanup = f.cleanup;
    const r = await nb(f.dir, "contrast");
    expect(r.code).toBe(0);
    expect(r.out).toContain("fixed light: color.text.link {color.brand.600} → {color.brand.800}");
    expect(r.out).toMatch(/✓ all pairs pass AAA with \d+ fix\(es\)/);
  });

  it("prints JSON with --json", async () => {
    const f = await fixture(cfg());
    cleanup = f.cleanup;
    const r = await nb(f.dir, "contrast", "--json");
    const report = JSON.parse(r.out);
    expect(report.level).toBe("AA");
    expect(report.failures).toEqual([]);
    expect(report.results[0]).toHaveProperty("lc");
  });

  it("rejects an unknown level", async () => {
    const f = await fixture(cfg());
    cleanup = f.cleanup;
    expect((await nb(f.dir, "contrast", "--level", "AAAA")).code).toBe(1);
  });

  it("nb build warns by default, fails with onFail: error (exit 3), and emits fixes with onFail: fix", async () => {
    const warn = await fixture(cfg({ level: "AAA" }));
    cleanup = warn.cleanup;
    const w = await nb(warn.dir, "build", "-i", "src/app.css", "-o", "out.css");
    expect(w.code).toBe(0);
    expect(w.err).toMatch(/nb: contrast: light: color\.text\.link on color\.surface/);
    await warn.cleanup();

    const error = await fixture(cfg({ level: "AAA", onFail: "error" }));
    cleanup = error.cleanup;
    const e = await nb(error.dir, "build", "-i", "src/app.css", "-o", "out.css");
    expect(e.code).toBe(3);
    expect(e.err).toMatch(/fail AAA contrast \(contrast\.onFail: "error"\)/);
    await error.cleanup();

    const fix = await fixture(cfg({ level: "AAA", onFail: "fix" }));
    cleanup = fix.cleanup;
    const x = await nb(fix.dir, "build", "-i", "src/app.css", "-o", "out.css");
    expect(x.code).toBe(0);
    expect(x.err).toMatch(/nb: contrast: fixed light: color\.text\.link/);
    expect(await read(fix.dir, "out.css")).toMatch(
      /\[data-nb-theme="light"\]\[data-nb-theme="light"\][^{]*\{[^}]*--nb-color-text-link: var\(--nb-color-brand-800\)/,
    );
  });

  it("stays silent for a default build", async () => {
    const f = await fixture(cfg());
    cleanup = f.cleanup;
    const r = await nb(f.dir, "build", "-i", "src/app.css", "-o", "out.css");
    expect(r.err).not.toMatch(/contrast/);
  });
});

describe("nb theme create (T065)", () => {
  it("writes a named theme, reports its contrast and how to use it", async () => {
    const f = await fixture({});
    cleanup = f.cleanup;
    const r = await nb(f.dir, "theme", "create", "acme", "--seed", "#e11d48", "--from", "dark");
    expect(r.code).toBe(0);
    expect(r.out).toContain('Created themes/acme.css (theme "acme", based on dark)');
    expect(r.out).toMatch(/Contrast \(AA\): ✓ all \d+ pairs pass/);
    expect(r.out).toContain('<html data-nb-theme="acme">');
    const css = await read(f.dir, "themes/acme.css");
    expect(css).toContain("Generated by: nb theme create acme --seed #e11d48 --from dark");
    expect(css).toContain('[data-nb-theme="acme"][data-nb-theme="acme"][data-nb-theme="acme"] {');
    expect(css).toContain("color-scheme: dark;");
  });

  it("honours -o, refuses to overwrite without --force and seeds accent/neutral", async () => {
    const f = await fixture({});
    cleanup = f.cleanup;
    const args = [
      "theme",
      "create",
      "ocean",
      "--seed",
      "#0ea5e9",
      "--neutral",
      "#64748b",
      "-o",
      "css/ocean.css",
    ];
    expect((await nb(f.dir, ...args)).code).toBe(0);
    expect(await read(f.dir, "css/ocean.css")).toContain(
      "--nb-color-neutral-50: var(--nb-tint-neutral-50,",
    );
    const again = await nb(f.dir, ...args);
    expect(again.code).toBe(1);
    expect(again.err).toMatch(/exists \(use --force/);
    expect((await nb(f.dir, ...args, "--force")).code).toBe(0);
  });

  it("rejects bad input with exit 1", async () => {
    const f = await fixture({});
    cleanup = f.cleanup;
    for (const args of [
      ["theme", "create", "dark", "--seed", "red"],
      ["theme", "create", "Acme", "--seed", "red"],
      ["theme", "create", "acme"],
      ["theme", "create", "acme", "--seed", "bluish"],
      ["theme", "create", "acme", "--seed", "red", "--from", "sepia"],
      ["theme", "make", "acme", "--seed", "red"],
    ])
      expect((await nb(f.dir, ...args)).code, args.join(" ")).toBe(1);
  });
});

describe("nb doctor", () => {
  it("passes a healthy project", async () => {
    const f = await fixture({
      "newbrush.config.json": JSON.stringify({ content: ["*.html"] }),
      "a.html": "<i class='p-4'>",
    });
    cleanup = f.cleanup;
    const r = await nb(f.dir, "doctor");
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/✓ config/);
    expect(r.out).toMatch(/✓ content: 1 file/);
  });

  it("warns about unprefixed utilities next to Tailwind (FR-009)", async () => {
    const f = await fixture({
      "newbrush.config.json": JSON.stringify({ content: ["*.html"] }),
      "a.html": "<i>",
      "package.json": JSON.stringify({ dependencies: { tailwindcss: "^4.0.0" } }),
    });
    cleanup = f.cleanup;
    const r = await nb(f.dir, "doctor");
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/⚠ .*tailwindcss.*prefix/i);
  });

  it("warns when content globs match no files", async () => {
    const f = await fixture({
      "newbrush.config.json": JSON.stringify({ content: ["nothing/**/*.html"] }),
    });
    cleanup = f.cleanup;
    expect((await nb(f.dir, "doctor")).out).toMatch(/⚠ content: no files/);
  });

  it("exits 2 for invalid config", async () => {
    const f = await fixture({ "newbrush.config.json": '{ "content": 5 }' });
    cleanup = f.cleanup;
    expect((await nb(f.dir, "doctor")).code).toBe(2);
  });
});

describe("nb tokens", () => {
  it.each([
    ["css", "tokens.css", "--nb-color-surface"],
    ["json", "tokens.json", '"cssVar"'],
    ["ts", "tokens.d.ts", "TokenName"],
    ["figma", "figma-variables.json", '"collections"'],
  ])("exports %s", async (format, file, needle) => {
    const f = await fixture();
    cleanup = f.cleanup;
    const r = await nb(f.dir, "tokens", "--format", format, "-o", "out");
    expect(r.code).toBe(0);
    expect(await read(f.dir, `out/${file}`)).toContain(needle);
  });
});
