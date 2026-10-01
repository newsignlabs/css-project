# Quickstart: newBrush Core (validation scenarios)

These scenarios double as the acceptance smoke tests run in CI against built artifacts.

## 1. Zero-build (US1)

```html
<!doctype html>
<html lang="en">
<head>
  <link rel="stylesheet" href="./node_modules/newbrush/dist/newbrush.css">
</head>
<body class="nb-container">
  <h1>Hello newBrush</h1>
  <button class="nb-btn nb-btn--primary">Get started</button>
  <article class="nb-card">
    <header class="nb-card__header">Card</header>
    <div class="nb-card__body">Token-driven, layered, accessible.</div>
  </article>
</body>
</html>
```
✅ Expect: styled typography, primary button with focus ring, card with elevation; dark mode follows OS.

## 2. JIT utilities (US2)

```bash
pnpm add -D newbrush @newbrush/cli @newbrush/vite
npx nb init --template vite          # `nb` binary comes from @newbrush/cli
```
```html
<section class="grid gap-6 p-8 md:grid-cols-3">
  <div class="rounded-xl bg-surface-raised p-6 shadow-md hover:shadow-lg transition">…</div>
</section>
```
✅ Expect: generated CSS contains only used utilities; HMR update < 50 ms.

## 3. Brand theme (US3)

```ts
// newbrush.config.ts
import { defineConfig } from "newbrush/config";
export default defineConfig({
  content: ["./src/**/*.{html,tsx}"],
  theme: { seeds: { brand: "oklch(62% 0.19 255)" } },
  contrast: { level: "AA", onFail: "fix" },
});
```
```bash
npx nb contrast   # all pairs pass (requires @newbrush/cli)
```

## 4. Scoped theme & runtime re-tint (US3)

```html
<aside data-nb-theme="dark" style="--nb-color-brand-seed: oklch(70% 0.2 150)">
  <button class="nb-btn nb-btn--primary">Green, dark</button>
</aside>
```

## 5. Explain a class

```bash
npx @newbrush/cli explain "md:hover:bg-brand-600/80" "w-[;evil]"
# → prints CSS for the first, NB_ARBITRARY_REJECTED for the second
```
