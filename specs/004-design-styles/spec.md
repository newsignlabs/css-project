# Feature Specification: Design Styles (one class re-skins the whole project)

**Feature Branch**: `004-design-styles`
**Created**: 2026-10-03
**Status**: Draft (planning only — implementation scheduled after 001 US3)
**Input**: User description: "Our CSS package has in-built default styles like pixelate, cyber, neon, glassmorphism, minimal
etc. Just by adding additional classes the entire design changes. If the body tag has a class called glassy, the entire
project will be glassy. If the class name on the same body tag is changed to minimal, the project becomes minimal. The
explaining docs will be grouped based on this idea."

## Overview

A **design style** is a complete visual personality — color treatment, surfaces, borders, radius, depth, typography,
motion and signature effects — that every newBrush component and utility adopts at once. Styles are newBrush's
signature feature: the same markup becomes glassy, neon, cyber, pixel or minimal by changing **one class on one
element**.

```html
<body class="glassy">   <!-- the whole project is glassmorphism -->
<body class="minimal">  <!-- same markup, now minimal -->
<body class="neon">     <!-- same markup, now neon -->
```

Styles are **orthogonal to themes** (feature 001 US3): a style decides *how things look*; a theme decides *light, dark or
high-contrast* and *which brand colors*. Every style works in light and dark, with any brand seed:

```html
<body class="neon" data-nb-theme="dark" style="--nb-color-brand-seed: oklch(70% 0.25 330)">
```

### Style catalogue

| Style | Class | Personality | Signature treatments |
| ----- | ----- | ----------- | -------------------- |
| Default | *(none)* | The current newBrush look: calm, crisp, accessible | Token defaults |
| Minimal | `minimal` | Quiet, editorial, content-first | Hairline borders, no shadows, small radius, generous whitespace, restrained color |
| Glassy | `glassy` | Glassmorphism: depth through translucency | Translucent surfaces, backdrop blur + saturation, light edges, large radius, ambient gradient backdrop |
| Neon | `neon` | Night-life glow, dark-first | Near-black surfaces, saturated brand/accent glows (box- and text-shadow), luminous focus rings, outlined controls |
| Cyber | `cyber` | Cyberpunk HUD, dark-first | Notched/angled corners (`clip-path`), mono/condensed type, uppercase labels, scanline overlay, hazard accents, glitch hover |
| Pixel | `pixel` | 8-bit / pixelate | Zero radius, stepped pixel borders, chunky 4 px grid, pixel font (opt-in) with mono fallback, `steps()` motion, pixelated images |

v1.1 candidates (same mechanism, not in v1.0 scope): `brutal` (neo-brutalism), `soft` (neumorphism), `paper`,
`terminal`, `aurora`, `clay`.

## Clarifications

### Session 2026-10-03 (open — resolve with `/speckit.clarify` before implementation)

- Q1 Class naming: bare `glassy` (as described) vs prefixed `nb-glassy`? → **Recommended**: bare names as the public API
  (they are the product's signature), with `data-nb-style="glassy"` as an equivalent attribute and an optional
  `prefix.styles` config for projects that need namespacing. `nb doctor` warns on collisions with existing CSS.
- Q2 Exact names: `glassy` vs `glass`, `pixel` vs `pixelate`? → **Recommended**: `glassy`, `pixel` canonical; `glass` and
  `pixelate` accepted as aliases in v1.0 (documented, not deprecated).
- Q3 Scope of a style: visual skin only, or also density/spacing? → **Recommended**: skin **plus** a density token
  (`--nb-density`) per style (minimal = airy, pixel = 4 px grid); never structural layout changes, so switching styles
  cannot break a page.
- Q4 Packaging: are styles in `newbrush.css` by default? → **Recommended**: yes — the "add one class" promise must work
  with a single `<link>`. JIT/bundler builds can drop unused styles via config `styles: [...]`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 – Switch the whole project's design with one class (Priority: P1) 🎯 MVP

A developer adds `class="glassy"` to `<body>`; every component, layout primitive and token-driven utility on the page
becomes glassmorphic. Changing the class to `minimal` re-skins everything instantly, with no markup changes.

**Why this priority**: This is the feature's promise and newBrush's differentiator.

**Independent Test**: Render the plain-html showcase with each of the five style classes on `<body>`; every component
visibly adopts the style (screenshots differ from default in the expected ways), with zero axe violations.

**Acceptance Scenarios**:

1. **Given** the showcase page with `newbrush.css` linked, **When** `class="glassy"` is added to `<body>`, **Then** cards,
   navbar, modal, inputs and buttons render translucent with backdrop blur, and the page gets the glassy ambient background.
2. **Given** `class="glassy"`, **When** it is replaced by `minimal` at runtime, **Then** the page re-renders minimal without
   reload, layout shift or leftover glass effects.
3. **Given** no style class, **Then** the page renders exactly as today (default style; no regression in existing snapshots).
4. **Given** `data-nb-style="neon"` instead of a class, **Then** the result is identical to `class="neon"`.

---

### User Story 2 – Styles compose with themes and brand colors (Priority: P1)

Every style works in light, dark and high-contrast, and with any brand seed color, without the author doing anything.

**Acceptance Scenarios**:

1. **Given** `class="neon" data-nb-theme="light"`, **Then** a light neon variant renders (style declares light and dark
   palettes; dark-first styles default to dark when the OS preference is dark or no theme is set).
2. **Given** a brand seed `oklch(65% 0.2 150)`, **When** `glassy` or `neon` is applied, **Then** tints and glows use the
   brand hue.
3. **Given** `data-nb-theme="contrast"` or `forced-colors: active`, **Then** decorative effects (glow, blur, scanlines,
   notches) are removed and contrast requirements are met for every style.

---

### User Story 3 – Style islands (Priority: P2)

A section can use a different style than the page (e.g. a neon promo card inside a minimal site). The nearest style wins,
exactly like theme islands.

**Acceptance Scenarios**:

1. **Given** `<body class="minimal">` containing `<section class="neon">`, **Then** the section is neon and the rest minimal.
2. **Given** a nested `<div class="style-default">` inside a styled page, **Then** that subtree uses the default style.

---

### User Story 4 – Style-aware utilities (Priority: P2)

Developers fine-tune per style with variants: `glassy:bg-surface/40`, `neon:shadow-none`, `pixel:rounded-none`, resolved
against the nearest style (same strategy as `dark:`).

**Acceptance Scenarios**:

1. **Given** `class="p-6 neon:p-8"` inside a neon island, **Then** padding is 8; outside it, 6.
2. **Given** utilities without style variants, **Then** they keep working under every style and still win over style
   recipes (utilities stay the last layer).

---

### User Story 5 – Documentation grouped by style (Priority: P1)

The docs are organised around styles: a global style switcher re-skins the entire docs site, each style has a gallery
showing every component in that style, and every component page previews all styles side by side.

**Acceptance Scenarios**:

1. **Given** the docs header style switcher, **When** "Cyber" is chosen, **Then** the whole docs site (including live
   examples) renders cyber, and the choice persists across pages.
2. **Given** the "Styles" section, **Then** each style has: overview & personality, "use it" snippet, gallery of all
   components, tokens it changes, accessibility notes, and a "pairs well with" theme/brand suggestions block.
3. **Given** any component page, **Then** a style tab strip previews the example in all styles with copyable markup
   (markup is identical; only the body class changes).
4. **Given** the getting-started guide, **Then** step 2 is "Choose your style".

---

### User Story 6 – AI agents pick and switch styles (Priority: P2)

Through the MCP server (feature 003), an agent lists styles, builds pages in a chosen style, and restyles existing
output by changing a single class.

**Acceptance Scenarios**:

1. **Given** `list_styles`, **Then** each style returns name, aliases, description, personality keywords, preferred scheme
   and preview HTML.
2. **Given** `build_page { style: "pixel", ... }`, **Then** the document's `<body>` carries `class="pixel"` and the
   returned CSS includes only the pixel style recipes.
3. **Given** a user query "make it cyberpunk", **Then** the `restyle` prompt guides the agent to set `style: "cyber"`.

---

### User Story 7 – Author a custom style (Priority: P3)

A design team creates its own style (e.g. `acme`) from tokens plus scoped recipes, scaffolded from an existing one.

**Acceptance Scenarios**:

1. **Given** `nb style create acme --from glassy`, **Then** a style file (DTCG overrides + recipe CSS) is scaffolded and
   registered in config; `class="acme"` works after build and passes the same contrast/a11y gates as built-in styles.

### Edge Cases

- Two style classes on one element (`glassy neon`) → last-declared style in the cascade wins; `nb doctor` and the MCP
  `validate_markup` tool warn.
- Unknown style class → no effect (it is just a class); `nb doctor` lists unknown `data-nb-style` values.
- `backdrop-filter` unsupported, or `prefers-reduced-transparency: reduce` → glassy falls back to opaque surfaces.
- `prefers-reduced-motion: reduce` → glitch, flicker, scanline drift and pulsing glows are disabled.
- Photosensitivity: no effect flashes more than 3 times per second (WCAG 2.3.1) in any style.
- Pixel font not installed → monospace fallback with identical metrics strategy (no layout shift between font states).
- Printing → styles collapse to the default print stylesheet (no blur, glow, scanlines, dark backgrounds).
- Third-party content inside a styled page → styles affect only newBrush classes, tokens and base elements, never
  arbitrary unclassed widgets beyond inherited color/font.
- Style switching at runtime with View Transitions → optional cross-fade via `@newbrush/js`; no transition when reduced motion.

## Requirements *(mandatory)*

**Activation & scoping**
- **FR-001**: Applying a style MUST require only a class (`glassy`, `minimal`, `neon`, `cyber`, `pixel`) or
  `data-nb-style` attribute on any element; descendants adopt it.
- **FR-002**: The nearest style ancestor MUST win (style islands), with a `style-default` reset class.
- **FR-003**: The default style MUST be byte-for-byte unchanged when no style class is present (no regression).
- **FR-004**: Styles MUST be switchable at runtime by changing the class, with no JavaScript required.

**Architecture**
- **FR-005**: Styles MUST be expressed primarily as token overrides (semantic + component tier) in DTCG, with a new
  `nb.styles` cascade layer between `nb.components` and `nb.utilities` for recipes tokens cannot express.
- **FR-006**: Style recipes MUST use zero-specificity selectors scoped to the style (`:where(.glassy) .nb-card`), consume
  tokens only, and pass the existing Stylelint rules.
- **FR-007**: Every style MUST define light and dark palettes and declare a `preferredScheme` used when no theme is set.
- **FR-008**: Styles MUST derive tints from the brand/accent scales so brand seeds (001 US3) apply in every style.
- **FR-009**: Every component (current and future) MUST look intentional in every built-in style; adding a component
  requires style recipes or explicit "tokens suffice" sign-off (definition of done).
- **FR-010**: Optional style fonts MUST ship via `@newbrush/fonts` (opt-in); defaults use system stacks (001 FR-022).

**Accessibility (constitution §IV)**
- **FR-011**: Every style × theme MUST pass the WCAG 2.2 AA contrast suite and axe on every documented example.
- **FR-012**: Decorative effects MUST be removed under `forced-colors`, the contrast theme, `prefers-reduced-motion`,
  `prefers-reduced-transparency`, and print.
- **FR-013**: Focus indicators MUST remain at least as visible as the default style's in every style.

**Utilities, engine & manifest**
- **FR-014**: The engine MUST provide style variants (`glassy:`, `neon:` …) resolving the nearest style.
- **FR-015**: `manifest.json` MUST list styles (name, aliases, description, keywords, preferred scheme, tokens changed,
  recipes, fonts, preview HTML) so docs and the MCP server are generated from it.
- **FR-016**: Config MUST allow choosing which styles a build includes (`styles: "all" | string[] | false`) and adding
  custom styles.

**Distribution & budgets (constitution §VI)**
- **FR-017**: `newbrush.css` MUST include all built-in styles; each style is also published as `dist/styles/<name>.css`.
- **FR-018**: Each style MUST cost ≤ 6 kB brotli; all v1.0 styles together ≤ 25 kB; `newbrush.css` stays ≤ 35 kB.

**Docs & MCP**
- **FR-019**: Docs information architecture MUST be grouped by style (US5).
- **FR-020**: The MCP server MUST expose `list_styles`, a `style` argument on `build_page`/`compose_component`/
  `generate_css`, resource `newbrush://styles/{name}`, and a `restyle` prompt.

### Key Entities

- **Style**: name, aliases, title, description, personality keywords, preferredScheme, token overrides per scheme,
  recipes (scoped CSS), fonts (optional), density, effects list, a11y notes, preview HTML, status, since.
- **Style recipe**: scoped CSS for one component or base element under one style; tokens only.
- **Style variant**: engine variant named after a style, resolving the nearest style ancestor.

## Success Criteria *(mandatory)*

- **SC-001**: Switching `<body>` between all six styles requires changing exactly one class and zero other markup.
- **SC-002**: 100 % of documented examples × 6 styles × 3 themes pass axe and the contrast suite.
- **SC-003**: In a user test, ≥ 80 % of participants correctly identify each style from screenshots (styles are distinct).
- **SC-004**: Style budgets in FR-018 are met; switching styles at runtime causes no layout shift (CLS = 0) beyond
  intentional density changes.
- **SC-005**: An MCP agent asked for "a cyberpunk landing page" produces `class="cyber"` on the first `build_page` call in
  ≥ 90 % of eval runs.

## Assumptions

- Builds on 001 US3 (theming, seed scales, contrast checker) — styles reuse that machinery.
- v1.0 ships five styles plus default; more follow the same contract.
- Style fonts are licensed OFL (e.g. a pixel font) and self-hosted via `@newbrush/fonts`.
