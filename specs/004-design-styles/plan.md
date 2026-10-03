# Implementation Plan: Design Styles

**Branch**: `004-design-styles` | **Date**: 2026-10-03 | **Spec**: [spec.md](./spec.md)

## Summary

Add switchable whole-project design styles (`minimal`, `glassy`, `neon`, `cyber`, `pixel`) activated by one class or
`data-nb-style` on any element. Each style = DTCG token overrides (light/dark) + small zero-specificity recipes in a new
`nb.styles` layer. Styles compose with themes and brand seeds, support islands, add `<style>:` utility variants, appear in
the manifest, drive a style-first docs IA, and are exposed to AI agents through the MCP server.

## Technical Context

**Builds on**: 001 Phase 1–2 (tokens, layers), US1 (components), US2 (engine), **US3 (themes, seed scales, contrast checker)**
**New package**: `@newbrush/styles` (sources + build) — compiled into `newbrush` at build time (no runtime dependency)
**Touches**: `@newbrush/schema` (Style, Manifest.styles, LAYERS, config), `@newbrush/tokens` (`*-base` aliases),
`@newbrush/engine` (style variants, layer order), `newbrush` (bundles, manifest, preset), `@newbrush/cli` (`nb style`),
`@newbrush/js` (`setStyle`), `apps/docs` (IA), `@newbrush/mcp` (tools/resources/prompt), `apps/visual-tests` (matrix)
**Testing**: contrast suite per style × scheme, axe + target size, Playwright snapshots per style, recipe lint, size-limit per style
**Constraints**: default style unchanged (snapshot-identical); zero JS; ≤ 6 kB brotli per style, ≤ 25 kB total

## Constitution Check

| Principle | Status | Notes |
| --------- | ------ | ----- |
| I. Platform-Native CSS | ⚠️ | New `nb.styles` layer → **constitution amendment** (MINOR 1.0.0 → 1.1.0) to the layer list |
| II. Tokens single source | ✅ | Styles are token overrides; recipes consume tokens only (Stylelint) |
| III. Zero-JS | ✅ | Class switch is pure CSS; `setStyle()` optional |
| IV. Accessibility gate | ✅ | Every style × theme in contrast + axe suites; effects removed under forced-colors/reduced motion/transparency |
| V. Test-first | ✅ | Matrix tests written before recipes |
| VI. Budgets | ✅ | Per-style size-limit entries |
| VII. Deterministic | ✅ | Styles emitted in manifest order |
| VIII. SemVer | ✅ | Style names, aliases, variables and variants are public API |
| IX. Secure | ✅ | Custom style recipes linted; MCP accepts style names from an allow-list only |
| X. Simplicity | ⚠️ | Visual matrix grows ×6 → mitigated by sharding visual CI per style |

## Project Structure

```text
packages/styles/                       # @newbrush/styles (build-time)
├── src/{minimal,glassy,neon,cyber,pixel}/{style.json,recipes.css,preview.html}
├── src/_shared/                       # shared recipe helpers (focus ring under clip-path, scanline overlay…)
├── build.ts                           # resolves DTCG overrides → per-style CSS + Style manifest entries
└── test/                              # contrast per style × scheme, recipe scoping, size
packages/css/src/styles/index.css      # imports built style CSS into newbrush.css
apps/visual-tests/specs/styles.spec.ts # every example × style × theme
apps/docs/src/content/styles/*.mdx     # style pages; header switcher component
```

## Architecture

```text
style.json (DTCG overrides) ─┐
                             ├─► styles build ─► dist/styles/<name>.css  (@layer nb.tokens + @layer nb.styles)
recipes.css (scoped) ────────┘                 └► Style entries ─► manifest.json ─► docs · MCP · editor types
engine: <style>: variants (nearest style via --nb-style) ─► utilities still in nb.utilities (last)
```

## Milestones

| Milestone | Scope | Exit criteria |
| --------- | ----- | ------------- |
| S0 Foundations | Amendment, `nb.styles` layer, schema, `*-base` tokens, styles package skeleton, style marker + islands | Default style snapshots unchanged; layer-order tests updated |
| S1 MVP styles | `minimal` + `glassy` across all US1 components | US1 + US3 scenarios pass; contrast + axe green |
| S2 Expressive styles | `neon`, `cyber`, `pixel` (+ opt-in pixel font) | All acceptance scenarios; reduced-motion/transparency/forced-colors tests |
| S3 Utilities & tooling | `<style>:` variants, config `styles`, `nb style list/create`, `setStyle()` | US4, US7 |
| S4 Docs & MCP | Style-first docs IA + switcher; MCP `list_styles`, `style` args, `restyle` prompt | US5, US6, SC-005 eval |

## Scheduling

After 001 US3 (theming) and before 001 US4 (full component catalogue), so every new US4 component ships with style
recipes from day one (FR-009). Docs (001 US6) and MCP (003) consume the manifest `styles` entries.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| New cascade layer `nb.styles` | Recipes must override components but lose to utilities | Putting recipes in `nb.components` makes order between component and recipe files fragile; in `nb.utilities` they would beat author utilities |
| 6× visual matrix | Styles must be verified per component | Sampling would let style regressions through; sharding keeps CI time bounded |
