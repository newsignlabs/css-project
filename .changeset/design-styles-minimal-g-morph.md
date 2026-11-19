---
"newbrush": minor
"@newbrush/styles": minor
---

Design styles `minimal` and `g-morph` (specs/004 S1). `minimal`: small radii, no shadows, airier cards. `g-morph`
(`glass`): translucent surfaces with backdrop blur, light edges and an ambient brand/accent background, with opaque
fallbacks for unsupported blur, reduced transparency, print and the contrast theme. Under the contrast theme and
forced colors every style's colours are restored. Each style is also published as `newbrush/styles/<name>.css`
(lowered for the browser targets).
