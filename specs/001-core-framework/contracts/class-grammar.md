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
| `dark:text-neutral-50` | `:where([data-nb-theme=dark]) .dark\:text-neutral-50, …media fallback… { color: var(--nb-color-neutral-50); }` |
| `group-hover:opacity-100` | `:where(.group):hover .group-hover\:opacity-100 { opacity: 1; }` |
| `has-[:checked]:ring-2` | `.has-\[\:checked\]\:ring-2:has(:checked) { … }` |
| `w-[37ch]` | `.w-\[37ch\] { inline-size: 37ch; }` |
| `p-4!` | `.p-4\! { padding: var(--nb-space-4) !important; }` |

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
