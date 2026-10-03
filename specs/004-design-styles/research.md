# Research: Design Styles (Phase 0)

## R-01 Mechanism: tokens first, recipes second

- **Decision**: A style is (a) a set of DTCG token overrides and (b) a small set of scoped "recipes" for what tokens cannot
  express (backdrop-filter, glows, clip-path corners, scanlines, stepped borders, image-rendering).
- **Rationale**: ~80 % of a style is colors, radius, borders, shadows, fonts, motion and density — all already tokens. Token
  overrides re-skin every component and utility for free and keep size low. Recipes cover the signature 20 %.
- **Alternatives**: Separate component CSS per style (huge, drifts), CSS-in-JS theming (runtime JS, violates §III).

## R-02 Activation selector

- **Decision**: `.glassy, [data-nb-style=glassy]` set the inherited marker `--nb-style: glassy` plus that style's token
  overrides. Recipes are scoped `:where(.glassy, [data-nb-style=glassy]) .nb-card { … }` (zero specificity) inside
  `@layer nb.styles`.
- **Nearest style wins**: token overrides cascade naturally by inheritance (an inner `.neon` redeclares the tokens). Recipes
  use the same nearest-ancestor strategy as theme variants (001 class-grammar §Theme variants): style queries on
  `--nb-style` where supported, selector strategy (`:not(:where(.other-style) *)`, depth 2) otherwise — chosen per build
  from browserslist.
- **Reset**: `.style-default` restores default tokens and blocks recipes beneath it.

## R-03 Cascade layer

- **Decision**: New layer order `nb.reset, nb.tokens, nb.base, nb.layout, nb.components, nb.styles, nb.utilities`.
- **Rationale**: Recipes must beat component defaults but lose to utilities (author intent). Requires a constitution
  amendment (MINOR, principle I/FR-006 layer list) and updates to `LAYERS` in `@newbrush/schema`, the engine's hoisted
  layer statement and all layer-order tests.

## R-04 Styles × themes

- **Decision**: Style token overrides are written *relative to theme semantics* wherever possible
  (`glassy` surface = `color-mix(in oklch, var(--nb-color-surface-raised) 60%, transparent)`), so most styles need no
  per-scheme values. Styles with their own palette (neon, cyber) define `light` and `dark` maps emitted with the same
  scheme selectors tokens already use (`[data-nb-theme=dark]`, `prefers-color-scheme`).
- **preferredScheme**: dark-first styles (neon, cyber) set `color-scheme` and dark tokens when no `data-nb-theme` is present.
- **Contrast theme / forced-colors**: styles disable recipes entirely (`@media (forced-colors: active)` and
  `[data-nb-theme=contrast]` guards); token overrides limited to radius/density.

## R-05 Per-style technique notes

| Style | Techniques | Fallbacks / guards |
| ----- | ---------- | ------------------ |
| minimal | `--nb-elevation-*: none`, hairline borders, radius xs–sm, reduced chroma (`oklch(from … l calc(c*.4) h)`), airy density | — |
| glassy | `backdrop-filter: blur() saturate()`, translucent surfaces via `color-mix`, 1px light inner border (`inset` shadow), body ambient mesh (radial gradients from brand/accent) | `@supports not (backdrop-filter: blur(1px))` and `prefers-reduced-transparency` → opaque surfaces; min surface opacity guaranteeing text contrast |
| neon | layered `box-shadow`/`text-shadow` glows from accent via relative color, outlined buttons, glow focus ring, near-black surfaces | glows removed under forced-colors/contrast; pulse animation motion-safe only; never color-only state |
| cyber | `clip-path: polygon()` notched corners (token `--nb-cut`), mono/condensed font stack, uppercase labels, scanline overlay (`repeating-linear-gradient` on `body::after`, `pointer-events:none`), glitch hover (`@keyframes` + `steps()`) | clip-path clips focus outlines → focus ring drawn with `drop-shadow` filter or inner outline; glitch motion-safe only; scanlines off in print/reduced-motion |
| pixel | radius 0, stepped borders via multi-step `box-shadow`, 4 px grid density, `image-rendering: pixelated` on `img`, `steps()` easing tokens, pixel font opt-in | font fallback `ui-monospace`; `font-size-adjust` to limit shift |

## R-06 Packaging & budgets

- **Decision**: Each style compiles to `dist/styles/<name>.css` (tokens + recipes, layered) and is concatenated into
  `newbrush.css`. JIT builds include `config.styles`. Budget ≤ 6 kB brotli per style, ≤ 25 kB total (current newbrush.css
  is 8 kB of its 35 kB budget, leaving room).

## R-07 Runtime switching

- **Decision**: Pure CSS switching (class change). `@newbrush/js` adds `setStyle(name, { transition: true, persist: true })`
  using the View Transitions API and `localStorage`; respects reduced motion.

## R-08 Docs information architecture

- **Decision**: Astro + Starlight (001 R-10) with a header style switcher that sets the class on `<html>`/`<body>`
  site-wide (persisted). IA:
  ```
  Getting started → 1 Install · 2 Choose your style · 3 Theme & brand · 4 Build
  Styles          → Overview (comparison grid) · Default · Minimal · Glassy · Neon · Cyber · Pixel · Custom styles
  Components      → each page: example + style tabs (all styles side by side) + tokens + a11y
  Utilities · Tokens · Themes · Tooling (CLI, Vite, PostCSS) · MCP
  ```
  Each style page: personality, when to use, "use it" snippet, live full-page demo, component gallery, tokens it changes,
  recipes list, accessibility notes, pairs-well-with (themes/brand seeds).

## R-09 Open questions

See spec Clarifications Q1–Q4 (naming, aliases, density scope, default packaging).
