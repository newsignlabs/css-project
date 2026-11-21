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
| `neon` | available, dark-first | Near-black surfaces, accent edges and glows, outlined primary buttons, glowing headings, a focus ring in the text colour with a glow around it. `data-nb-theme="light"` gives a light neon. |
| `cyber` | available, dark-first | Notched corners (`--nb-cut`), square radii, monospace uppercase labels, static scanlines (dark scheme), a one-shot glitch on hover when motion is allowed. Focus rings are drawn inside the notch. |
| `n-morph` (`neumorph`) | available | Surfaces extruded from the page by a soft light and shadow pair, large radii, inset inputs, pressed buttons pushed in with a bolder label, a thick focus ring. Controls keep their borders. |
| `pixelate` (`pixel`) | available | Square corners everywhere, stepped 4 px pixel frames on cards and buttons, `steps()` motion, pixelated images, pixel headings (`--nb-font-family-pixel`: monospace, or Pixelify Sans with `@newbrush/fonts/pixelify-sans.css`). |

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

### neon, cyber and n-morph knobs

| Property | Default | Meaning |
| -------- | ------- | ------- |
| `--nb-glow` | accent at 55% | neon's glow colour |
| `--nb-cut` | `0.75rem` | cyber's corner notch (buttons use 60% of it) |
| `--nb-style-overlay` | black 10% in dark, none in light | cyber's scanline colour |
| `--nb-extrude` | `0.375rem` | n-morph's extrusion depth |
| `--nb-soft-light`, `--nb-soft-shadow` | from the surface, per scheme | n-morph's light and shadow pair |

### Dark-first styles

A style with `"preferredScheme": "dark"` (neon, cyber) is dark wherever no theme is explicit: on a light page without
`data-nb-theme` it declares the dark theme for its subtree (and `<html>`, when the class is on `<body>`). Inside an
explicit theme it follows that theme, so `data-nb-theme="light"` gives its light variant. It never applies over the
contrast theme or `prefers-contrast: more`. Colours that differ per scheme are written under `"schemes"` in
style.json and compile to `light-dark()`.

### Nesting

Everything a style emits is in `nb.styles`, so it outranks the token declarations of any theme whatever their
specificity. The nearest style wins: a style class on an element beats a style inherited from above, a theme island
(`data-nb-theme`) inside a style keeps that style's overrides in its own scheme, and recipes stop at another style or
`.style-default` in between (two levels deep, the same selector strategy as theme variants).

### Contrast theme and forced colors outrank styles

For every colour a style overrides, the build adds a rule in `nb.styles` restoring it under the contrast theme,
`prefers-contrast: more` (light) and forced colors. Radius and density stay styled.

## A style

```text
src/<name>/
├── style.json    metadata + DTCG token overrides (validated by @newbrush/schema StyleSource)
├── recipes.css   optional; every rule inside @layer nb.styles, `:--style` stands for the style's selector,
│                 `:--contrast` for the style inside or under the contrast theme (to switch decoration off)
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
