---
"@newbrush/cli": minor
"@newbrush/engine": minor
"@newbrush/postcss": minor
"@newbrush/vite": minor
"@newbrush/styles": minor
"@newbrush/js": minor
---

Custom design styles (config `customStyles`): compiled with the built-in pipeline, given variants and contrast-checked
at build time. CLI `nb style list` and `nb style create <name> --from <style>`, and `nb doctor` style warnings. New
package `@newbrush/js` with `setStyle()`, `getStyle()` and `restoreStyle()` (View Transitions, persistence,
reduced-motion aware). `@newbrush/styles/lib` exposes the style compiler (specs/004 S3b).
