# @newbrush/docs

The newBrush documentation site, built with [Astro](https://astro.build) and
[Starlight](https://starlight.astro.build) and styled with newBrush itself. It is private and not published.

```bash
pnpm --filter @newbrush/docs dev      # http://localhost:4321
pnpm --filter @newbrush/docs build    # → apps/docs/dist (turbo builds newbrush first)
pnpm --filter @newbrush/docs test     # checks the built site against the manifest
```

The site needs Node ≥ 22.23 (Astro 7).

## Publishing (Catalyst Slate)

The live site is the Catalyst Slate app linked to this repository. Slate serves the repository root as static files,
with no build step, and redeploys on every push to `main`. So the built site is committed:

```bash
pnpm site    # builds the docs and copies apps/docs/dist → site/
```

Commit `site/` along with your docs change. The root `index.html` redirects to `site/`, and the site is built with
`base: "/site"`. Internal links must stay base-aware: use `url()` from `src/lib/manifest.ts` in `.astro` pages and
relative links in MDX. `test/build.test.ts` fails on any link outside `/site/` or to a missing file.

## How pages are made

| Pages | Source |
| ----- | ------ |
| Home, guides | Hand-written MDX in `src/content/docs/` |
| `/components/<name>/` | Generated from `newbrush/manifest.json`: one page per component, with live examples, anatomy, modifiers, sizes and states, accessibility notes and tokens |
| `/reference/tokens/`, `/reference/utilities/`, `/reference/themes/`, `/reference/styles/` | Generated from the same manifest |

`src/lib/manifest.ts` loads the manifest, and the generated pages live under `src/pages/`. The sidebar is built
from the manifest in `astro.config.mjs`. When a component, token or utility changes, its page changes in the
next build, so the reference can't drift from the code.

## Theming

- `src/styles/layers.css` comes first in Starlight's `customCss`, so it sets the cascade-layer order:
  - newBrush's reset, tokens and element defaults sit below Starlight's layers.
  - newBrush's layout primitives, components, design styles and utilities sit above them.
  - So Starlight's navigation and prose keep their styles, and live examples render exactly as they would on a
    newBrush page.
- `src/styles/theme.css` maps Starlight's `--sl-*` colour, font and shadow variables to `--nb-*` tokens.
- `src/theme-sync.js` mirrors Starlight's theme picker (`data-theme`) to `data-nb-theme`.

## Tests

- `test/build.test.ts` checks the built HTML:
  - every component page and example is present;
  - every token, utility family, variant, theme and style is listed;
  - the layer order is correct.
- `apps/visual-tests/specs/docs.spec.ts` runs axe (WCAG 2.2 AA) on every page in light and dark, in Chromium,
  Firefox and WebKit, and checks that the theme picker switches newBrush themes.
