# Tasks: newBrush MCP Server

**Input**: `/specs/003-mcp-css-tool/` · **Depends on**: 001 T052 (`generate()`), T034 (manifest v1)

## Phase 1: Setup (P0)

- [ ] T001 Scaffold `packages/mcp` (tsup, bin `newbrush-mcp`, exports `.`, `./lib`, `./http`), deps: @modelcontextprotocol/sdk, zod, parse5, minisearch, hono
- [ ] T002 [P] zod schemas for all tool inputs/outputs in `src/schemas/` + script exporting JSON Schema to `contracts/` (drift check in CI)
- [ ] T003 [P] Escaping tagged-template `html\`\`` helper, URL allow-list, inline-tag sanitizer in `src/html/` with unit + fuzz tests (fast-check, 10k cases)
- [ ] T004 Manifest loader (bundled JSON from `newbrush` package; version reported in server info)

## Phase 2: User Story 1 – generate_css (P1) 🎯

- [ ] T005 [P] [US1] Golden tests: html/classes → CSS; determinism; suggestions via Levenshtein over known classes; limits → `NB_INPUT_TOO_LARGE`
- [ ] T006 [US1] `lib/generate-css.ts` (extractCandidates → engine.generate → diagnostics)
- [ ] T007 [US1] `lib/explain-class.ts`
- [ ] T008 [US1] `server.ts` registering tools with annotations + `structuredContent`; `transports/stdio.ts`; `index.ts` CLI flags
- [ ] T009 [US1] Scripted e2e with MCP Inspector CLI / SDK client over stdio (`test/e2e/stdio.test.ts`)

## Phase 3: User Story 2 – Discovery (P1)

- [ ] T010 [P] [US2] Tests: search ranking fixtures ("pricing table", "dropdown" ↔ menu, "modal" ↔ dialog)
- [ ] T011 [US2] `search/` MiniSearch index + synonyms; `lib/search.ts`
- [ ] T012 [P] [US2] `lib/get-component.ts`, `lib/get-tokens.ts`
- [ ] T013 [US2] Resources + templates + completions (`resources/`)
- [ ] T014 [P] [US2] Prompts `design_landing_page`, `restyle_with_brand`, `convert_from_tailwind`, `build_dashboard`

## Phase 4: User Story 3 – Compose & build pages (P1)

### Tests first
- [ ] T015 [P] [US3] Blueprint test matrix: every blueprint × variant × theme(light/dark) rendered in Playwright → axe zero violations + html-validate clean
- [ ] T016 [P] [US3] XSS fuzz on all slot types; snapshot tests for `build_page` documents
- [ ] T017 [P] [US3] CSS budget test (6-section page ≤ 15 KB brotli)

### Implementation
- [ ] T018 [US3] Blueprint framework `blueprints/_core` (typed slots: text, inline, url, image, list, cta)
- [ ] T019 [P] [US3] Blueprints: navbar, hero (centered, split, image-bg, minimal, product), logo-cloud
- [ ] T020 [P] [US3] Blueprints: feature-grid, feature-split, stats, pricing, testimonial, faq, cta
- [ ] T021 [P] [US3] Blueprints: blog-list, contact-form, footer, auth-form, empty-state, not-found
- [ ] T022 [P] [US3] Blueprints: dashboard-shell, sidebar-layout, table-view
- [ ] T023 [US3] `lib/compose-component.ts` (from component meta anatomy)
- [ ] T024 [US3] `lib/build-page.ts` pipeline (plan.md) + document shell (meta viewport, color-scheme, lang/dir)
- [ ] T025 [US3] Section blueprint resources `newbrush://sections/{name}` with example PageSpec fragments

## Phase 5: User Stories 4 & 5 – Theming, validation, conversion (P2)

- [ ] T026 [P] [US4] Tests: theme determinism (content-hash `themeId`), contrast auto-fix report, `strict` mode errors
- [ ] T027 [US4] `lib/create-theme.ts` (reuses 001 seed generator + contrast checker); session LRU cache
- [ ] T028 [P] [US5] Tests: anatomy rule violations, a11y quick checks, Tailwind/Bootstrap conversion fixtures
- [ ] T029 [US5] `lib/validate-markup.ts` (parse5 walk + rules from component meta)
- [ ] T030 [US5] `convert/tailwind.ts`, `convert/bootstrap.ts` + `lib/convert-markup.ts`

## Phase 6: User Story 6 – Hosted & embeddable (P1)

- [ ] T031 [P] [US6] Tests: Streamable HTTP session lifecycle, REST mirror parity with MCP results, rate limit, CORS, auth
- [ ] T032 [US6] `transports/http.ts` (hono): `/mcp`, `/v1/tools/{name}`, `/v1/manifest`, `/healthz`; API-key/OAuth middleware; per-key rate limit; content-free logging
- [ ] T033 [US6] Cloudflare Workers entry (`worker/`), Durable Object theme cache, `wrangler.toml`; deploy workflow
- [ ] T034 [P] [US6] Dockerfile (distroless/alpine, non-root) + GHCR publish in release workflow
- [ ] T035 [P] [US6] `server.json` + MCP Registry publish step; docs page with Claude Desktop / Claude Code / VS Code / Cursor configs

## Phase 7: User Story 7 – Preview & evals (P3)

- [ ] T036 [US7] (FR-013) MCP Apps `ui://newbrush/preview` resource (sandboxed iframe of last build) when client supports it
- [ ] T037 Eval harness `test/evals/`: 50 NL website requests → LLM client → `build_page`; measure first-call validity (SC-003), track over releases
- [ ] T038 Latency benchmarks (SC-001) in CI

## Dependencies

Setup → US1 → (US2 ∥ US3 blueprints) → US3 build_page → US4/US5 → US6 → US7.
Release of `@newbrush/mcp` follows feature 002 pipeline (same Changesets linked group).
