# @newbrush/fonts

Opt-in, self-hostable variable fonts for newBrush. newBrush itself uses the system UI font stack and downloads no
fonts (FR-022); add this package when you want a consistent typeface everywhere.

| Token | Font | Fallback (metric-matched) |
| ----- | ---- | ------------------------- |
| `--nb-font-family-sans` | **Inter** (variable, 100–900, italic) | Arial |
| `--nb-font-family-serif` | **Fraunces** (variable, 100–900, italic) | Georgia |
| `--nb-font-family-mono` | **JetBrains Mono** (variable, 100–800, italic) | Courier New |

## Use

```bash
npm i @newbrush/fonts
```
```css
@import "newbrush";
@import "@newbrush/fonts";            /* all three, or one: */
@import "@newbrush/fonts/inter.css";  /* inter.css · fraunces.css · jetbrains-mono.css */
```
```html
<link rel="stylesheet" href="node_modules/newbrush/dist/newbrush.css">
<link rel="stylesheet" href="node_modules/@newbrush/fonts/dist/fonts.css">
```

Nothing else changes: components and utilities read the `font.family` tokens, which now start with the web font and
keep the system stack after it.

## How it stays fast

- **Subsetted WOFF2.** Each family is split by `unicode-range` (latin, latin-ext, cyrillic, greek, vietnamese…).
  Browsers download only the ranges a page uses; an English page loads one file per style (~36–48 kB).
- **`font-display: swap`.** Text renders immediately in the fallback, then swaps.
- **No layout shift on swap.** A local fallback face with `size-adjust` and ascent/descent overrides (computed with
  Capsize from the fonts' metrics) matches the web font's proportions.
- **One weight axis.** A single variable file serves every weight from 100 to 900.
- **Self-hosted.** Font URLs are relative (`./files/…`), so the CSS works from `node_modules`, a CDN or your own
  server, with no third-party requests.

## Licences

The fonts are licensed under the SIL Open Font License 1.1; their licence texts ship in `dist/licenses/`. The package
code is MIT. Font files come from the [Fontsource](https://fontsource.org) variable packages.
