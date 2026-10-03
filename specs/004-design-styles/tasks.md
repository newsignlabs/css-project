# Tasks: Design Styles

**Input**: `/specs/004-design-styles/` · **Depends on**: 001 US3 (themes, seed scales, contrast checker) · **Status**: planned, not started

Format: `[ID] [P?] [Story] Description` — tests precede implementation (constitution §V).

## Phase 1: Setup & foundations (S0)

- [ ] T001 Run `/speckit.clarify` on spec Q1–Q4 (naming, aliases, density scope, default packaging); record answers in spec.md
- [ ] T002 Constitution amendment PR: add `nb.styles` to the layer list (v1.1.0) with migration note
- [ ] T003 [P] `@newbrush/schema`: `Style` model, `Manifest.styles`, config `styles`/`customStyles`/`prefix.styles`, `LAYERS` + `nb.styles`; update drift checks (`newbrush/config` types)
- [ ] T004 [P] Update layer-order everywhere: engine hoisted statement, `newbrush` bundle prefix, layer tests in css/engine/vite
- [ ] T005 [P] `@newbrush/tokens`: emit `*-base` aliases for semantic tokens that styles derive from; snapshot update
- [ ] T006 Scaffold `packages/styles` (style.json schema validation, build.ts → `dist/<name>.css` + manifest entries)
- [ ] T007 Style marker + islands: `.<style>, [data-nb-style]` set `--nb-style`; `.style-default` reset; aliases

### Tests first (foundations)
- [ ] T008 [P] Visual regression guard: default-style snapshots must stay identical after S0
- [ ] T009 [P] Islands test: nearest style wins (minimal > neon > style-default nesting), attribute ≡ class, aliases work

## Phase 2: User Stories 1–3 — minimal & glassy (S1) 🎯 MVP

### Tests first
- [ ] T010 [P] [US1] Matrix spec `apps/visual-tests/specs/styles.spec.ts`: every manifest example × style × light/dark × 3 widths: axe (wcag22aa), target size, screenshot
- [ ] T011 [P] [US2] Contrast suite per style × scheme × brand seed (reuse tokens contrast test + 001 T062 checker)
- [ ] T012 [P] [US1] Runtime switch test: change body class → computed styles update, no layout shift (CLS = 0 bar density)

### Implementation
- [ ] T013 [US1] `minimal`: tokens (no elevation, hairline borders, small radius, reduced chroma, airy density) + recipes for navbar/card/button/input/table
- [ ] T014 [US1] `glassy`: translucent surface tokens, backdrop-filter recipes for card/navbar/modal/alert/input, ambient body backdrop, light-edge borders
- [ ] T015 [US2] Glassy fallbacks: `@supports not (backdrop-filter)`, `prefers-reduced-transparency`, forced-colors, print
- [ ] T016 [US1] Bundle styles into `newbrush.css`; publish `dist/styles/<name>.css`; size-limit entries (≤ 6 kB each)
- [ ] T017 [US1] Showcase: style switcher on `examples/plain-html` (generated) for manual review

## Phase 3: Expressive styles — neon, cyber, pixel (S2)

### Tests first
- [ ] T018 [P] [US2] Reduced-motion test: no animation on glitch/flicker/pulse/scanline drift; photosensitivity check (≤ 3 flashes/s)
- [ ] T019 [P] [US2] Forced-colors + contrast-theme test: decorative effects removed in every style
- [ ] T020 [P] [US2] Focus visibility test: focus indicator area/contrast ≥ default style under clip-path (cyber) and glow (neon)

### Implementation
- [ ] T021 [P] [US1] `neon`: dark-first palette + light variant, glow tokens (`--nb-glow`), outlined controls, glow focus ring, text glow for headings
- [ ] T022 [P] [US1] `cyber`: notched corners (`--nb-cut`, clip-path) with focus-ring workaround, mono/condensed type, uppercase labels, scanline overlay, glitch hover (motion-safe)
- [ ] T023 [P] [US1] `pixel`: radius 0, stepped borders, 4 px grid density, `steps()` motion tokens, pixelated images
- [ ] T024 [P] [US1] Pixel font in `@newbrush/fonts` (OFL), opt-in; fallback metrics to avoid layout shift
- [ ] T025 [US3] Island polish: dark-first style inside light page (and vice versa) renders correctly

## Phase 4: Utilities, config & tooling (S3)

- [ ] T026 [P] [US4] Engine tests: `glassy:`/`neon:`… variants resolve nearest style in both strategies; parse every known class × style variant with Lightning CSS
- [ ] T027 [US4] Engine: style variants registered from the manifest (built-ins + custom), sort order after theme variants
- [ ] T028 [US4] Config `styles: [...]` tree-shaking in CLI/PostCSS/Vite builds; `newbrush-full.css` preset adds common style variants
- [ ] T029 [P] [US7] CLI tests then `nb style list` / `nb style create <name> --from <style>`; `nb doctor` style warnings (multiple classes, unknown names, prefix collisions)
- [ ] T030 [P] [US7] Custom style pipeline: `customStyles` paths built and validated with the same contrast/a11y gates
- [ ] T031 [P] `@newbrush/js` `setStyle()/getStyle()` (View Transitions, persist, reduced-motion aware) + tests
- [ ] T032 Editor types: `NewBrushStyle` union and style variants in `classes.d.ts`; VS Code completions

## Phase 5: Docs grouped by style & MCP (S4)

- [ ] T033 [US5] Docs IA (research R-08): "Choose your style" in getting started; Styles section with comparison grid
- [ ] T034 [US5] Header style switcher re-skinning the docs site (persisted), live examples follow it
- [ ] T035 [P] [US5] Style page template generated from manifest: personality, snippet, full-page demo, component gallery, tokens changed, recipes, a11y notes, pairs-well-with
- [ ] T036 [P] [US5] Component pages: style tab strip previewing all styles with identical markup
- [ ] T037 [P] [US6] MCP: `list_styles`, `style` arg on `build_page`/`compose_component`/`generate_css`, resource `newbrush://styles/{name}`, `restyle` prompt, keyword search ("cyberpunk" → cyber)
- [ ] T038 [US6] MCP eval: 50 style-intent prompts → correct style on first `build_page` ≥ 90 % (SC-005)

## Phase 6: Polish

- [ ] T039 Visual CI sharding per style; baseline generation workflow per style
- [ ] T040 [P] User test for style distinctiveness (SC-003); refine weakest style
- [ ] T041 Run `/speckit.analyze` across 001/003/004; update ROADMAP

## Dependencies

001 US3 → S0 → S1 → (S2 ∥ S3) → S4. 001 US4 components require recipes for every built-in style once S1 lands (FR-009).
003 MCP tasks T037–T038 depend on 003 P2 (`build_page`).
