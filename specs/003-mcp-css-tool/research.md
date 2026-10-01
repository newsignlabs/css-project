# Research: newBrush MCP Server (Phase 0)

## R-01 SDK & transports
- **Decision**: `@modelcontextprotocol/sdk` (TypeScript) `McpServer` with `StdioServerTransport` and `StreamableHTTPServerTransport`;
  zod schemas → JSON Schema for `inputSchema`/`outputSchema`.
- **Rationale**: Official, matches our TS stack; Streamable HTTP is the current remote transport (SSE deprecated).

## R-02 Hosting the remote server
- **Decision**: Primary: Cloudflare Workers (engine core is browser-safe → runs on Workers; Durable Objects for session theme cache).
  Secondary: Docker image (Node 22 alpine) for self-hosting on Fly.io/Render/k8s.
- **Alternatives**: Vercel functions (cold starts), AWS Lambda (fine, more ops).

## R-03 Determinism vs. "intelligence"
- **Decision**: The server is a deterministic compiler. All creative choices come in as structured `PageSpec`/`SectionSpec` from the client LLM.
  Prompts (`design_landing_page`, etc.) teach the client how to produce a good PageSpec, with the manifest as context.
- **Rationale**: Reproducible, testable, cheap, no API keys, no prompt-injection surface inside the server.

## R-04 HTML generation & safety
- **Decision**: Blueprints are typed template functions (tagged templates with auto-escaping, e.g. own `html\`\`` helper) — not string concat.
  Slots are `text` (escaped), `inline` (allow-listed inline tags: `strong em code a[href=https|mailto|relative] br span`), `url` (scheme allow-list), `image` (requires `alt`).
  Output post-validated with `parse5` and checked against an allow-list sanitizer as defence in depth.
- **Alternatives**: JSX server render (heavier dep), Handlebars (weaker typing).

## R-05 Search
- **Decision**: In-memory MiniSearch index built from manifest at startup (names, descriptions, tags, synonyms e.g. "dropdown↔menu", "modal↔dialog").
- **Alternatives**: Embeddings (non-deterministic across versions, larger package) — revisit as optional plugin.

## R-06 Validation in `validate_markup`
- **Decision**: parse5 tree walk: unknown classes via engine `parse`, anatomy rules from component meta (`requiredParent`, `requiredChildren`),
  a11y quick checks (alt, accessible name, heading order, label association, contrast via resolved tokens). Full axe is test-time only (needs DOM);
  optionally `linkedom` + axe in the Node build if bundle size allows.

## R-07 Conversion from Tailwind/Bootstrap
- **Decision**: Mapping tables generated from manifest + hand-curated overrides; Tailwind grammar is mostly 1:1, Bootstrap mapped to components (`btn btn-primary` → `nb-btn nb-btn--primary`).

## R-08 Distribution & discovery
- npm `@newbrush/mcp` with `bin: newbrush-mcp`; Docker `ghcr.io/newbrush/mcp`; `server.json` in the MCP Registry; one-click config snippets for Claude Desktop, Claude Code (`claude mcp add newbrush -- npx -y @newbrush/mcp`), VS Code, Cursor.

## R-09 Live preview (P3)
- MCP Apps (`ui://` resources) returning a sandboxed HTML preview of `build_page` output when the client advertises support; otherwise omit.

## R-10 Clarified (session 2026-10-01)
- Hosted endpoint is v1.0 scope. Free anonymous tier 60 req/min/IP; API keys for higher limits. Paid tiers out of scope for v1.0.
