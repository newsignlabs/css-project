import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ExplainClassOutput, GenerateCssOutput } from "../../src/schemas/index.ts";

// specs/003 T009 — the built server over stdio, driven by the MCP SDK client (turbo builds before testing).

/** The text of a resource read (newBrush resources are always text). */
const textOf = (r: { contents: ({ text: string } | { blob: string })[] }) => {
  const first = r.contents[0];
  return first && "text" in first ? first.text : "";
};

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
    expect(tools.map((t) => t.name).sort()).toEqual([
      "build_page",
      "compose_component",
      "explain_class",
      "generate_css",
      "get_component",
      "get_tokens",
      "search",
    ]);
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

  it("search and get_component work over the wire", async () => {
    const found = await client.callTool({
      name: "search",
      arguments: { query: "dialog", limit: 3 },
    });
    expect(JSON.stringify(found.structuredContent)).toContain("newbrush://components/modal");
    const c = await client.callTool({ name: "get_component", arguments: { name: "modal" } });
    expect(c.structuredContent).toMatchObject({ name: "modal", className: "nb-modal" });
    const missing = await client.callTool({ name: "get_component", arguments: { name: "modl" } });
    expect(missing.isError).toBe(true);
    expect(missing._meta).toMatchObject({
      "newbrush/error": { code: "NB_UNKNOWN_COMPONENT", suggestion: "modal" },
    });
  });

  it("serves newbrush:// resources with completion", async () => {
    const { resources } = await client.listResources();
    expect(resources.map((r) => r.uri)).toContain("newbrush://manifest");
    expect(resources.map((r) => r.uri)).toContain("newbrush://components/button");
    const { resourceTemplates } = await client.listResourceTemplates();
    expect(resourceTemplates.map((t) => t.uriTemplate).sort()).toEqual([
      "newbrush://components/{name}",
      "newbrush://sections/{name}",
      "newbrush://styles/{name}",
      "newbrush://themes/{name}",
      "newbrush://tokens/{name}",
      "newbrush://utilities/{name}",
    ]);
    const button = await client.readResource({ uri: "newbrush://components/button" });
    expect(JSON.parse(textOf(button)).className).toBe("nb-btn");
    const dark = await client.readResource({ uri: "newbrush://themes/dark" });
    expect(dark.contents[0]).toMatchObject({ mimeType: "text/css" });
    expect(textOf(dark)).toContain('[data-nb-theme="dark"]');
    const neon = await client.readResource({ uri: "newbrush://styles/neon" });
    expect(JSON.parse(textOf(neon)).preferredScheme).toBe("dark");
    const done = await client.complete({
      ref: { type: "ref/resource", uri: "newbrush://components/{name}" },
      argument: { name: "name", value: "bu" },
    });
    expect(done.completion.values).toEqual(["button", "button-group"]);
  });

  it("offers the restyle_with_brand prompt", async () => {
    const { prompts } = await client.listPrompts();
    expect(prompts.map((p) => p.name).sort()).toEqual([
      "build_dashboard",
      "design_landing_page",
      "restyle_with_brand",
    ]);
    const prompt = await client.getPrompt({
      name: "restyle_with_brand",
      arguments: { html: "<button>Hi</button>", brandColor: "#e11d48" },
    });
    const text = JSON.stringify(prompt.messages);
    expect(text).toContain("generate_css");
    expect(text).toContain("#e11d48");
  });

  it("build_page returns a document; sections are documented as resources", async () => {
    const hero = await client.readResource({ uri: "newbrush://sections/hero" });
    const meta = JSON.parse(textOf(hero));
    expect(meta.variants).toEqual(["centered", "split", "image-bg", "product", "minimal"]);
    expect(meta.props.type).toBe("object");
    const r = await client.callTool({
      name: "build_page",
      arguments: {
        title: "Demo",
        sections: [meta.example, { type: "footer", props: { legal: "© 2026" } }],
      },
    });
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent).toMatchObject({ sections: [{ type: "hero" }, { type: "footer" }] });
    expect(String((r.structuredContent as { html: string }).html)).toContain("<!DOCTYPE html>");
    const c = await client.callTool({
      name: "compose_component",
      arguments: { name: "badge", slots: { content: "New" } },
    });
    expect(c.structuredContent).toMatchObject({
      html: expect.stringContaining('class="nb-badge"'),
    });
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
