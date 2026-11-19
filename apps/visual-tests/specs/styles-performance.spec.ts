import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { createRequire } from "node:module";
import type { AddressInfo } from "node:net";
import { expect, type Page, test } from "@playwright/test";

// specs/004 T043 (FR-021, SC-006) — performance gate for shipping every style inside newbrush.css: the plain-html
// showcase is loaded on a throttled mobile profile (4× CPU, slow 4G) with the bundle as shipped and with every style
// rule removed. Bundling the styles must not cost more than 50 ms of first contentful paint (median of 5), and no
// variant may shift layout. Measured through the Chrome DevTools Protocol, so Chromium only.

test.skip(({ browserName }) => browserName !== "chromium", "CPU and network throttling need CDP");

const require = createRequire(import.meta.url);
const css = readFileSync(require.resolve("newbrush/css"), "utf8");
const showcase = readFileSync(
  new URL("../../../examples/plain-html/index.html", import.meta.url),
  "utf8",
).replace(/href="[^"]*newbrush\.css"/, 'href="/newbrush.css"');
const RUNS = 5;
const median = (values: number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;

/** newbrush.css without any design-style rule: the bundle as it would be without styles. */
async function withoutStyles(page: Page): Promise<string> {
  await page.setContent(`<style>${css}</style>`);
  return page.evaluate(() => {
    const strip = (list: CSSRuleList, owner: CSSStyleSheet | CSSGroupingRule) => {
      for (let i = list.length - 1; i >= 0; i--) {
        const rule = list[i];
        if (rule instanceof CSSStyleRule && rule.selectorText.includes("data-nb-style"))
          owner.deleteRule(i);
        else if (rule instanceof CSSGroupingRule) strip(rule.cssRules, rule);
      }
    };
    const sheet = document.styleSheets[0] as CSSStyleSheet;
    strip(sheet.cssRules, sheet);
    return [...sheet.cssRules].map((r) => r.cssText).join("\n");
  });
}

let server: Server;
let origin = "";
const variants: Record<string, { css: string; bodyClass: string }> = {};

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  variants["without styles"] = { css: await withoutStyles(page), bodyClass: "" };
  await page.close();
  variants["with styles"] = { css, bodyClass: "" };
  variants["with styles, g-morph applied"] = { css, bodyClass: "g-morph" };
  server = createServer((req, res) => {
    const [path, query] = (req.url ?? "/").split("?");
    const variant = variants[decodeURIComponent(query ?? "")];
    if (!variant) return res.writeHead(404).end();
    if (path === "/newbrush.css")
      return res.writeHead(200, { "content-type": "text/css" }).end(variant.css);
    const html = showcase
      .replace('href="/newbrush.css"', `href="/newbrush.css?${encodeURIComponent(query ?? "")}"`)
      .replace("<body>", `<body class="${variant.bodyClass}">`);
    res.writeHead(200, { "content-type": "text/html" }).end(html);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test.afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

/** First contentful paint and cumulative layout shift of one cold, throttled load. */
async function measure(page: Page, variant: string): Promise<{ fcp: number; cls: number }> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.goto(`${origin}/?${encodeURIComponent(variant)}`, { waitUntil: "load" });
  const result = await page.evaluate(
    () =>
      new Promise<{ fcp: number; cls: number }>((resolve) => {
        let cls = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as (PerformanceEntry & {
            value: number;
            hadRecentInput: boolean;
          })[])
            if (!entry.hadRecentInput) cls += entry.value;
        }).observe({ type: "layout-shift", buffered: true });
        // Let late shifts land before reading.
        setTimeout(() => {
          const fcp =
            performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? Number.NaN;
          resolve({ fcp, cls });
        }, 500);
      }),
  );
  await cdp.detach();
  return result;
}

test("bundling the design styles costs ≤ 50 ms FCP and causes no layout shift", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const results: Record<string, { fcp: number[]; cls: number[] }> = {};
  // Interleave the variants so drift on the machine affects them equally.
  for (let run = 0; run < RUNS; run++) {
    for (const name of Object.keys(variants)) {
      const context = await browser.newContext({
        viewport: { width: 412, height: 915 },
        deviceScaleFactor: 2,
      });
      const page = await context.newPage();
      const { fcp, cls } = await measure(page, name);
      await context.close();
      results[name] ??= { fcp: [], cls: [] };
      results[name].fcp.push(fcp);
      results[name].cls.push(cls);
    }
  }
  const summary = Object.fromEntries(
    Object.entries(results).map(([name, r]) => [
      name,
      { fcp: Math.round(median(r.fcp)), cls: Math.max(...r.cls) },
    ]),
  );
  test.info().annotations.push({ type: "performance", description: JSON.stringify(summary) });
  const base = summary["without styles"]?.fcp ?? 0;
  for (const [name, s] of Object.entries(summary)) {
    expect(Number.isFinite(s.fcp), `${name}: no FCP recorded`).toBe(true);
    expect(s.cls, `${name}: layout shift`).toBe(0);
    expect(
      s.fcp - base,
      `${name}: FCP ${s.fcp} ms vs ${base} ms without styles`,
    ).toBeLessThanOrEqual(50);
  }
});
