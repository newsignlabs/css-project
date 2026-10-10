# Research: newBrush Core Framework (Phase 0)

Each decision lists the choice, rationale, and alternatives considered.

## R-01 Authoring language for styles

- **Decision**: Native modern CSS (nesting, layers, custom properties) authored in `.css` files, processed by **Lightning CSS**.
- **Rationale**: Native nesting and layers are Baseline; Lightning CSS (Rust) is ~100× faster than PostCSS chains,
  minifies, lowers syntax per browserslist, bundles `@import`, and is deterministic. Consumers never need Sass.
- **Alternatives**: Sass (adds a language and a dependency to consumers; Bootstrap is moving away), PostCSS + plugins
  (slower, plugin-order fragility), vanilla-extract/CSS-in-JS (runtime/bundler coupling).

## R-02 Design tokens pipeline

- **Decision**: Tokens in **W3C DTCG** JSON (`$value`, `$type`), compiled by **Style Dictionary v4** with custom
  formats for: CSS custom properties per layer/theme, TS module, JSON for manifest, Figma Variables JSON.
- **Rationale**: DTCG is the emerging standard (Figma, Tokens Studio, Penpot support it); SD v4 supports DTCG natively.
- **Alternatives**: Hand-maintained CSS vars (drift), Theo (unmaintained), Tailwind theme object (non-standard).

## R-03 Color system

- **Decision**: **OKLCH** for all palettes. Scales 50–950 generated from seeds with fixed lightness curve and chroma
  easing; gamut-mapped to sRGB with P3 enhancement under `@media (color-gamut: p3)`. Contrast verified with both
  WCAG 2.x ratio and APCA Lc. Runtime re-tinting via relative color syntax `oklch(from var(--nb-color-brand-seed) …)`
  with a precomputed fallback.
- **Rationale**: Perceptually uniform steps, predictable contrast, wide-gamut ready. Tailwind v4 and Radix moved to OKLCH.
- **Alternatives**: HSL (non-uniform lightness), HEX scales (manual), LCH (hue shift in blues).
- **Library**: `culori` for generation and gamut mapping at build time.
- **Contrast guard (T060)**: at equal OKLCH lightness, yellows and greens have higher WCAG luminance than blues, so a
  fixed curve alone cannot promise AA for every seed. After gamut mapping, each step's luminance is kept on the safe
  side of the default brand (or neutral) scale (dark steps 500–950 never lighter, light steps 50–400 never darker),
  adjusting lightness only. Any pair of a dark and a light step, or a step and a fixed colour, then contrasts at least
  as much as on the default scale. Gamut mapping reduces chroma at constant lightness and hue (sRGB value + P3 value).

## R-04 Cascade layering

- **Decision**: `@layer nb.reset, nb.tokens, nb.base, nb.layout, nb.components, nb.utilities;` declared first in every bundle.
  Unlayered consumer CSS always wins. Components use `:where()` for zero-specificity base selectors so modifiers override cleanly.
- **Alternatives**: BEM specificity discipline only (fragile), `!important` utilities (Tailwind v3 `important` option — rejected as default).

## R-05 Class naming conventions

- **Decision**:
  - Components: BEM-inspired with prefix — `nb-card`, `nb-card__header`, `nb-card--elevated`; sizes `nb-btn--sm`.
  - State via native attributes / ARIA first (`[aria-expanded="true"]`, `:disabled`, `[open]`), not `.is-*` classes.
  - Utilities: Tailwind-compatible grammar (`md:hover:bg-brand-600/80`) so knowledge transfers (and LLMs already know it);
    unprefixed by default, `prefix: "nb-"` config to avoid collisions.
- **Rationale**: Familiarity lowers adoption cost for humans *and* for LLMs generating markup.

## R-06 Utility engine implementation

- **Decision**: Own engine in TypeScript (`@newbrush/engine`): tokenizer → AST (variants, utility, value, modifier,
  important) → matcher (registry of utility families) → CSS AST → printer; output handed to Lightning CSS for minify/lowering.
  Content scanning with a fast regex extractor (candidate strings) + `fast-glob`; file watching via `chokidar`/`@parcel/watcher`.
  Incremental cache keyed by candidate set.
- **Rationale**: Owning the engine enables the MCP server (feature 003) to call `generate()` in-process with tokens/theme
  awareness, a manifest-driven registry, and arbitrary-value validation (security, principle IX).
- **Alternatives**: Wrap Tailwind v4 (licence fine but couples us to their token/config model and roadmap; no component
  layer; can't guarantee our manifest), UnoCSS presets (good engine, but makes our identity a preset).
- **Revisit**: If engine perf misses SC-004, port hot path (extractor) to Rust via napi-rs.

## R-07 Responsive strategy

- **Decision**: Breakpoint tokens `sm 40rem, md 48rem, lg 64rem, xl 80rem, 2xl 96rem` (mobile-first `min-width`) using
  range syntax `@media (width >= 48rem)`; container variants `@sm…@2xl` on `container-type: inline-size` parents (`@container`
  utility). Fluid type/space via `clamp()` scales (Utopia method).

## R-08 Interactive components without JS

- **Decision**: Modal → `<dialog>` + `::backdrop`; dropdown/menu/tooltip → `popover` attribute + CSS anchor positioning
  with fallback to `position-try`/static placement where anchors unsupported; accordion → `<details name>` exclusive groups;
  tabs → radio/`:has()` pattern documented plus enhanced ARIA tabs in `@newbrush/js`.
- **Rationale**: Native semantics give a11y for free and satisfy principle III.

## R-09 Testing stack

- **Decision**: Vitest (engine/unit), Playwright (visual regression across chromium/firefox/webkit, component screenshots
  rendered from manifest examples), `@axe-core/playwright` (a11y), Stylelint (`stylelint-config-standard` + custom rules:
  no physical properties, no raw colors outside tokens, layer required), `size-limit` (budgets), `publint` + `arethetypeswrong` (packaging).

## R-10 Documentation site

- **Decision**: **Astro + Starlight**, pages generated from `manifest.json` + MDX prose; Pagefind search; live playground using
  the engine compiled for the browser (engine has no Node-only deps in its core) inside a sandboxed iframe; deployed to
  Cloudflare Pages (or Vercel) at `newbrush.dev` [domain TBD].
- **Alternatives**: Docusaurus (React-heavy), VitePress (fine; Astro chosen for zero-JS-by-default parity with the framework).

## R-11 Monorepo tooling

- **Decision**: pnpm workspaces + Turborepo (cached builds/tests), Changesets (versioning), tsup (TS package bundling),
  Biome or ESLint+Prettier for TS (Biome chosen: single fast tool), Husky + lint-staged pre-commit.

## R-12 Clarified decisions (session 2026-10-01)

- **npm names**: `newbrush` + `@newbrush/*`. Registry check on 2026-10-01: `newbrush`, `newbrush-css`, `@newbrush/css` all unpublished. Create the `@newbrush` npm org immediately to reserve it.
- **Utility prefix**: unprefixed by default (Tailwind-compatible, LLM-fluent); components `nb-`.
- **Fonts**: system UI stack default; `@newbrush/fonts` opt-in (candidates: Inter, Geist, Fraunces for serif, Geist Mono / JetBrains Mono).
- **Figma**: Figma Variables export at v1.0; UI kit v1.1 (default applied, not asked).
- **Still open**: docs domain (working placeholder `newbrush.dev`).
