// specs/003 T008 — the newBrush MCP server: registers every tool with input/output schemas and annotations.
// Transport-free: connect it to stdio (transports/stdio.ts) or any other MCP transport.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { BLUEPRINT_NAMES } from "./blueprints/index.ts";
import { buildPage } from "./lib/build-page.ts";
import { composeComponent } from "./lib/compose-component.ts";
import { ToolError } from "./lib/errors.ts";
import { explainClass } from "./lib/explain-class.ts";
import { generateCss } from "./lib/generate-css.ts";
import { getComponent } from "./lib/get-component.ts";
import { getTokens } from "./lib/get-tokens.ts";
import { search } from "./lib/search.ts";
import { manifest, SERVER_NAME, SERVER_VERSION } from "./manifest.ts";
import { registerPrompts } from "./prompts/index.ts";
import { registerResources } from "./resources/index.ts";
import {
  buildPageInput,
  buildPageOutput,
  composeComponentInput,
  composeComponentOutput,
  explainClassInput,
  explainClassOutput,
  generateCssInput,
  generateCssOutput,
  getComponentInput,
  getComponentOutput,
  getTokensInput,
  getTokensOutput,
  searchInput,
  searchOutput,
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
        'Find things with search (by meaning: "pricing table", "dropdown", "cyberpunk"), read one with get_component',
        "or get_tokens, or browse newbrush:// resources. Use generate_css for the CSS of some markup and explain_class to",
        "see how a class is read. To make whole pages, call build_page with sections (newbrush://sections/{name} documents",
        "each blueprint's props); for one component, compose_component. Prefer components over long utility lists.",
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

  server.registerTool(
    "search",
    {
      title: "Search newBrush",
      description:
        'Search newBrush components, utilities, design tokens and design styles by meaning, e.g. "pricing table", "dropdown", "spacing", "cyberpunk". Synonyms are understood. Each result links its newbrush:// resource.',
      inputSchema: searchInput,
      outputSchema: searchOutput,
      annotations: { title: "Search newBrush", ...ANNOTATIONS },
    },
    (args) =>
      run(
        () => search(args),
        (r) =>
          r.results.length
            ? r.results.map((x) => `${x.kind} ${x.name}: ${x.description} (${x.uri})`).join("\n")
            : "No results.",
      ),
  );

  server.registerTool(
    "get_component",
    {
      title: "Get a newBrush component",
      description:
        "Get one newBrush component: classes for each part, modifiers, sizes, states, accessibility requirements, keyboard behaviour, tokens and example HTML.",
      inputSchema: getComponentInput,
      outputSchema: getComponentOutput,
      annotations: { title: "Get a newBrush component", ...ANNOTATIONS },
    },
    (args) =>
      run(
        () => getComponent(args),
        (c) =>
          [
            `${c.title} (.${c.className}): ${c.description}`,
            `Modifiers: ${c.modifiers.map((m) => m.className).join(", ") || "none"}`,
            `Accessibility: ${c.a11y.requirements.join(" ")}`,
            "```html",
            c.examples[0]?.html ?? "",
            "```",
          ].join("\n"),
      ),
  );

  server.registerTool(
    "get_tokens",
    {
      title: "Get newBrush design tokens",
      description:
        'Get newBrush design tokens (CSS custom properties), optionally one group ("color.text", "space", "radius"…) and one theme\'s values (light, dark, contrast); format "css" also returns a CSS block.',
      inputSchema: getTokensInput,
      outputSchema: getTokensOutput,
      annotations: { title: "Get newBrush design tokens", ...ANNOTATIONS },
    },
    (args) =>
      run(
        () => getTokens(args),
        (r) =>
          r.css ??
          r.tokens
            .map((t) => `${t.cssVar}: ${t.value}${t.description ? ` (${t.description})` : ""}`)
            .join("\n"),
      ),
  );

  const summary = (d: { severity: string; code: string; message: string; path?: string }[]) =>
    d.length
      ? `\nDiagnostics:\n${d.map((x) => `- ${x.severity} ${x.code}${x.path ? ` (${x.path})` : ""}: ${x.message}`).join("\n")}`
      : "";

  server.registerTool(
    "build_page",
    {
      title: "Build a newBrush page",
      description: `Build a complete, accessible HTML page from sections (${BLUEPRINT_NAMES.join(", ")}), with an optional brand theme, colour scheme and design style. Read newbrush://sections/{name} for each section's variants and props. Returns the document (or fragments) and the minimal CSS. Text is escaped; rich text allows <strong> <em> <code> <a> <br>.`,
      inputSchema: buildPageInput,
      outputSchema: buildPageOutput,
      annotations: { title: "Build a newBrush page", ...ANNOTATIONS },
    },
    (args) =>
      run(
        () => buildPage(args),
        (r) =>
          `Built ${r.sections.map((s) => s.type).join(", ")}: ${r.stats.htmlBytes} bytes of HTML, ${r.stats.cssBytes} bytes of CSS.${summary(r.diagnostics)}\n\n${r.html}`,
      ),
  );

  server.registerTool(
    "compose_component",
    {
      title: "Compose a newBrush component",
      description:
        'Write one newBrush component\'s HTML from its parts: modifiers, size, slot content per part (get_component lists them; "content" fills the root) and safe attributes. Optionally returns its CSS.',
      inputSchema: composeComponentInput,
      outputSchema: composeComponentOutput,
      annotations: { title: "Compose a newBrush component", ...ANNOTATIONS },
    },
    (args) =>
      run(
        () => composeComponent(args),
        (r) => `${r.html}${summary(r.diagnostics)}`,
      ),
  );

  registerResources(server);
  registerPrompts(server);
  return server;
}
