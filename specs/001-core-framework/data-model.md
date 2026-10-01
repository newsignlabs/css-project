# Data Model: newBrush Core Framework (Phase 1)

These are the structured entities the build system, engine, docs and MCP server share. All are
expressed as TypeScript types in `packages/schema` and exported as JSON Schema (draft 2020-12).

## Token (DTCG)

```jsonc
// packages/tokens/src/semantic/color.json
{
  "color": {
    "surface": {
      "default": { "$type": "color", "$value": "{color.neutral.50}",
                   "$extensions": { "nb.themes": { "dark": "{color.neutral.950}" } },
                   "$description": "Default page/background surface" }
    }
  }
}
```

| Field | Type | Notes |
| ----- | ---- | ----- |
| path | string[] | e.g. `["color","surface","default"]` → CSS `--nb-color-surface-default` |
| tier | `primitive \| semantic \| component` | derived from folder |
| $type | DTCG type | color, dimension, fontFamily, fontWeight, duration, cubicBezier, shadow, typography, number |
| $value | value or alias `{…}` | aliases resolved at build |
| themes | Record<themeName, value> | via `$extensions["nb.themes"]` |
| $description | string | surfaced in docs + MCP |

**Rules**: components may reference only `semantic` or `component` tier tokens (enforced by a Stylelint rule that checks `var(--nb-*)` names).

### Token groups (v1.0)

`color` (neutral, brand, accent, success, warning, danger, info + semantic surface/text/border/focus),
`font` (family sans/serif/mono, weight, size fluid scale `-2…7`, line-height, letter-spacing),
`space` (fluid `3xs…3xl` + static `0…96` 0.25rem steps), `size` (container widths), `radius` (`none xs sm md lg xl 2xl full`),
`shadow` (elevation `0…5`, glow, inset), `border` (width), `motion` (duration, easing, spring approximations),
`z` (base, dropdown, sticky, overlay, modal, toast, tooltip), `breakpoint`, `opacity`, `blur`.

## Theme

```ts
interface Theme {
  name: string;                 // "light" | "dark" | "contrast" | custom
  colorScheme: "light" | "dark";
  extends?: string;             // inherit from another theme
  overrides: Record<string, string>; // token path → value
}
```
Emitted as `:root, [data-nb-theme="light"] { … }`, `[data-nb-theme="dark"] { … }` and
`@media (prefers-color-scheme: dark) { :root:not([data-nb-theme]) { … } }`, plus `light-dark()` where a token has exactly two values.

## Variant

```ts
interface Variant {
  name: string;                                 // "md", "hover", "dark", "group-hover", "@lg"
  kind: "media" | "container" | "selector" | "at-rule" | "parent-selector";
  template: string;                             // "@media (width >= 48rem) { & }" | "&:hover" | ":where(.group):hover &"
  order: number;                                // stable output sort
  composable: boolean;
}
```

## Utility family

```ts
interface UtilityFamily {
  name: string;                          // "padding-inline"
  patterns: string[];                    // ["px-{space}", "px-[{length}]"]
  properties: string[];                  // ["padding-inline"]
  values: { source: "token"; group: string } | { source: "static"; map: Record<string,string> };
  arbitrary?: { grammar: "length" | "color" | "percentage" | "number" | "time" | "image-safe" | "grid-template" };
  negative?: boolean;
  modifiers?: { opacity?: boolean; lineHeight?: boolean };
  variants: "all" | string[];
  category: "layout" | "spacing" | "sizing" | "typography" | "color" | "border" | "effects" | "motion" | "interactivity" | "a11y";
  description: string;
}
```

## Class candidate (engine AST)

```ts
interface ParsedClass {
  raw: string;                     // "md:hover:bg-brand-600/80"
  variants: string[];              // ["md","hover"]
  negative: boolean;
  utility: string;                 // "bg"
  value?: string;                  // "brand-600"
  arbitrary?: string;              // for "[...]" values
  modifier?: string;               // "80"
  important: boolean;              // trailing "!"
}
```

## Component

```ts
interface Component {
  name: string;                    // "button"
  className: string;               // "nb-btn"
  category: "layout" | "content" | "actions" | "forms" | "navigation" | "feedback" | "overlay" | "data" | "marketing";
  anatomy: { part: string; className: string; element?: string; required: boolean }[];
  modifiers: { name: string; className: string; description: string }[]; // --primary, --ghost…
  sizes: string[];                 // ["sm","md","lg"]
  states: string[];                // ["hover","focus-visible","active","disabled","loading"]
  html: { element: string; attributes?: Record<string,string> };
  a11y: { role?: string; requirements: string[]; keyboard?: string[] };
  tokens: string[];                // component-tier tokens consumed
  examples: { title: string; html: string }[];
  status: "stable" | "beta" | "deprecated";
  since: string;                   // semver
}
```

## Config (`newbrush.config.ts`)

```ts
interface NewBrushConfig {
  prefix?: { components?: string; utilities?: string };   // defaults "nb-" / ""
  content: string[];                                       // globs to scan
  theme?: { extend?: DeepPartial<Tokens>; seeds?: { brand?: string; accent?: string; neutral?: string } };
  themes?: Theme[];
  darkMode?: "media" | "attribute" | "both";               // default "both"
  components?: "all" | string[] | false;
  utilities?: "all" | string[] | false;
  safelist?: (string | RegExp)[];
  blocklist?: string[];
  contrast?: { level: "AA" | "AAA"; onFail: "error" | "warn" | "fix" };
  output?: { minify?: boolean; sourcemap?: boolean; layers?: boolean };
}
```

## Manifest (`dist/manifest.json`)

```ts
interface Manifest {
  name: "newbrush"; version: string; schemaVersion: 1;
  layers: string[];
  tokens: ResolvedToken[];       // path, cssVar, type, value per theme, description
  themes: Theme[];
  variants: Variant[];
  utilities: UtilityFamily[];
  components: Component[];
}
```
The manifest is the contract consumed by the docs site (001), the CDN listing (002) and the MCP server (003).
