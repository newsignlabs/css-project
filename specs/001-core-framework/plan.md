# Implementation Plan: newBrush Core Framework

**Branch**: `001-core-framework` | **Date**: 2026-10-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-core-framework/spec.md`

## Summary

Build a hybrid (components + utilities) CSS framework on native modern CSS. DTCG design tokens are compiled by
Style Dictionary into layered custom properties and themes; hand-authored component CSS consumes only tokens;
a TypeScript utility engine generates atomic classes on demand (JIT) or as a curated prebuilt preset; Lightning CSS
bundles, lowers and minifies. Every build emits a `manifest.json` that drives docs, types and the MCP server.

## Technical Context

**Language/Version**: TypeScript 5.6+ (strict), CSS (Baseline widely available), Node.js ≥ 20
**Primary Dependencies**: Lightning CSS, Style Dictionary v4, culori, fast-glob, @parcel/watcher, tsup, Astro + Starlight (docs)
**Storage**: N/A (file outputs: `dist/*.css`, `manifest.json`, `.d.ts`)
**Testing**: Vitest, Playwright (+ visual snapshots), @axe-core/playwright, Stylelint, size-limit, publint
**Target Platform**: Browsers per `.browserslistrc`; tooling on Node 20/22/24 (Linux, macOS, Windows)
**Project Type**: Monorepo of libraries + docs site
**Performance Goals**: JIT p95 < 50 ms incremental, < 1 s cold for 1k files; budgets per constitution §VI
**Constraints**: No runtime JS required; deterministic output; all CSS in `nb.*` layers; logical properties only
**Scale/Scope**: ~60 components, ~120 utility families, ~400 tokens, 3 built-in themes

## Constitution Check

| Principle | Status | Notes |
| --------- | ------ | ----- |
| I. Platform-Native CSS First | ✅ | Native CSS + Lightning CSS lowering only |
| II. Tokens Single Source | ✅ | DTCG → SD v4 → CSS/TS/JSON/Figma; Stylelint bans raw values |
| III. Zero-JS by Default | ✅ | dialog/popover/details; `@newbrush/js` optional |
| IV. Accessibility Gate | ✅ | Build-time contrast check + axe on every manifest example |
| V. Test-First, Visually Verified | ✅ | Engine TDD; Playwright snapshots ×3 engines ×2 themes ×3 widths |
| VI. Performance Budgets | ✅ | size-limit in CI |
| VII. Deterministic Output | ✅ | Stable sort by layer → variant order → family order → class |
| VIII. SemVer | ✅ | Manifest diff tool flags breaking changes |
| IX. Secure | ✅ | Arbitrary-value grammar allow-list |
| X. Simplicity | ⚠️ | Hybrid scope is large → mitigated by phased delivery (MVP = US1+US2) |

## Project Structure

### Documentation (this feature)

```text
specs/001-core-framework/
├── spec.md  plan.md  research.md  data-model.md  quickstart.md  tasks.md
└── contracts/
    ├── class-grammar.md
    ├── config.schema.json
    └── engine-api.md
```

### Source Code (repository root)

```text
newbrush/
├── package.json  pnpm-workspace.yaml  turbo.json  .browserslistrc  biome.json  .stylelintrc.json
├── .changeset/
├── packages/
│   ├── tokens/                # @newbrush/tokens   – DTCG sources + SD build (css, ts, json, figma)
│   │   └── src/{primitive,semantic,component,themes}/*.json
│   ├── schema/                # @newbrush/schema   – TS types + JSON Schemas (config, manifest, component)
│   ├── engine/                # @newbrush/engine   – parser, registry, variants, generator, scanner (browser-safe core)
│   │   └── src/{parser,registry,variants,families,generate,scan,validate,sort,print}/
│   ├── css/                   # newbrush           – the framework package (main npm entry)
│   │   ├── src/
│   │   │   ├── index.css      # @layer order + imports
│   │   │   ├── reset/  base/  layout/  components/<name>/{<name>.css,<name>.meta.ts}  effects/  print/
│   │   ├── scripts/build.ts   # tokens → components → utilities preset → lightningcss → dist + manifest
│   │   └── dist/              # newbrush.css, newbrush-core.css, newbrush-full.css, components/*.css, themes/*.css, manifest.json
│   ├── cli/                   # @newbrush/cli      – `nb init|build|watch|tokens|doctor|contrast`
│   ├── postcss/               # @newbrush/postcss  – PostCSS plugin (`@newbrush;` directive)
│   ├── vite/                  # @newbrush/vite     – Vite plugin (HMR)
│   ├── js/                    # @newbrush/js       – optional enhancements (≤ 6 KB)
│   ├── mcp/                   # @newbrush/mcp      – see feature 003
│   ├── fonts/                 # @newbrush/fonts    – opt-in variable fonts (FR-022)
│   └── stylelint-config/      # @newbrush/stylelint-config – rules for authors & contributors
├── apps/
│   ├── docs/                  # Astro + Starlight site, playground
│   └── visual-tests/          # Playwright harness rendering manifest examples
└── examples/{plain-html,cdn,vite-app,next-app,astro-app}/
```

**Structure Decision**: Monorepo; `newbrush` is the primary consumer package, depending on `@newbrush/tokens` and
`@newbrush/engine` at build time only (zero runtime deps for CSS consumers).

## Architecture

```text
 DTCG tokens ──► Style Dictionary ──► tokens.css (nb.tokens) ─┐
     │                                 themes/*.css          │
     │                                 tokens.ts / json      │
     ▼                                                        ▼
 component *.css + *.meta.ts ───────────────────────► Lightning CSS bundle ──► dist/*.css
     │                                                        ▲
 utility families (engine registry) ─► generate(candidates) ──┘
     │                                                        
     └──────────────► manifest.json  ◄── meta.ts + tokens + registry
                          │
              ┌───────────┼────────────┐
            docs       d.ts types    MCP server (003)
```

### Layer order (FR-006)

```css
@layer nb.reset, nb.tokens, nb.base, nb.layout, nb.components, nb.utilities;
```

### Output sort (Principle VII)

`layer → variant group (none, state, structural, relational, theme, container, media asc) → family order → class string`.

## Phases

### Phase 0 – Research ✅ → [research.md](./research.md)

### Phase 1 – Design & Contracts ✅ → [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

### Phase 2 – Task planning ✅ → [tasks.md](./tasks.md)

### Delivery milestones

| Milestone | Scope | Exit criteria |
| --------- | ----- | ------------- |
| M0 Foundations | Monorepo, CI, tokens pipeline, layer skeleton | `pnpm build` produces tokens.css + empty manifest; CI green |
| M1 MVP (US1) | Reset, base, layout primitives, 12 core components, light/dark | plain-html example passes visual + axe |
| M2 Engine (US2) | Parser, variants, ~120 families, JIT, CLI, PostCSS, Vite | vite-app example; perf SC-004 |
| M3 Theming (US3) | Seed scales, contrast checker, scoped themes, runtime re-tint | SC-005 |
| M4 Components (US4) | Remaining catalogue + `@newbrush/js` | full catalogue visual + axe |
| M5 Effects (US5) | Glass, gradients, motion, view/scroll transitions | reduced-motion tests |
| M6 Docs (US6) | Astro site, playground, search | SC-006 |
| → v1.0.0 | hand-off to feature 002 release pipeline | all SCs met |

## Risks & Mitigations

| Risk | Mitigation |
| ---- | ---------- |
| Anchor positioning / scroll-driven animations not Baseline in all engines | `@supports` gates; static fallbacks; documented as progressive |
| Engine perf vs. Tailwind's Rust core | Benchmark suite from M2; napi-rs extractor fallback (R-06) |
| Scope creep (60 components) | M1 ships 12; others gated by spec + use case (Principle X) |
| Class collisions with Tailwind/Bootstrap | Configurable prefix; `nb-` components by default |

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| Own utility engine instead of wrapping Tailwind | MCP in-process generation, manifest-driven registry, value allow-list security | Wrapping couples token model & roadmap to a third party and cannot expose our manifest contract |
| Hybrid components + utilities | Bootstrap-class drop-in UX *and* Tailwind-class composition are both core to the vision | Utilities-only loses zero-build users; components-only loses modern workflow |
