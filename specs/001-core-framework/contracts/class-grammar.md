# Contract: Class Grammar

Public, semver-protected grammar for utility class names. Implemented by `@newbrush/engine/parser`.

## EBNF

```ebnf
class        = { variant ":" } [ "-" ] utility [ "-" value ] [ "/" modifier ] [ "!" ] ;
variant      = ident | "@" ident | ident "-[" arbitrary "]" | "[" arbitrary-selector "]" ;
utility      = ident { "-" ident } ;            (* longest registered match wins *)
value        = ident { "-" ident } | number | fraction | "[" arbitrary "]" | "(" custom-prop ")" ;
modifier     = number | ident | "[" arbitrary "]" ;
ident        = letter { letter | digit } ;
fraction     = number "/" number ;
custom-prop  = "--" ident { "-" ident } ;
```

Underscores inside `[...]` are converted to spaces (`grid-cols-[1fr_auto]` → `1fr auto`).
`bg-(--my-var)` expands to `background-color: var(--my-var)`.

## Examples

| Class | Output (unminified, inside `@layer nb.utilities`) |
| ----- | ------------------------------------------------- |
| `p-4` | `.p-4 { padding: var(--nb-space-4); }` |
| `-mt-2` | `.-mt-2 { margin-block-start: calc(var(--nb-space-2) * -1); }` |
| `md:grid-cols-3` | `@media (width >= 48rem) { .md\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); } }` |
| `@lg:flex-row` | `@container (width >= 64rem) { .\@lg\:flex-row { flex-direction: row; } }` |
| `hover:bg-brand-600/80` | `.hover\:bg-brand-600\/80:hover { background-color: oklch(from var(--nb-color-brand-600) l c h / 0.8); }` (`@media (hover:hover)` wrapped) |
| `dark:text-neutral-50` | `@container style(--nb-scheme: dark) { .dark\:text-neutral-50 { color: var(--nb-color-neutral-50); } }` + fallbacks (see §Theme variants) |
| `group-hover:opacity-100` | `:where(.group):hover .group-hover\:opacity-100 { opacity: 1; }` |
| `has-[:checked]:ring-2` | `.has-\[\:checked\]\:ring-2:has(:checked) { … }` |
| `w-[37ch]` | `.w-\[37ch\] { inline-size: 37ch; }` |
| `p-4!` | `.p-4\! { padding: var(--nb-space-4) !important; }` |

## Theme variants (`dark:`, `light:`, `contrast:`)

Theme variants MUST resolve against the **nearest** theme, so nested islands (light inside dark, etc.) work.

1. Every theme block sets an inherited marker: `[data-nb-theme=dark] { --nb-scheme: dark; }`,
   `[data-nb-theme=light] { --nb-scheme: light; }`, and the `prefers-color-scheme` media block sets it on
   `:root:not([data-nb-theme])`.
2. **Primary output** — style query on the inherited marker (nearest ancestor wins by inheritance):
   ```css
   @container style(--nb-scheme: dark) { .dark\:x { … } }
   [data-nb-theme=dark].dark\:x { … }          /* the theme root element itself */
   ```
3. **Selector strategy** for targets lacking custom-property style queries. Style-query support cannot be detected
   with `@supports`, so the engine emits exactly **one** strategy per build, chosen from `.browserslistrc`
   (overridable via config `themeVariants: "style-query" | "selector"`). The selector strategy resolves correctly up to
   nesting depth 2:
   ```css
   :where([data-nb-theme=dark]) .dark\:x:not(:where([data-nb-theme=dark] [data-nb-theme=light]) *),
   :where([data-nb-theme=light] [data-nb-theme=dark]) .dark\:x,
   [data-nb-theme=dark].dark\:x { … }
   @media (prefers-color-scheme: dark) { :root:not([data-nb-theme]) .dark\:x:not(:where([data-nb-theme=light]) *) { … } }
   ```
   Deeper nesting under the selector strategy is documented as unsupported.
4. Tested by 001 T019 (nested islands) in all three engines.

## Arbitrary-value validation

Arbitrary values are validated against the family's `arbitrary.grammar`:

| Grammar | Accepts | Rejects |
| ------- | ------- | ------- |
| length | `<length>`, `<percentage>`, `calc()/min()/max()/clamp()` of those, `var(--*)` | anything else |
| color | named, hex, `rgb() hsl() oklch() oklab() color() color-mix()`, `var(--*)` | `url()`, `expression` |
| image-safe | gradients only (`linear-/radial-/conic-gradient`) | `url()`, `image-set()` with URLs |
| any arbitrary | — | `;`, `{`, `}`, `@`, `\`, `<`, `>`, `javascript:`, `url(`, `@import`, length > 200 chars |

Rejected candidates produce a diagnostic `{ code: "NB_ARBITRARY_REJECTED", class, reason }` and no CSS.

## Stability

Adding families/variants = minor. Renaming/removing a family, variant, or changing emitted property = major.
