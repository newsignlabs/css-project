---
"newbrush": minor
"@newbrush/engine": minor
"@newbrush/cli": minor
"@newbrush/postcss": minor
"@newbrush/vite": minor
---

Style variants (`neon:p-8`, `glass:rounded-none`…) that apply under the nearest design style, config `styles` to pick
the styles a build includes (the others' CSS is removed by `nb build`, the PostCSS plugin and the Vite build), a
`NewBrushStyle` type and style completions for editors, and per-style show/hide utilities in `newbrush-full.css`
(specs/004 S3a).
