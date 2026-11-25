// specs/001 T085 — Lighthouse on the docs site: accessibility and best practices must score 100 on every page checked.
// Serves apps/docs/dist under /site/ the way Catalyst Slate does (plain files, no folder → index.html), and runs
// Lighthouse in Playwright's Chromium. Reports land in lighthouse-report/; a failing audit is printed in full.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";

const dist = fileURLToPath(new URL("../../docs/dist/", import.meta.url));
const reports = fileURLToPath(new URL("../lighthouse-report/", import.meta.url));
const BASE = "/site";
const PAGES = [
  "/index.html",
  "/guides/getting-started/index.html",
  "/guides/theming/index.html",
  "/components/button/index.html",
  "/components/modal/index.html",
  "/reference/tokens/index.html",
  "/reference/utilities/index.html",
  "/styles/index.html",
  "/styles/neon/index.html",
  "/playground/index.html",
];
const CATEGORIES = ["accessibility", "best-practices"] as const;
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".xml": "application/xml",
};

if (!existsSync(join(dist, "index.html"))) {
  console.error("apps/docs/dist is missing: run `pnpm build` first.");
  process.exit(1);
}

const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
  const file = path.startsWith(`${BASE}/`) ? join(dist, path.slice(BASE.length)) : "";
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404).end("Not found");
    return;
  }
  res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
  res.end(readFileSync(file));
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

const chrome = await chromeLauncher.launch({
  chromePath: chromium.executablePath(),
  chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
});
mkdirSync(reports, { recursive: true });
let failed = false;
try {
  for (const page of PAGES) {
    const url = `${origin}${BASE}${page}`;
    const result = await lighthouse(url, {
      port: chrome.port,
      output: "json",
      logLevel: "error",
      onlyCategories: [...CATEGORIES],
      formFactor: "desktop",
      screenEmulation: {
        mobile: false,
        width: 1350,
        height: 940,
        deviceScaleFactor: 1,
        disabled: false,
      },
    });
    if (!result) throw new Error(`Lighthouse returned nothing for ${page}`);
    const { lhr } = result;
    writeFileSync(
      join(reports, `${page.replace(/\/index\.html$/, "").replace(/\W+/g, "_") || "_home"}.json`),
      typeof result.report === "string" ? result.report : JSON.stringify(lhr),
    );
    const scores = CATEGORIES.map(
      (c) => `${c} ${Math.round((lhr.categories[c]?.score ?? 0) * 100)}`,
    );
    console.log(`${page}: ${scores.join(" · ")}`);
    for (const category of CATEGORIES) {
      for (const ref of lhr.categories[category]?.auditRefs ?? []) {
        const audit = lhr.audits[ref.id];
        if (!audit || ref.weight === 0 || audit.score === null || audit.score === 1) continue;
        failed = true;
        console.log(`  ✗ [${category}] ${audit.id}: ${audit.title}`);
        const items =
          (audit.details as { items?: Record<string, unknown>[] } | undefined)?.items ?? [];
        for (const item of items.slice(0, 5)) {
          const node = item.node as { selector?: string; snippet?: string } | undefined;
          console.log(
            `      ${node?.selector ?? ""} ${node?.snippet ?? JSON.stringify(item).slice(0, 200)}`,
          );
        }
      }
    }
  }
} finally {
  await chrome.kill();
  server.close();
}
if (failed) {
  console.error("\nLighthouse: accessibility and best practices must both be 100 on every page.");
  process.exit(1);
}
console.log(`\nLighthouse: ${PAGES.length} pages at 100 for ${CATEGORIES.join(" and ")}.`);
