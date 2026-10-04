# Contract: Style API

Public, semver-protected surface (constitution §VIII).

## Activation

| Form | Example | Notes |
| ---- | ------- | ----- |
| Class | `<body class="g-morph">` | Canonical. Any element; nearest wins. |
| Attribute | `<body data-nb-style="g-morph">` | Equivalent; handy for frameworks that own `class`. |
| Alias | `class="glass"`, `class="neumorph"`, `class="pixel"` | Short aliases of `g-morph`, `n-morph`, `pixelate`. |
| Reset | `class="style-default"` | Default style for a subtree inside a styled page. |
| Prefixed | `class="nb-g-morph"` | Always available, identical to the bare name (bare and `nb-` forms both work). |

Built-in names (v1.0): `minimal`, `g-morph`, `n-morph`, `neon`, `cyber`, `pixelate`. The default style has no class.

## Combining with themes and brand

```html
<html data-nb-theme="dark">
  <body class="neon" style="--nb-color-brand-seed: oklch(70% 0.25 330)">
```

Order of authority: forced-colors / contrast theme > style > theme palette defaults. Utilities always win.

## Style variants (engine)

`<style>:` prefixes any utility and applies it only under the nearest matching style:

```html
<div class="p-6 rounded-lg g-morph:rounded-2xl neon:shadow-none pixelate:rounded-none">
```

Resolution strategy matches theme variants (style query on `--nb-style`, or depth-2 selector strategy per browserslist).

## Custom properties exposed per style

| Property | Meaning |
| -------- | ------- |
| `--nb-style` | Inherited marker with the active style name (read-only for authors) |
| `--nb-density` | Spacing multiplier used by components (`1` default; minimal `1.25`, pixelate snaps to 4 px) |
| `--nb-glow` | Glow color (neon/cyber), derived from accent |
| `--nb-cut` | Corner notch size (cyber) |
| `--nb-glass-opacity`, `--nb-glass-blur` | Glass tuning knobs (g-morph) |
| `--nb-extrude`, `--nb-soft-light`, `--nb-soft-shadow` | Extrusion depth and shadow pair (n-morph) |

## JavaScript (optional, `@newbrush/js`)

```js
import { setStyle, getStyle } from "@newbrush/js";
setStyle("neon", { target: document.body, transition: true, persist: true }); // View Transition + localStorage
```

## CLI

```text
nb style list                          list built-in and custom styles
nb style create <name> --from <style>  scaffold a custom style (style.json + recipes.css + preview.html)
nb doctor                              warns on multiple style classes, unknown data-nb-style values, prefix collisions
```

## MCP (feature 003 additions)

```ts
list_styles  in: {}                                   out: { styles: Style[] }
build_page   in: { …, style?: string }                // sets <body class> and includes only that style's CSS
compose_component in: { …, style?: string }
generate_css in: { …, style?: string | string[] }
resource newbrush://styles/{name}                      // Style JSON
prompt   restyle { html, style }                       // swap the body class, validate, regenerate CSS
```
