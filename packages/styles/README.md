# @newbrush/styles

Design styles for newBrush (specs/004-design-styles). One class re-skins every component:

```html
<body class="g-morph">            <!-- or nb-g-morph, glass, data-nb-style="g-morph" -->
  <section class="style-default">  <!-- the default style again for this subtree -->
```

`newbrush.css` already includes every style; this package also publishes each one on its own
(`@newbrush/styles/<name>.css`, copied to `newbrush/styles/<name>.css`).

> **Status: foundations (S0).** The six styles (`minimal`, `g-morph`, `n-morph`, `neon`, `cyber`, `pixelate`) are
> registered and their markers work (`--nb-style` names the nearest style), but they do not change any tokens yet.
> Their looks land in the following phases.

## A style

```text
src/<name>/
├── style.json    metadata + DTCG token overrides (validated by @newbrush/schema StyleSource)
├── recipes.css   optional; every rule inside @layer nb.styles, `:--style` stands for the style's selector
└── preview.html  optional; gallery fragment, listed as the style's example in the manifest
```

Token overrides are written in DTCG and emitted in `nb.tokens` on the style's selectors, so they inherit and the
nearest style wins. `{a.b}` references become `var(--nb-a-b)`; a token derived from itself
(`color-mix(in oklch, {color.surface.raised} 60%, transparent)`) uses its `-base` alias. `.style-default` restores every
token any style overrides.

`pnpm build` writes `dist/<name>.css`, `dist/styles.css` (all styles, then the reset) and `dist/manifest.json`.
