/**
 * SC-004 benchmark (specs/001-core-framework T039): cold builds of 1 000 and 10 000 files and incremental p95.
 * Exits non-zero when a budget is exceeded. Usage: pnpm --filter @newbrush/engine bench
 */
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Engine } from "../src/engine.ts";
import { Scanner } from "../src/node/index.ts";

const POOL = [
  "flex",
  "grid",
  "hidden",
  "block",
  "items-center",
  "justify-between",
  "gap-4",
  "gap-6",
  "p-4",
  "p-8",
  "px-4",
  "py-2",
  "m-auto",
  "-mt-2",
  "w-full",
  "w-1/2",
  "max-w-prose",
  "rounded-lg",
  "rounded-xl",
  "shadow-md",
  "hover:shadow-lg",
  "bg-surface-raised",
  "bg-brand-600",
  "hover:bg-brand-700",
  "text-muted",
  "text-lg",
  "font-semibold",
  "border",
  "md:grid-cols-3",
  "lg:grid-cols-4",
  "sm:flex-row",
  "dark:bg-neutral-900",
  "focus-visible:ring-2",
  "transition",
  "duration-base",
  "truncate",
  "sr-only",
  "@container",
  "@md:flex-row",
  "opacity-50",
  "z-modal",
  "aspect-video",
];

function file(i: number): string {
  const pick = (n: number) => POOL[(i * 7 + n * 13) % POOL.length];
  const classes = Array.from({ length: 12 }, (_, n) => pick(n)).join(" ");
  return `<section class="${classes}">\n  <h2 class="text-${["sm", "base", "lg", "xl"][i % 4]} p-${(i % 12) + 1}">Item ${i}</h2>\n  <p>Lorem ipsum dolor sit amet ${i}.</p>\n</section>\n`;
}

async function cold(count: number): Promise<number> {
  const dir = await mkdtemp(join(tmpdir(), "nb-bench-"));
  try {
    await Promise.all(
      Array.from({ length: count }, (_, i) => writeFile(join(dir, `f${i}.html`), file(i))),
    );
    const start = performance.now();
    const scanner = new Scanner(["**/*.html"], dir);
    const engine = new Engine({ content: ["**/*.html"] });
    engine.addCandidates(await scanner.scanAll());
    engine.css();
    return performance.now() - start;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function incremental(runs: number): Promise<number> {
  const dir = await mkdtemp(join(tmpdir(), "nb-bench-"));
  try {
    await Promise.all(
      Array.from({ length: 1000 }, (_, i) => writeFile(join(dir, `f${i}.html`), file(i))),
    );
    const scanner = new Scanner(["**/*.html"], dir);
    const engine = new Engine({ content: ["**/*.html"] });
    engine.addCandidates(await scanner.scanAll());
    engine.css();
    const times: number[] = [];
    for (let r = 0; r < runs; r++) {
      const path = join(dir, "f0.html");
      await writeFile(
        path,
        `<div class="p-${r % 96} mt-${r % 12} hover:text-brand-${(r % 9) * 100 + 100}">`,
      );
      const start = performance.now();
      const { changed } = engine.addCandidates(await scanner.update(path));
      if (changed) engine.css();
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    return times[Math.floor(times.length * 0.95)] ?? 0;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const results = [
  { name: "cold build, 1 000 files", ms: await cold(1000), budget: 1000 },
  { name: "cold build, 10 000 files", ms: await cold(10000), budget: 2000 },
  { name: "incremental rebuild p95", ms: await incremental(100), budget: 50 },
];
let failed = false;
for (const r of results) {
  const ok = r.ms <= r.budget;
  failed ||= !ok;
  console.log(`${ok ? "✓" : "✗"} ${r.name}: ${r.ms.toFixed(1)} ms (budget ${r.budget} ms)`);
}
process.exit(failed ? 1 : 0);
