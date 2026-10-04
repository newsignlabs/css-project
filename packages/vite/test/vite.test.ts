import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { build, createServer, type ViteDevServer } from "vite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import newbrush, { type UpdateEvent } from "../src/index.ts";

// T093 — Vite plugin: production build output and dev-server HMR latency (< 50 ms p95, SC-004).
let dir: string;
beforeEach(async () => {
  const tmp = new URL("./.tmp/", import.meta.url).pathname;
  await mkdir(tmp, { recursive: true });
  dir = await mkdtemp(join(tmp, "case-"));
  await mkdir(join(dir, "src"));
  await writeFile(
    join(dir, "newbrush.config.json"),
    JSON.stringify({ content: ["index.html", "src/**/*.{js,ts}"] }),
  );
  await writeFile(
    join(dir, "index.html"),
    '<!doctype html><html><head><link rel="stylesheet" href="/src/app.css"></head><body class="p-4 md:grid"><script type="module" src="/src/main.js"></script></body></html>',
  );
  await writeFile(join(dir, "src/main.js"), 'document.body.className += " text-muted";\n');
  await writeFile(
    join(dir, "src/app.css"),
    '@import "newbrush";\n@newbrush utilities;\n.card { @nb-apply rounded-xl; }\n',
  );
});
afterEach(() => rm(dir, { recursive: true, force: true }));

describe("@newbrush/vite", () => {
  it("builds CSS with the framework, used utilities and @nb-apply", async () => {
    const result = await build({
      root: dir,
      logLevel: "silent",
      plugins: [newbrush()],
      build: { write: false },
    });
    const outputs = (Array.isArray(result) ? result : [result]).flatMap((r) =>
      "output" in r ? r.output : [],
    );
    const css = outputs
      .filter((o) => o.fileName.endsWith(".css"))
      .map((o) => ("source" in o ? String(o.source) : ""))
      .join("");
    expect(css).toContain(".p-4");
    expect(css).toContain(".text-muted");
    expect(css).toMatch(/md\\:grid/);
    expect(css).toMatch(/\.card\{[^}]*border-radius/);
    expect(css).toContain("nb.reset");
    expect(css).not.toContain("@newbrush");
    // Regression: utilities must stay the last layer even when the bundler emits them before the imported framework.
    const order: string[] = [];
    for (const m of css.matchAll(/@layer\s+([^{;]+)[{;]/g)) {
      for (const name of (m[1] ?? "").split(",").map((n) => n.trim()))
        if (!order.includes(name)) order.push(name);
    }
    expect(order).toEqual([
      "nb.reset",
      "nb.tokens",
      "nb.base",
      "nb.layout",
      "nb.components",
      "nb.utilities",
    ]);
  }, 30_000);

  describe("dev server", () => {
    let server: ViteDevServer | undefined;
    afterEach(async () => {
      await server?.close();
      server = undefined;
    });

    it("hot-updates the stylesheet when content gains a class (p95 < 50 ms)", async () => {
      const events: UpdateEvent[] = [];
      server = await createServer({
        root: dir,
        logLevel: "silent",
        server: { port: 0, ws: false },
        plugins: [newbrush({ onUpdate: (e) => events.push(e) })],
      });
      await server.listen();
      // Let the file watcher finish its initial crawl before editing.
      await new Promise((r) => setTimeout(r, 300));
      const first = await server.transformRequest("/src/app.css");
      expect(first?.code).toContain(".p-4");

      const latencies: number[] = [];
      for (let i = 1; i <= 20; i++) {
        const before = events.length;
        await writeFile(
          join(dir, "src/main.js"),
          `document.body.className += " gap-${i % 12 || 12} mt-${i}";\n`,
        );
        for (let t = 0; t < 200 && events.length === before; t++)
          await new Promise((r) => setTimeout(r, 10));
        const event = events.at(-1);
        expect(event, `no update after edit ${i}`).toBeDefined();
        latencies.push(event?.ms ?? Number.POSITIVE_INFINITY);
      }
      const updated = await server.transformRequest("/src/app.css");
      expect(updated?.code).toContain(".mt-20");
      latencies.sort((a, b) => a - b);
      expect(latencies[Math.floor(latencies.length * 0.95)]).toBeLessThan(50);
    }, 30_000);
  });
});
