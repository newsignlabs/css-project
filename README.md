# newBrush

> A high-end, platform-native CSS framework: Bootstrap-grade components, Tailwind-grade utilities,
> token-driven themes — and an MCP server that lets AI agents build styled UIs on demand.

**Status**: 📐 Planning (Spec-Driven Development with [GitHub Spec Kit](https://github.com/github/spec-kit)). No code yet.

## Spec Kit layout

```text
.specify/
├── memory/constitution.md          # Non-negotiable principles (read first)
└── templates/                      # spec / plan / tasks templates
specs/
├── 001-core-framework/             # Tokens, themes, components, utility engine, docs
│   ├── spec.md  plan.md  research.md  data-model.md  quickstart.md  tasks.md
│   └── contracts/                  # class grammar, engine/CLI API, config JSON Schema
├── 002-distribution-release/       # npm, CDN (jsDelivr/unpkg/cdnjs), downloads, CI/CD
│   ├── spec.md  plan.md  research.md  tasks.md
│   └── contracts/cdn-urls.md
├── 003-mcp-css-tool/               # @newbrush/mcp — CSS/HTML generation tools for AI agents
│   ├── spec.md  plan.md  research.md  quickstart.md  tasks.md
│   └── contracts/mcp-tools.md
└── 004-design-styles/              # One class re-skins everything: minimal, glassy, neon, cyber, pixel
    ├── spec.md  plan.md  research.md  data-model.md  quickstart.md  tasks.md
    └── contracts/style-api.md
docs/ROADMAP.md                     # Cross-feature sequencing to v1.0
```

## Signature feature: design styles (planned — specs/004)

```html
<body class="glassy">   <!-- whole project is glassmorphism -->
<body class="neon">     <!-- same markup, now neon -->
```

Built-in styles: `minimal`, `glassy`, `neon`, `cyber`, `pixel` (plus the default). Styles compose with light/dark themes and
brand colors, work as islands on any element, and the docs are organised around them.

## Technology at a glance

| Concern | Choice |
| ------- | ------ |
| Styles | Native modern CSS (layers, nesting, container queries, `:has()`, OKLCH) |
| Build | Lightning CSS · Style Dictionary v4 (W3C DTCG tokens) · tsup |
| Utility engine | `@newbrush/engine` (TypeScript, JIT, Tailwind-compatible grammar) |
| Integrations | CLI (`nb`), PostCSS plugin, Vite plugin, optional `@newbrush/js` |
| Monorepo | pnpm workspaces · Turborepo · Changesets |
| Quality | Vitest · Playwright visual regression · axe-core · Stylelint · size-limit |
| Docs | Astro + Starlight · Pagefind · in-browser playground |
| Distribution | npm (OIDC provenance) · jsDelivr / unpkg / cdnjs · GitHub Releases ZIP + SBOM |
| AI | MCP server (`@newbrush/mcp`) over stdio + Streamable HTTP · REST mirror · Docker · Workers |

## Planned usage

```html
<!-- CDN (testing) -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/newbrush@1/dist/newbrush.min.css">
```
```bash
npm i newbrush                                  # npm
claude mcp add newbrush -- npx -y @newbrush/mcp # MCP
```

## Next steps

1. ~~`/speckit.clarify`~~ ✅ 2026-10-01 — `newbrush` + `@newbrush/*`, unprefixed utilities, system fonts + opt-in `@newbrush/fonts`, hosted MCP at v1.0, Figma kit v1.1. Still open: docs domain.
2. `/speckit.analyze` — cross-check specs, plans and tasks against the constitution.
3. `/speckit.implement` — start with `specs/001-core-framework/tasks.md` Phase 1.

## License

MIT (planned).
