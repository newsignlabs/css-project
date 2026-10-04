# Quickstart: Design Styles (validation scenarios)

## 1. One class re-skins everything (US1)

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/newbrush@1/dist/newbrush.min.css">
<body class="g-morph">
  <header class="nb-navbar">…</header>
  <main class="nb-container">
    <article class="nb-card">…</article>
    <button class="nb-btn nb-btn--primary">Get started</button>
  </main>
</body>
```
✅ Change `g-morph` → `minimal` → `neon` → `cyber` → `pixelate`: the page re-skins each time, no other edits.

## 2. Style + theme + brand (US2)

```html
<html data-nb-theme="light">
<body class="neon" style="--nb-color-brand-seed: oklch(68% 0.22 150)">
```
✅ Light neon in green glow; switching `data-nb-theme="dark"` keeps neon.

## 3. Islands and reset (US3)

```html
<body class="minimal">
  <section class="neon">Promo</section>
  <div class="style-default">Embedded widget</div>
</body>
```

## 4. Style variants (US4)

```html
<div class="nb-card p-6 neon:p-8 pixelate:rounded-none">…</div>
```

## 5. Bundler config (FR-016)

```ts
export default defineConfig({ content: ["src/**/*.html"], styles: ["g-morph", "minimal"] });
```
✅ Output contains only g-morph and minimal recipes.

## 6. Runtime switch with transition (R-07)

```js
import { setStyle } from "@newbrush/js";
document.querySelector("#style").addEventListener("change", (e) => setStyle(e.target.value, { transition: true, persist: true }));
```

## 7. MCP (US6)

```json
{ "tool": "build_page", "arguments": { "title": "Arcade", "style": "pixelate", "sections": [{ "type": "hero" }] } }
```
✅ `<body class="pixelate">`, CSS contains pixelate recipes only, zero axe violations.
