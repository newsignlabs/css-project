# @newbrush/styles

Design styles for newBrush (specs/004-design-styles). One class re-skins every component:

```html
<body class="g-morph">            <!-- or nb-g-morph, glass, data-nb-style="g-morph" -->
  <section class="style-default">  <!-- the default style again for this subtree -->
```

`newbrush.css` already includes every style; this package also publishes each one on its own
(`@newbrush/styles/<name>.css`, copied to `newbrush/styles/<name>.css`).

## Styles

| Style | Status | Look |
| ----- | ------ | ---- |
| `minimal` | available | Small radii, no shadows below overlays (elevated cards keep a hairline border), airier cards, tight headings. Changes no colours. |
| `g-morph` (`glass`) | available | Translucent raised, subtle and overlay surfaces with backdrop blur and light edges, larger radii, soft shadows, and an ambient brand/accent background when the class is on `<html>` or `<body>`. |
| `n-morph` (`neumorph`), `neon`, `cyber`, `pixelate` (`pixel`) | planned | The marker works (`--nb-style`), the look lands in S2. |

### g-morph knobs

Set these on the styled element (unlayered CSS wins over the style):

| Property | Default | Meaning |
| -------- | ------- | ------- |
| `--nb-glass-opacity` | `62%` | How much of each surface colour stays; `100%` is opaque |
| `--nb-glass-blur` | `var(--nb-blur-lg)` | Backdrop blur radius |
| `--nb-glass-saturate` | `1.6` | Backdrop saturation |
| `--nb-glass-tint-1`, `--nb-glass-tint-2` | brand / accent, near the page's lightness | Ambient background colours |

Glass turns opaque where it would hurt: without `backdrop-filter` support, with `prefers-reduced-transparency`,
in print and in the contrast theme. Under forced colors and `prefers-contrast: more` the blur, light edges and
ambient background go too. Every text and UI pair stays WCAG AA over the strongest ambient tint, in light and dark
and with any brand seed (apps/visual-tests `styles-contrast.spec.ts`).

### Contrast theme and forced colors outrank styles

For every colour a style overrides, the build adds a rule in `nb.styles` restoring it under the contrast theme,
`prefers-contrast: more` (light) and forced colors. Radius and density stay styled.

## A style

```text
src/<name>/
├── style.json    metadata + DTCG token overrides (validated by @newbrush/schema StyleSource)
├── recipes.css   optional; every rule inside @layer nb.styles, `:--style` stands for the style's selector
└── preview.html  optional; gallery fragment, listed as the style's example in the manifest
```

Token overrides are written in DTCG and emitted in `nb.tokens` on the style's selectors, so they inherit and the
nearest style wins. `{a.b}` references become `var(--nb-a-b)`. A reference to a token the same style also overrides
means that token's *default*: its `-base` alias (`color-mix(in oklch, {color.surface.raised} 60%, transparent)` →
`var(--nb-color-surface-raised-base)`), or for a token that is the same in every theme its declared value.
`.style-default` restores every token any style overrides.

Override the tokens components consume: a token defined from another (`control.radius` = `{radius.md}`) was computed
where the theme declared it, so overriding `radius.md` alone does not change `--nb-control-radius`.

`pnpm build` writes `dist/<name>.css`, `dist/styles.css` (all styles, then the reset) and `dist/manifest.json`.
