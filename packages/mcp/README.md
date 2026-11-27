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

## Over HTTP

```bash
npx -y @newbrush/mcp --transport http --port 3333              # http://127.0.0.1:3333/mcp
NEWBRUSH_MCP_API_KEYS=key1,key2 npx -y @newbrush/mcp --transport http --host 0.0.0.0
claude mcp add --transport http newbrush http://127.0.0.1:3333/mcp
```

| Endpoint | What |
| -------- | ---- |
| `POST/GET/DELETE /mcp` | Streamable HTTP MCP. Each session has its own server and themes (`create_theme` ids); idle sessions close after 30 minutes |
| `POST /v1/tools/{name}` | REST mirror: the tool's arguments as the JSON body → `{ "result": … }` (the MCP `structuredContent`), or `{ "error": Diagnostic }` with 400 |
| `GET /v1/tools`, `GET /v1/manifest` | Tool names; the newBrush manifest |
| `GET /healthz` | `{ "ok": true, "version": … }`, never authenticated |

```bash
curl -s localhost:3333/v1/tools/explain_class -H 'content-type: application/json' -d '{"classes":["md:p-4"]}'
```

- **Auth**: with `NEWBRUSH_MCP_API_KEYS` set, send `Authorization: Bearer <key>` or `X-API-Key` (else 401).
- **Rate limit**: `NEWBRUSH_MCP_RATE_LIMIT` requests a minute per key, or per client address without keys (default
  120, `0` turns it off); over it, 429 `NB_RATE_LIMITED` with `Retry-After`.
- **CORS**: `NEWBRUSH_MCP_CORS_ORIGINS` (default `*`); `Mcp-Session-Id` is exposed to browsers.
- Bodies are limited to 1 MB (413 `NB_INPUT_TOO_LARGE`). Logs carry method, route, status and duration only: no
  bodies, keys or addresses.
- `@newbrush/mcp/http` exports `createHttpApp(options)`, a fetch handler (`app.fetch`) for any runtime.

## Tools

Every tool is idempotent and closed-world, and all but `create_theme` (which remembers its theme for the session) are
read-only, with JSON Schemas for input and output (published in
`specs/003-mcp-css-tool/contracts/schemas/`). Results come as a text summary plus `structuredContent`.

| Tool | Input | Output |
| ---- | ----- | ------ |
| `generate_css` | `classes` or `html` (≤ 256 KB, ≤ 5000 classes); optional `theme` (`themeId` from `create_theme`, or `seeds`: brand, accent, neutral); `include.preflight` (newBrush core) or `include.components` (full stylesheet) | `css`, `used`, `rejected` diagnostics, `unknown` classes with suggestions, `stats` |
| `explain_class` | `classes` (≤ 50) | per class: parsed variants and value, family, CSS and a docs link, or a diagnostic |
| `search` | `query` (meaning, synonyms understood: "dropdown", "pricing table", "cyberpunk"); optional `kinds`, `limit` (≤ 25) | ranked components, utilities, tokens and design styles, each with its `newbrush://` resource |
| `get_component` | `name` | the component: part classes, modifiers, sizes, states, accessibility, keyboard, tokens, examples |
| `build_page` | `title`, `sections` (1–30, each with `type`, `variant` and `props`; 19 section types, below), optional `theme` (`themeId` or `seeds`, `colorScheme`), `style`, `lang`, `dir`, `output` ("document" or "fragments") | an accessible HTML document (or fragments) with the minimal CSS, section ids, sizes and diagnostics |
| `compose_component` | `name`, optional `modifiers`, `size`, `slots` (content per part), `attrs`, `withCss` | one component's HTML from its anatomy, with diagnostics |
| `create_theme` | `name`, `seeds` (`brand`, optional `accent`, `neutral`); optional `colorScheme`, `radius` (sharp, default, round), `density` (compact, default, comfortable), `font` (system, humanist, geometric, serif, mono), `level` (AA, AAA), `strict` | `themeId` for `generate_css` and `build_page` in this session, token `css` for light, dark and high-contrast, `tokens`, and a WCAG/APCA `contrast` report; failing colours are adjusted unless `strict` |
| `validate_markup` | `html` (≤ 256 KB, a document or a fragment); optional `level` (AA, AAA) | `valid`, `diagnostics` with line and column (unknown or invalid classes, component anatomy, alt text, accessible names, form labels, duplicate ids, unsafe URLs, language, heading order, colour-utility contrast), `summary` |
| `convert_markup` | `html` (≤ 256 KB), `from` ("tailwind" or "bootstrap") | the same markup with newBrush classes (only class attributes change), `mapped` count, and `unmapped` classes with what to do instead |
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
| `newbrush://sections/{name}` | one `build_page` section: variants, props as JSON Schema and an example to copy |

Every template completes `{name}`. Prompts: `design_landing_page` (`product`, `audience`, `brandColor`, `tone`) plans
sections and calls `build_page`; `build_dashboard` (`entities`, `metrics`) assembles a dashboard; `restyle_with_brand` (`html`, `brandColor`) replaces ad-hoc classes with newBrush
components, makes a brand theme with `create_theme`, checks the result with `validate_markup` and generates the CSS; `convert_from_tailwind` (`html`) runs `convert_markup`,
resolves what it left out, validates and generates the CSS.

## Sections

| Section | Variants |
| ------- | -------- |
| navbar | default, sticky |
| dashboard-shell | default |
| hero | centered, split, image-bg, product, minimal |
| logo-cloud | default |
| feature-grid | cards, plain |
| feature-split | image-end, image-start |
| stats | default, cards |
| pricing | default |
| testimonial | single, grid |
| faq | default |
| blog-list | cards, list |
| contact-form | default |
| auth-form | sign-in, sign-up |
| sidebar-layout | default |
| table-view | default, striped |
| empty-state | default |
| not-found | default |
| cta | default, banded |
| footer | simple, columns |

`newbrush://sections/{name}` documents each section's props (JSON Schema) with an example to copy.

## Pages are safe and accessible by construction

Every text slot is escaped, rich text keeps only `<strong> <em> <b> <i> <code> <br> <a href>`, and every URL passes an
allow-list (unsafe ones become `#` with an `NB_UNSAFE_URL` warning). Pages get one `h1`, landmarks, labelled sections
and a skip link. Tests fuzz every slot of every blueprint (10 000 pages), validate every blueprint and variant with
html-validate, run axe (WCAG 2.2 AA) on every blueprint × variant in light and dark and on a landing page and a dashboard in
every design style, and keep a 6-section page's CSS under 15 KB brotli.

Errors are tool errors (`isError`) whose text and `_meta["newbrush/error"]` carry a diagnostic with a stable code:
`NB_SCHEMA_INVALID` (with the `path` of the field), `NB_INPUT_TOO_LARGE`, `NB_UNKNOWN_COMPONENT` and `NB_UNKNOWN_SECTION`
(with a `suggestion`). Per-class problems (`NB_ARBITRARY_REJECTED`, `NB_UNKNOWN_CLASS`,
`NB_UNKNOWN_VARIANT`) are reported in the results instead.

More follows the plan in `specs/003-mcp-css-tool`: themes, validation and conversion, and a hosted HTTP endpoint.

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
