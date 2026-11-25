# @newbrush/mcp

The newBrush [Model Context Protocol](https://modelcontextprotocol.io) server: tools that let AI agents write
newBrush CSS correctly. It reads only the bundled newBrush manifest and stylesheets. No network, no file writes, and
the same input always gives the same output.

## Use it

```jsonc
// Claude Desktop, Cursor, VS Code and other clients with an mcpServers config
{ "mcpServers": { "newbrush": { "command": "npx", "args": ["-y", "@newbrush/mcp"] } } }
```

```bash
claude mcp add newbrush -- npx -y @newbrush/mcp     # Claude Code
```

## Tools

Every tool is read-only, idempotent and closed-world, with JSON Schemas for input and output (published in
`specs/003-mcp-css-tool/contracts/schemas/`). Results come as a text summary plus `structuredContent`.

| Tool | Input | Output |
| ---- | ----- | ------ |
| `generate_css` | `classes` or `html` (≤ 256 KB, ≤ 5000 classes); optional `theme.seeds` (brand, accent, neutral); `include.preflight` (newBrush core) or `include.components` (full stylesheet) | `css`, `used`, `rejected` diagnostics, `unknown` classes with suggestions, `stats` |
| `explain_class` | `classes` (≤ 50) | per class: parsed variants and value, family, CSS and a docs link, or a diagnostic |
| `search` | `query` (meaning, synonyms understood: "dropdown", "pricing table", "cyberpunk"); optional `kinds`, `limit` (≤ 25) | ranked components, utilities, tokens and design styles, each with its `newbrush://` resource |
| `get_component` | `name` | the component: part classes, modifiers, sizes, states, accessibility, keyboard, tokens, examples |
| `get_tokens` | optional `group`, `theme` (light, dark, contrast), `format` ("css" adds a CSS block) | tokens with their values for that theme |

## Resources and prompts

| Resource | Content |
| -------- | ------- |
| `newbrush://manifest` | everything newBrush ships (JSON) |
| `newbrush://components/{name}` | one component (JSON) |
| `newbrush://utilities/{name}` | one utility family (JSON) |
| `newbrush://tokens/{name}` | one token group (JSON) |
| `newbrush://themes/{name}` | a theme's CSS: light, dark, contrast |
| `newbrush://styles/{name}` | one design style (JSON) |

Every template completes `{name}`. Prompt: `restyle_with_brand` (`html`, `brandColor`) walks the model through
replacing ad-hoc classes with newBrush components and generating the CSS in the brand colour.

Errors are tool errors (`isError`) whose text and `_meta["newbrush/error"]` carry a diagnostic with a stable code:
`NB_SCHEMA_INVALID`, `NB_INPUT_TOO_LARGE`, `NB_UNKNOWN_COMPONENT` (with a `suggestion`). Per-class problems (`NB_ARBITRARY_REJECTED`, `NB_UNKNOWN_CLASS`,
`NB_UNKNOWN_VARIANT`) are reported in the results instead.

More tools follow the plan in `specs/003-mcp-css-tool`: `build_page` with section blueprints, themes, validation and
conversion, and a hosted HTTP endpoint.

## As a library

```ts
import { explainClass, generateCss, search } from "@newbrush/mcp/lib";

generateCss({ html: '<div class="grid gap-6 md:grid-cols-3">…</div>' }).css;
```

`@newbrush/mcp` exports `createServer()` to connect the tools to any MCP transport.

## Develop

```bash
pnpm --filter @newbrush/mcp build
pnpm --filter @newbrush/mcp test       # unit, fuzz (10k cases), schema drift, stdio end-to-end
pnpm --filter @newbrush/mcp schemas    # rewrite the published JSON Schemas after changing src/schemas
```
