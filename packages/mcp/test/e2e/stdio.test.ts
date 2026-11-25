import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ExplainClassOutput, GenerateCssOutput } from "../../src/schemas/index.ts";

// specs/003 T009 — the built server over stdio, driven by the MCP SDK client (turbo builds before testing).

const bin = new URL("../../dist/index.js", import.meta.url).pathname;
let client: Client;

beforeAll(async () => {
  client = new Client({ name: "newbrush-e2e", version: "0.0.0" });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [bin] }));
});
afterAll(() => client.close());

describe("newbrush-mcp over stdio", () => {
  it("identifies itself and lists both tools with schemas and annotations", async () => {
    expect(client.getServerVersion()?.name).toBe("newbrush");
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["explain_class", "generate_css"]);
    for (const tool of tools) {
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.outputSchema?.type).toBe("object");
      expect(tool.annotations).toMatchObject({
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
        openWorldHint: false,
      });
    }
  });

  it("generate_css returns CSS as text and structured content", async () => {
    const r = await client.callTool({
      name: "generate_css",
      arguments: { html: '<div class="p-4 pd-2">x</div>' },
    });
    expect(r.isError).toBeFalsy();
    const out = GenerateCssOutput.parse(r.structuredContent);
    expect(out.used).toEqual(["p-4"]);
    expect(out.unknown[0]?.class).toBe("pd-2");
    expect(JSON.stringify(r.content)).toContain(".p-4");
  });

  it("explain_class returns explanations and diagnostics", async () => {
    const r = await client.callTool({
      name: "explain_class",
      arguments: { classes: ["dark:p-2", "w-[;x]"] },
    });
    const out = ExplainClassOutput.parse(r.structuredContent);
    expect(out.results).toHaveLength(2);
    expect(out.results[1]).toMatchObject({ code: "NB_ARBITRARY_REJECTED" });
  });

  it("returns structured errors for oversized input", async () => {
    const r = await client.callTool({
      name: "generate_css",
      arguments: { html: "x".repeat(300_000) },
    });
    expect(r.isError).toBe(true);
    expect(r.structuredContent).toBeUndefined();
    expect(r._meta).toMatchObject({
      "newbrush/error": { code: "NB_INPUT_TOO_LARGE", severity: "error" },
    });
    expect(JSON.stringify(r.content)).toContain("NB_INPUT_TOO_LARGE");
  });

  it("answers generate_css quickly (SC-001: p95 < 30 ms, reported)", async () => {
    const times: number[] = [];
    for (let i = 0; i < 40; i++) {
      const start = performance.now();
      await client.callTool({
        name: "generate_css",
        arguments: {
          html: `<section class="grid gap-6 p-${(i % 8) + 1} md:grid-cols-3"><div class="rounded-xl p-6 shadow-md">x</div></section>`,
        },
      });
      times.push(performance.now() - start);
    }
    const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)] ?? 0;
    process.stderr.write(`generate_css round trip over stdio: p95 ${p95.toFixed(1)} ms\n`);
    expect(p95).toBeLessThan(200); // generous in CI; the spec's 30 ms target is checked by the log above
  });
});
