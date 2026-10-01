# Contract: Engine, CLI & Plugin APIs

## `@newbrush/engine` (browser-safe core)

```ts
export function parse(candidate: string, ctx: EngineContext): ParsedClass | null;

export function generate(
  input: { classes: Iterable<string> } | { content: string[] /* raw text */ },
  config?: Partial<NewBrushConfig>,
  opts?: { layer?: boolean; minify?: boolean; preflight?: boolean; components?: boolean | string[] }
): Promise<{
  css: string;
  classes: { used: string[]; rejected: Diagnostic[]; unknown: string[] };
  stats: { rules: number; bytes: number; ms: number };
}>;

export function createEngine(config: NewBrushConfig): Engine;   // cached, incremental
interface Engine {
  addCandidates(c: Iterable<string>): { changed: boolean };
  css(): string;
  manifest(): Manifest;
  explain(className: string): { parsed: ParsedClass; family: string; css: string } | Diagnostic;
}

export function extractCandidates(source: string, kind?: "html" | "jsx" | "vue" | "svelte" | "text"): Set<string>;
export function resolveConfig(user: Partial<NewBrushConfig>): ResolvedConfig;
```

Node-only helpers (`@newbrush/engine/node`): `scan(globs)`, `watch(globs, cb)`, `loadConfig(cwd)`.

## `@newbrush/cli`

The `nb` binary is provided **only** by `@newbrush/cli` (install it, or run `npx @newbrush/cli <cmd>`).
The `newbrush` package has no `bin` and no runtime dependencies.

```text
nb init [--template plain|vite|next|astro] [--prefix nb-]    create newbrush.config.ts + entry css
nb build [-i src/app.css] [-o dist/app.css] [--minify] [--watch]
nb tokens [--format css|ts|json|figma] [-o dir]               export resolved tokens
nb theme create <name> --seed <color> [--from dark]           scaffold a theme
nb contrast [--level AA|AAA]                                  report semantic contrast pairs
nb explain <class...>                                         show parse + generated CSS
nb doctor                                                     check config, browserslist, duplicates, prefix collisions
```

Exit codes: `0` ok, `1` build error, `2` config invalid, `3` contrast/budget failure.

## Entry CSS directives

```css
/* app.css */
@import "newbrush";            /* layers + tokens + base + components */
@newbrush utilities;           /* replaced with JIT utilities by CLI / PostCSS / Vite */
@nb-theme "./brand.theme.json";

.my-card { @nb-apply p-6 rounded-xl shadow-md bg-surface-raised; }
```

## `@newbrush/postcss` / `@newbrush/vite`

```js
// postcss.config.js
export default { plugins: { "@newbrush/postcss": { config: "./newbrush.config.ts" } } };

// vite.config.ts
import newbrush from "@newbrush/vite";
export default { plugins: [newbrush()] };
```

## `@newbrush/js`

```js
import { initAll, toast, Tabs, Dialog } from "@newbrush/js";
initAll();                     // auto-enhances [data-nb-*] elements; idempotent; SSR-safe
toast({ title: "Saved", tone: "success" });
```
`@newbrush/js` builds `newbrush.min.js` (IIFE, global `newBrush`) and `newbrush.esm.js`. The `newbrush` package's build copies
these files into its own `dist/` (build-time only — not a runtime dependency) so the CDN URL `newbrush@1/dist/newbrush.min.js` works.
