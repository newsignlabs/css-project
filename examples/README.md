# Examples

| Example | How it uses newBrush | Status |
| ------- | -------------------- | ------ |
| [`plain-html`](plain-html/) | One `<link>` to `newbrush.css`, no build (generated from the manifest) | runs from this repo |
| [`vite-app`](vite-app/) | `@newbrush/vite` — on-demand utilities, `@nb-apply`, HMR | workspace package, built in CI |
| [`next-app`](next-app/) | `@newbrush/postcss` in `postcss.config.mjs` | template — installs from npm once `0.1.0` is published |
| [`astro-app`](astro-app/) | `@newbrush/vite` via Astro's Vite config | template — installs from npm once `0.1.0` is published |

```bash
pnpm --filter @newbrush/example-vite-app dev
```
