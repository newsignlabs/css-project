# Contract: MCP Tools, Resources & Prompts

Tool names and schemas are semver-protected public API. All tools are annotated
`{ readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false }`
and return both a text summary and `structuredContent` matching `outputSchema`.

Common types:

```ts
type Diagnostic = { code: string; severity: "error" | "warning" | "info"; message: string; class?: string; path?: string; suggestion?: string };
type ThemeRef  = { themeId: string } | { seeds: { brand?: string; accent?: string; neutral?: string }; overrides?: Record<string,string>; colorScheme?: "light" | "dark" | "both" } | { name: "light" | "dark" | "contrast" };
```

## Tools

### `generate_css`

> **Implemented (v0.x)**: `classes`, `html`, `theme: { seeds }`, `include`. Pending, additive: `theme` as `{ name }`
> or `{ themeId }` (with `create_theme`), `mode: "inline"`, `minify`. Schemas: `contracts/schemas/generate_css.*.json`.
> Tool errors carry the diagnostic in the text and in `_meta["newbrush/error"]` (clients validate `structuredContent`
> against the success schema).
```ts
in:  { classes?: string[]; html?: string; theme?: ThemeRef; include?: { preflight?: boolean; components?: boolean }; mode?: "css" | "inline"; minify?: boolean }
     // one of classes|html required; html ≤ 256 KB; classes ≤ 5000
out: { css: string; used: string[]; rejected: Diagnostic[]; unknown: { class: string; suggestions: string[] }[]; stats: { bytes: number; rules: number } }
```

### `search`

> **Implemented (v0.x)**: kinds `component`, `utility`, `token`, `style` (design styles, specs/004). `section` and
> `doc` are accepted and return nothing until blueprints (Phase 4) and docs resources exist.
```ts
in:  { query: string; kinds?: ("component" | "utility" | "token" | "section" | "doc")[]; limit?: number /* ≤ 25 */ }
out: { results: { kind: string; name: string; title: string; description: string; uri: string; score: number; example?: string }[] }
```

### `get_component`

> **Implemented (v0.x)**. Accepts `nb-` names and any case; unknown names give `NB_UNKNOWN_COMPONENT` with a
> `suggestion`.
```ts
in:  { name: string }
out: Component   // data-model.md (001) incl. anatomy, modifiers, states, a11y, examples
```

### `get_tokens`

> **Implemented (v0.x)**. `group` uses the docs' token groups (`color.text`, `space`…); unknown groups or themes give
> `NB_SCHEMA_INVALID` listing the valid ones.
```ts
in:  { group?: string; theme?: string; format?: "json" | "css" }
out: { tokens: { path: string; cssVar: string; type: string; value: string; description?: string }[]; css?: string }
```

### `compose_component`

> **Implemented (v0.x)**. Slots are keyed by anatomy part (`content` fills the root); parts nested in another part
> are written inside it. Unknown modifiers, sizes, parts and disallowed attributes are dropped with
> `NB_ANATOMY_INVALID` diagnostics.
```ts
in:  { name: string; modifiers?: string[]; size?: string; slots?: Record<string, string | { href: string; text: string } | { src: string; alt: string }>; attrs?: Record<string,string>; theme?: ThemeRef; withCss?: boolean }
out: { html: string; css?: string; diagnostics: Diagnostic[] }
```

### `build_page`

> **Implemented (v0.x)**: every `BlueprintName` below (hero: centered, split, image-bg, product, minimal; table-view
> adds a striped variant); `theme: { seeds?, colorScheme? }`, `style` (specs/004), `lang`, `dir`, `output`. Pending,
> additive: `minify`.
> Schema errors name the field (`sections[2].props.tiers`); `props` and `slots` are merged.
```ts
in:  {
  title: string; lang?: string /* "en" */; dir?: "ltr" | "rtl"; description?: string;
  theme?: ThemeRef;
  sections: { type: BlueprintName; variant?: string; props?: Record<string, unknown>; slots?: Record<string, unknown> }[]; // 1..30
  output?: "document" | "fragments"; minify?: boolean
}
out: { html: string; css: string; sections: { type: string; id: string }[]; stats: { cssBytes: number; htmlBytes: number }; diagnostics: Diagnostic[] }
```
`BlueprintName` = navbar | hero | logo-cloud | feature-grid | feature-split | stats | pricing | testimonial | faq | cta |
blog-list | contact-form | footer | dashboard-shell | sidebar-layout | auth-form | table-view | empty-state | not-found.

### `create_theme`

> **Implemented (v0.x)**, plus `level` (seed palettes always meet AA, so adjustments show at AAA). `themeId` is
> `nbt_<name>_<64-bit FNV-1a of the spec>`; the stdio server keeps the last 100 themes for its session (HTTP sessions
> with Phase 6), and `{ themeId, seeds }` falls back to the seeds when the id is unknown. `strict` failures give
> `NB_CONTRAST_FAIL`. Not read-only (it stores the theme), but idempotent.
```ts
in:  { name: string; seeds: { brand: string; accent?: string; neutral?: string }; colorScheme?: "light" | "dark" | "both"; radius?: "sharp" | "default" | "round"; density?: "compact" | "default" | "comfortable"; font?: "system" | "humanist" | "geometric" | "serif" | "mono"; level?: "AA" | "AAA"; strict?: boolean }
out: { themeId: string; css: string; tokens: Record<string,string>; contrast: { pair: string; ratio: number; apca: number; pass: boolean; adjusted?: boolean }[] }
```
`themeId` is a content hash (deterministic) and is resolvable in the same HTTP session or by re-sending the spec.

### `validate_markup`

> **Implemented (v0.x)**. Parses with parse5; each diagnostic's `path` is `L<line>:C<column> <tag>`. Errors: invalid
> utilities, parts outside their component and modifiers without their root (`NB_ANATOMY_INVALID`), `NB_MISSING_ALT`,
> `NB_MISSING_NAME`, `NB_MISSING_LABEL`, `NB_DUPLICATE_ID`, `NB_UNSAFE_URL`. Warnings: unknown classes (with
> suggestions), `NB_MISSING_LANG`, `NB_HEADING_ORDER`, and `NB_CONTRAST_FAIL` for text/background colour utilities
> (light and dark values; no guess inside components, which set their own colours). Every `build_page` output passes.
```ts
in:  { html: string; level?: "AA" | "AAA" }
out: { valid: boolean; diagnostics: Diagnostic[]; summary: { errors: number; warnings: number } }
```

### `explain_class`

> **Implemented (v0.x)** as below. Schemas: `contracts/schemas/explain_class.*.json`.
```ts
in:  { classes: string[] /* ≤ 50 */ }
out: { results: ({ class: string; parsed: ParsedClass; family: string; css: string; docs: string } | Diagnostic)[] }
```

### `convert_markup`
```ts
in:  { html: string; from: "tailwind" | "bootstrap" }
out: { html: string; mapped: number; unmapped: { class: string; reason: string }[] }
```

## Error codes

`NB_INPUT_TOO_LARGE`, `NB_SCHEMA_INVALID`, `NB_UNKNOWN_COMPONENT`, `NB_UNKNOWN_SECTION`, `NB_ARBITRARY_REJECTED`,
`NB_UNSAFE_URL`, `NB_MISSING_ALT`, `NB_CONTRAST_FAIL`, `NB_ANATOMY_INVALID`, `NB_RATE_LIMITED` (HTTP only); from
`validate_markup` also `NB_UNKNOWN_CLASS`, `NB_MISSING_NAME`, `NB_MISSING_LABEL`, `NB_DUPLICATE_ID`, `NB_MISSING_LANG`,
`NB_HEADING_ORDER`.

## Resources

| URI | MIME | Content |
| --- | ---- | ------- |
| `newbrush://manifest` | application/json | Full manifest (001 data-model) |
| `newbrush://components/{name}` | application/json | Component |
| `newbrush://utilities/{family}` | application/json | UtilityFamily |
| `newbrush://tokens/{group}` | application/json | Resolved tokens |
| `newbrush://themes/{name}` | text/css | Theme CSS |
| `newbrush://styles/{name}` | application/json | Design style (specs/004) |
| `newbrush://sections/{name}` | application/json | Blueprint: props, slots, variants, example PageSpec fragment |
| `newbrush://docs/{slug}` | text/markdown | Docs page |

Resource templates are listed via `resources/templates/list`; `{name}` completions supported.
**Implemented (v0.x)**: manifest, components, utilities, tokens, themes, styles. `sections` arrives with blueprints
(Phase 4), `docs` with bundled docs pages.

## Prompts

| Name | Arguments | Purpose |
| ---- | --------- | ------- |
| `design_landing_page` | `product`, `audience`, `brandColor?`, `tone?` | Guides the client to produce a PageSpec and call `build_page` |
| `restyle_with_brand` | `html`, `brandColor` | create_theme → generate_css with theme |
| `convert_from_tailwind` | `html` | convert_markup → validate_markup |
| `build_dashboard` | `entities`, `metrics` | dashboard-shell + stats + table-view PageSpec |

Each prompt ships with the tools it uses: `restyle_with_brand` (create_theme → validate_markup → generate_css with
`{ themeId }`), `design_landing_page` and `build_dashboard` with `build_page`, `convert_from_tailwind` with
`convert_markup`.

## Transports & endpoints

```text
stdio:  npx -y @newbrush/mcp                          (default)
http:   npx -y @newbrush/mcp --transport http --port 3333
        POST/GET /mcp           Streamable HTTP (MCP)
        POST /v1/tools/{name}   REST mirror (same schemas)
        GET  /v1/manifest       manifest JSON
        GET  /healthz
```

## Client configuration examples

```jsonc
// Claude Desktop / generic mcpServers config
{ "mcpServers": { "newbrush": { "command": "npx", "args": ["-y", "@newbrush/mcp"] } } }
```
```bash
claude mcp add newbrush -- npx -y @newbrush/mcp
claude mcp add --transport http newbrush https://mcp.newbrush.dev/mcp
```
