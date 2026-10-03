# Data Model: Design Styles (Phase 1)

## Style source (DTCG + recipes)

```text
packages/styles/src/<name>/
├── style.json        # metadata + DTCG token overrides (per scheme)
├── recipes.css       # @layer nb.styles { :where(.<name>, [data-nb-style=<name>]) … }
└── preview.html      # gallery/docs preview fragment
```

```jsonc
// packages/styles/src/glassy/style.json
{
  "name": "glassy",
  "aliases": ["glass"],
  "title": "Glassy",
  "description": "Glassmorphism: translucent surfaces, backdrop blur and soft light edges.",
  "keywords": ["glassmorphism", "frosted", "translucent", "modern", "depth"],
  "preferredScheme": "auto",                 // "light" | "dark" | "auto"
  "density": "default",                      // "compact" | "default" | "airy" | "grid-4"
  "fonts": [],                               // optional @newbrush/fonts families
  "effects": ["backdrop-blur", "ambient-background", "light-edge"],
  "tokens": {                                 // DTCG overrides applied in every scheme
    "radius": { "md": { "$value": "{radius.lg}" }, "lg": { "$value": "{radius.2xl}" } },
    "color": { "surface": { "raised": { "$value": "color-mix(in oklch, {color.surface.raised} 60%, transparent)" } } }
  },
  "schemes": { "dark": { /* extra overrides only when dark */ } },
  "a11y": ["Opaque fallback when backdrop-filter is unsupported or reduced transparency is requested"],
  "status": "beta",
  "since": "0.4.0"
}
```

## Style (manifest entry — `@newbrush/schema`)

```ts
interface Style {
  name: string;                       // kebab-case class name
  aliases: string[];
  title: string;
  description: string;
  keywords: string[];                 // for search and MCP intent matching ("cyberpunk" → cyber)
  preferredScheme: "light" | "dark" | "auto";
  density: "compact" | "default" | "airy" | "grid-4";
  fonts: string[];
  effects: string[];
  tokens: { path: string; cssVar: string; value: string; scheme?: "light" | "dark" }[]; // resolved overrides
  recipes: { target: string; description: string }[];   // e.g. { target: "nb-card", description: "frosted surface" }
  a11y: string[];
  examples: { title: string; html: string }[];          // full-page and gallery previews
  status: "stable" | "beta" | "deprecated";
  since: string;
}

interface Manifest { /* … existing … */ styles: Style[] }
```

## Config additions

```ts
interface NewBrushConfig {
  // …
  styles?: "all" | false | string[];              // built-in styles to include (default "all")
  customStyles?: string[];                         // paths to custom style folders
  prefix?: { components?: string; utilities?: string; styles?: string }; // styles prefix default ""
}
```

## Layer order (amended)

```css
@layer nb.reset, nb.tokens, nb.base, nb.layout, nb.components, nb.styles, nb.utilities;
```

## Emitted CSS shape (per style)

```css
@layer nb.tokens {
  .glassy, [data-nb-style="glassy"] {
    --nb-style: glassy;
    --nb-radius-md: var(--nb-radius-lg);
    --nb-color-surface-raised: color-mix(in oklch, var(--nb-color-surface-raised-base) 60%, transparent);
  }
  [data-nb-theme="dark"] :is(.glassy, [data-nb-style="glassy"]) { /* dark-only overrides */ }
}
@layer nb.styles {
  :where(.glassy, [data-nb-style="glassy"]) .nb-card { backdrop-filter: blur(var(--nb-blur-md)) saturate(1.5); }
  @supports not (backdrop-filter: blur(1px)) { :where(.glassy, [data-nb-style="glassy"]) .nb-card { background-color: var(--nb-color-surface-raised-base); } }
  @media (forced-colors: active), (prefers-reduced-transparency: reduce) { /* opaque, no blur */ }
}
```

Note: overriding a semantic token with a value derived from itself needs an un-overridden source — the token build
emits `*-base` aliases for semantic tokens that styles derive from (e.g. `--nb-color-surface-raised-base`).
