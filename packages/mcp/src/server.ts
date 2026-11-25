// specs/003 T008 — the newBrush MCP server: registers every tool with input/output schemas and annotations.
// Transport-free: connect it to stdio (transports/stdio.ts) or any other MCP transport.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ToolError } from "./lib/errors.ts";
import { explainClass } from "./lib/explain-class.ts";
import { generateCss } from "./lib/generate-css.ts";
import { manifest, SERVER_NAME, SERVER_VERSION } from "./manifest.ts";
import {
  explainClassInput,
  explainClassOutput,
  generateCssInput,
  generateCssOutput,
} from "./schemas/index.ts";

/** Every newBrush tool only reads the bundled manifest and computes: no side effects, no network, same in → same out. */
const ANNOTATIONS = {
  readOnlyHint: true,
  idempotentHint: true,
  destructiveHint: false,
  openWorldHint: false,
} as const;

/** Runs a tool: a text summary plus structured content, or an MCP error result carrying the diagnostic. */
function run<T extends Record<string, unknown>>(
  compute: () => T,
  summarise: (result: T) => string,
): CallToolResult {
  try {
    const result = compute();
    return { content: [{ type: "text", text: summarise(result) }], structuredContent: result };
  } catch (error) {
    if (!(error instanceof ToolError)) throw error;
    const d = error.diagnostic;
    // Not structuredContent: clients validate that against the tool's (success) output schema.
    return {
      isError: true,
      content: [{ type: "text", text: `${d.code}: ${d.message}\n${JSON.stringify({ error: d })}` }],
      _meta: { "newbrush/error": d },
    };
  }
}

export function createServer(): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, title: "newBrush", version: SERVER_VERSION },
    {
      instructions: [
        `newBrush ${manifest.version} is a CSS framework: components are plain classes (nb-btn, nb-card),`,
        "utilities are generated on demand (p-4, md:grid-cols-2), and one class (neon, g-morph…) switches design style.",
        "Use generate_css for the CSS of some markup and explain_class to see how a class is read.",
      ].join(" "),
    },
  );

  server.registerTool(
    "generate_css",
    {
      title: "Generate newBrush CSS",
      description:
        "Generate the newBrush utility CSS for class names or HTML. Reports rejected classes and suggests known classes for unknown ones. Optionally prepends the newBrush core or full stylesheet, and derives a palette from brand seed colours.",
      inputSchema: generateCssInput,
      outputSchema: generateCssOutput,
      annotations: { title: "Generate newBrush CSS", ...ANNOTATIONS },
    },
    (args) =>
      run(
        () => generateCss(args),
        (r) =>
          [
            `${r.used.length} utilities, ${r.stats.bytes} bytes.`,
            r.rejected.length
              ? `Rejected: ${r.rejected.map((d) => `${d.class} (${d.message})`).join("; ")}.`
              : "",
            r.unknown.length
              ? `Unknown: ${r.unknown.map((u) => (u.suggestions.length ? `${u.class} (did you mean ${u.suggestions.join(", ")}?)` : u.class)).join("; ")}.`
              : "",
            "```css",
            r.css,
            "```",
          ]
            .filter(Boolean)
            .join("\n"),
      ),
  );

  server.registerTool(
    "explain_class",
    {
      title: "Explain newBrush classes",
      description:
        "Explain how newBrush reads utility classes: variants, utility, value, the CSS each one produces, and a docs link. Invalid classes come back as diagnostics with the reason.",
      inputSchema: explainClassInput,
      outputSchema: explainClassOutput,
      annotations: { title: "Explain newBrush classes", ...ANNOTATIONS },
    },
    (args) =>
      run(
        () => explainClass(args),
        (r) =>
          r.results
            .map((x) =>
              "code" in x
                ? `${x.class ?? ""}: ${x.code} ${x.message}`
                : `${x.class} (${x.family}):\n${x.css}`,
            )
            .join("\n\n"),
      ),
  );

  return server;
}
