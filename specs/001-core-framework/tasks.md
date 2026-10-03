# Tasks: newBrush Core Framework

**Input**: Design documents from `/specs/001-core-framework/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

Format: `[ID] [P?] [Story] Description` — `[P]` = parallelisable. Tests precede implementation (Constitution §V).

## Phase 1: Setup (M0)

- [x] T001 Initialise monorepo: root `package.json` (private, `packageManager: pnpm@9`), `pnpm-workspace.yaml` (`packages/*`, `apps/*`, `examples/*`), `turbo.json` pipelines (build, test, lint, typecheck, visual)
- [x] T002 [P] Add `.browserslistrc` (constitution matrix), `.editorconfig`, `.nvmrc` (20), `.gitignore`, MIT `LICENSE`
- [x] T003 [P] Configure Biome (`biome.json`) for TS/JSON; Husky + lint-staged pre-commit
- [x] T004 [P] Create `packages/stylelint-config` with rules: require layer, logical properties only, no raw color/length outside tokens, no `!important` in components
- [x] T005 [P] Shared `tsconfig.base.json` (strict, ESM, `moduleResolution: bundler`) and tsup preset
- [x] T006 [P] Initialise Changesets (`.changeset/config.json`, linked `@newbrush/*` versions)
- [x] T007 CI workflow `.github/workflows/ci.yml`: install (pnpm cache), lint, typecheck, unit, build, size, visual (matrix chromium/firefox/webkit), upload Playwright report
- [x] T008 [P] Add `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, issue/PR templates

## Phase 2: Foundational (blocking)

- [x] T009 Create `packages/schema`: TS types for Token, Theme, Variant, UtilityFamily, Component, Config, Manifest (data-model.md); JSON Schema export script; tests validating fixtures
- [x] T010 [P] Create `packages/tokens` with DTCG primitives: color (neutral, brand, accent, success, warning, danger, info), font, space, radius, shadow, motion, z, breakpoint, opacity, blur
- [x] T011 [P] Semantic tokens: surface/text/border/focus/accent + on-* pairs, with `nb.themes` dark & contrast overrides
- [x] T012 Style Dictionary v4 build (`packages/tokens/build.ts`): formats `css/variables-layered` (`@layer nb.tokens`), `css/themes` (`[data-nb-theme]` + media), `ts/module`, `json/resolved`, `figma/variables`
- [x] T013 Test: token snapshot + alias resolution + no-orphan-token check (`packages/tokens/test/*.test.ts`)
- [x] T014 Create `packages/css/src/index.css` with layer declaration and import skeleton; `scripts/build.ts` wiring tokens → Lightning CSS → `dist/`
- [x] T015 Create `apps/visual-tests` Playwright harness: renders every `examples[]` from manifest in a fixture page across themes (light/dark), widths (360/768/1280) and dir (ltr/rtl); axe scan per page with tags `wcag2a, wcag2aa, wcag21aa, wcag22aa` (enables `target-size`, constitution §IV)
- [x] T016 [P] `size-limit` configs with constitution budgets in `packages/css/.size-limit.json` (CSS bundles) and `packages/js/.size-limit.json` (`@newbrush/js` ≤ 6 KB); `play.js` size is reported but not gated (dev-only, outside constitution §VI) — *CSS budgets live; the `packages/js` config lands with T094/T075 when the package exists*

**Checkpoint**: `pnpm build` produces `tokens.css`, themes, empty manifest; CI green.

## Phase 3: User Story 1 – Drop-in stylesheet (P1) 🎯 MVP (M1)

### Tests first

- [x] T017 [P] [US1] Visual + axe specs for base typography/forms/tables page `apps/visual-tests/specs/base.spec.ts`, plus a target-size check asserting every interactive element in manifest examples is ≥ 24×24 CSS px (`target-size.spec.ts`)
- [x] T018 [P] [US1] Spec: unlayered consumer override beats component without `!important` (`layers.spec.ts`)
- [x] T019 [P] [US1] Spec: dark mode via media and via `data-nb-theme`, including nested islands (light-in-dark, dark-in-light-in-dark) where `dark:`/`light:` utilities follow the *nearest* theme (`theme-switch.spec.ts`, see class-grammar.md §Theme variants)

### Implementation

- [x] T020 [US1] Modern reset `src/reset/reset.css` (box-sizing, margin reset, media defaults, `text-size-adjust`, `interpolate-size`)
- [x] T021 [US1] Base `src/base/*.css`: fluid type scale, prose rhythm, links, lists, tables, code/kbd, forms baseline, focus-visible ring, selection, print
- [x] T022 [P] [US1] Layout primitives `src/layout/`: container, stack, cluster, grid, sidebar, switcher, center, cover, frame
- [x] T023 [P] [US1] Component meta format `*.meta.ts` + loader that validates against schema and feeds manifest
- [x] T024 [P] [US1] Component: button (+group, icon) with meta & examples
- [x] T025 [P] [US1] Component: card
- [x] T026 [P] [US1] Component: badge, chip
- [x] T027 [P] [US1] Component: alert
- [x] T028 [P] [US1] Components: input, textarea, select, checkbox, radio, switch, validation states
- [x] T029 [P] [US1] Component: navbar
- [x] T030 [P] [US1] Component: modal (`<dialog>`)
- [x] T031 [P] [US1] Component: accordion (`<details name>`)
- [x] T032 [P] [US1] Component: tabs (CSS `:has()` pattern)
- [x] T033 [P] [US1] Component: table styling
- [x] T034 [US1] Bundle outputs `newbrush-core.css`, `newbrush.css`, `components/*.css`, `themes/*.css`; manifest v1
- [x] T035 [US1] `examples/plain-html` showcasing all M1 components

**Checkpoint**: US1 independently shippable as `0.1.0-alpha`.

## Phase 4: User Story 2 – Utility engine (P1) (M2)

### Tests first

- [x] T036 [P] [US2] Parser tests from `contracts/class-grammar.md` table + fuzz tests (fast-check) for rejection of unsafe arbitrary values
- [x] T037 [P] [US2] Generator golden tests: input class list → expected CSS snapshot; determinism test (two runs byte-equal, shuffled input)
- [x] T038 [P] [US2] Extractor tests for html/jsx/vue/svelte/template-literal sources
- [x] T092 [P] [US2] CLI tests (`packages/cli/test/`): `init|build|watch|explain|doctor|contrast|tokens|theme create` — *`contrast` and `theme create` tests land with T062/T065 (US3)* against temp fixtures, asserting outputs and exit codes 0/1/2/3 per contracts/engine-api.md — must fail before T054
- [x] T093 [P] [US2] Plugin tests: PostCSS fixture (`@newbrush utilities;` / `@nb-apply` replacement, determinism) and Vite fixture (build output + HMR CSS update < 50 ms p95) — must fail before T055/T056
- [x] T039 [P] [US2] Benchmark harness (`packages/engine/bench`) for SC-004: incremental p95, 1 000-file and 10 000-file cold builds

### Implementation

- [x] T040 [US2] `engine/parser`: tokenizer + AST per EBNF
- [x] T041 [US2] `engine/variants`: registry with responsive, container, state, structural, relational (group/peer/has), theme (nearest-theme resolution per class-grammar.md §Theme variants), motion, direction, print, supports, arbitrary
- [x] T042 [US2] `engine/validate`: arbitrary-value grammars (length, color, image-safe, number, time, grid-template)
- [x] T043 [P] [US2] Families: layout (display, position, inset, z, overflow, container, columns, aspect)
- [x] T044 [P] [US2] Families: flex & grid (direction, wrap, grow/shrink, basis, grid-cols/rows, span, gap, place/justify/align)
- [x] T045 [P] [US2] Families: spacing (p*, m*, space-*, logical variants)
- [x] T046 [P] [US2] Families: sizing (w, h, min/max, size, inline/block)
- [x] T047 [P] [US2] Families: typography (font, text size/color, leading, tracking, weight, align, decoration, truncate, line-clamp, balance/pretty)
- [x] T048 [P] [US2] Families: color & background (bg, gradients, opacity modifier, color-mix)
- [x] T049 [P] [US2] Families: border, radius, outline, ring, divide
- [x] T050 [P] [US2] Families: effects (shadow, blur, backdrop, glass, mix-blend, filters)
- [x] T051 [P] [US2] Families: motion (transition, duration, ease, animate, view-transition-name), interactivity (cursor, select, scroll-snap, touch), a11y (sr-only, forced-color-adjust)
- [x] T052 [US2] `engine/sort` + `engine/print` (stable ordering, escaping) and `generate()` API
- [x] T053 [US2] `engine/scan` + incremental cache; `@nb-apply` directive
- [x] T054 [US2] `@newbrush/cli` commands: init, build, watch, explain, doctor (contracts/engine-api.md); `doctor` warns on unprefixed utilities next to Tailwind/Bootstrap (FR-009)
- [x] T055 [P] [US2] `@newbrush/postcss` plugin
- [x] T056 [P] [US2] `@newbrush/vite` plugin with HMR
- [x] T057 [US2] Curated prebuilt utility preset → `newbrush-full.css` (budget-checked)
- [x] T058 [US2] Emit TS class-name types + VS Code custom data (`dist/vscode.css-data.json`)
- [x] T059 [US2] `examples/vite-app`, `examples/next-app`, `examples/astro-app` — *vite-app builds in the workspace; next/astro are templates that install from npm once 0.1.0 is published*

**Checkpoint**: `0.2.0-alpha` with JIT engine.

## Phase 5: User Story 3 – Theming (P2) (M3)

- [ ] T060 [P] [US3] Tests: seed → 11-step OKLCH scale golden values; gamut mapping; contrast pairs
- [ ] T061 [US3] Scale generator (culori) + SD transform for `theme.seeds`
- [ ] T062 [US3] Contrast checker (WCAG 2 + APCA) with `error|warn|fix`; `nb contrast` command
- [ ] T063 [US3] Runtime re-tint via relative color syntax with `@supports` fallback
- [ ] T064 [US3] Scoped themes (`[data-nb-theme]` any scope) + high-contrast theme + `forced-colors` pass
- [ ] T065 [US3] `nb theme create` scaffold; brand theme example
- [ ] T091 [P] [US3] `packages/fonts` (`@newbrush/fonts`): subsetted variable WOFF2 + `@font-face` CSS per family, mapped to `font.family.*` tokens; docs page (FR-022)

## Phase 6: User Story 4 – Full component catalogue (P2) (M4)

> Once feature 004 S1 lands, every new component must ship recipes for each built-in design style (004 FR-009).

- [ ] T066 [P] [US4] Content: prose, code, kbd, blockquote, list-group, divider, avatar
- [ ] T067 [P] [US4] Actions: split button, FAB, link styles
- [ ] T068 [P] [US4] Forms: range, file, input-group, floating label, fieldset
- [ ] T069 [P] [US4] Navigation: sidebar/nav rail, breadcrumb, pagination, stepper, menu/dropdown (popover + anchor), command palette shell
- [ ] T070 [P] [US4] Feedback: toast, progress bar/ring, spinner, skeleton, empty state, tooltip
- [ ] T071 [P] [US4] Overlay: drawer/sheet, popover
- [ ] T072 [P] [US4] Data: stat/KPI, timeline, description list, data-table
- [ ] T073 [P] [US4] Marketing: hero, feature grid, pricing, testimonial, CTA band, footer, logo cloud
- [ ] T074 [US4] Container-query adaptation audit for all width-dependent components
- [ ] T094 [P] [US4] `@newbrush/js` tests first (`packages/js/test/`, Vitest + Playwright): ARIA tabs keyboard model, dialog focus return, toast queue ordering/live region, roving tabindex, dismissables, idempotent `initAll()`, SSR import safety — must fail before T075
- [ ] T075 [US4] `@newbrush/js`: tabs (ARIA), dialog focus return, toast queue, roving tabindex, dismissables; IIFE + ESM builds

## Phase 7: User Story 5 – Effects & motion (P3) (M5)

- [ ] T076 [P] [US5] Tests: reduced-motion removes animation; unsupported scroll-timeline keeps content visible
- [ ] T077 [US5] Motion tokens & keyframes (fade, slide, scale, spring-ish via `linear()`)
- [ ] T078 [US5] Effects: glass, gradient mesh, glow, noise texture, elevation layers
- [ ] T079 [US5] View-transition helpers and `nb-reveal` scroll-driven animations with `@supports` gates

## Phase 8: User Story 6 – Docs & playground (P2) (M6)

> Docs information architecture is grouped by design style — see specs/004-design-styles tasks T033–T036.

- [ ] T080 [US6] Scaffold `apps/docs` (Astro + Starlight), theme with newBrush itself
- [ ] T081 [US6] Manifest-driven page generator (components, utilities, tokens tables)
- [ ] T082 [P] [US6] Live example renderer + copy button + theme/dir/width toggles
- [ ] T083 [P] [US6] Browser playground (engine in web worker, sandboxed iframe, share via URL hash)
- [ ] T084 [P] [US6] Pagefind search; guides: getting started, CDN, bundlers, theming, migrating from Bootstrap/Tailwind, MCP
- [ ] T085 [US6] Lighthouse CI on docs (a11y & best-practices = 100)

## Phase 9: Polish & cross-cutting

- [ ] T086 Manifest diff tool (`scripts/manifest-diff.ts`) failing CI on unannounced breaking changes
- [ ] T087 [P] Performance pass vs. budgets; prune selectors
- [ ] T088 [P] RTL + print + forced-colors full visual sweep
- [ ] T089 Security review of arbitrary-value validator (fuzz 1M cases)
- [ ] T090 Run `/speckit.analyze`; resolve inconsistencies; tag `1.0.0-rc.1` → hand to feature 002

## Dependencies & Execution Order

- Phase 1 → Phase 2 → (US1 ∥ US2 engine core T036–T042) → US3 → US4 ∥ US5 → US6 → Polish.
- US2 families T043–T051 fully parallel. US1 components T024–T033 fully parallel after T023.
- Feature 003 (MCP) may start after T052 (`generate()` API) and T034 (manifest v1).
