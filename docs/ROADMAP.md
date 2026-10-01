# newBrush Roadmap

Cross-feature sequencing of the three Spec Kit features. Week estimates assume 1–2 full-time contributors.

| Phase | Weeks | Feature work | Release |
| ----- | ----- | ------------ | ------- |
| Foundations | 1–2 | 001 Phase 1–2 (monorepo, CI, tokens, layers) · 002 D1 (package metadata, publint) | — |
| MVP stylesheet | 3–5 | 001 US1 (reset, base, layout, 12 components, light/dark) | `0.1.0-alpha` (`next`) |
| Engine | 6–9 | 001 US2 (parser, variants, families, CLI, PostCSS, Vite) · 002 D2 (Changesets, OIDC publish) | `0.2.0-alpha` |
| MCP alpha | 8–11 | 003 P0–P2 (`generate_css`, discovery, blueprints, `build_page`) | `@newbrush/mcp 0.1.0` |
| Theming + catalogue | 10–15 | 001 US3, US4 · 002 D3 (CDN, SRI, play.js) | `0.5.0-beta` |
| Effects + docs | 14–18 | 001 US5, US6 · 003 P3–P4 (theme, validate, convert, hosted HTTP) · 002 D4 | `1.0.0-rc.1` |
| Launch | 19–20 | 001 polish · 002 D5 + launch checklist · 003 P5 (registry, evals) | **`1.0.0`** |

## Post-1.0 candidates

- Figma UI kit synced from tokens (v1.1)
- `@newbrush/react`, `@newbrush/vue`, `@newbrush/svelte` thin typed wrappers
- Rust (napi-rs) extractor if engine perf demands
- Embedding-based semantic search plugin for the MCP server
- Theme marketplace / gallery on docs site
