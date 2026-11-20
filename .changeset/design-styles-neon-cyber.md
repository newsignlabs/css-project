---
"newbrush": minor
"@newbrush/styles": minor
"@newbrush/tokens": minor
---

Design styles `neon` and `cyber` (specs/004 S2a), both dark-first: dark wherever no theme is explicit, light under
`data-nb-theme="light"`. Styles now emit everything in `nb.styles`, so they outrank theme tokens; theme islands inside
a style keep it, recipes stop at a nearer style or `.style-default`, and per-scheme colours compile to `light-dark()`.
Every semantic colour token now has a `-base` alias.
