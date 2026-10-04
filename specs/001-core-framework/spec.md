# Feature Specification: newBrush Core Framework

**Feature Branch**: `001-core-framework`
**Created**: 2026-10-01
**Status**: Draft
**Input**: User description: "A high-end CSS framework in the league of Bootstrap and Tailwind, named newBrush,
for building modern CSS designs — offering both ready-made components and composable utilities, themeable,
and usable by humans and AI agents alike."

## Overview

newBrush is a **hybrid** CSS framework: a token-driven design system that ships

1. **Components** (Bootstrap-like): polished, accessible, drop-in classes such as `nb-btn`, `nb-card`, `nb-navbar`.
2. **Utilities** (Tailwind-like): atomic classes with variants (`p-4`, `md:grid-cols-3`, `hover:bg-brand-600`, `dark:text-neutral-50`)
   generated on demand from a config, or used from a curated prebuilt set.
3. **Themes**: a token layer that re-skins every component and utility at once (light/dark/high-contrast + brand themes).

Its differentiator is that it is *platform-native* (modern CSS only, no runtime) and *machine-readable*
(every token, class and component is described by a manifest an AI agent can query — see feature 003).

## Clarifications

### Session 2026-10-01

- Q: Should utility classes carry a prefix by default? → A: Unprefixed (`p-4 md:flex`); components keep the `nb-` prefix; a utility prefix is opt-in via config (FR-009).
- Q: What should the default font be? → A: System UI font stack by default (zero download); variable fonts ship in an opt-in `@newbrush/fonts` package (FR-022).
- Q: npm package names? → A: `newbrush` (main CSS package) + `@newbrush/*` scope for tooling (see 002).
- Default applied (not asked): Figma — DTCG→Figma Variables export at v1.0; full Figma UI kit deferred to v1.1.

## User Scenarios & Testing *(mandatory)*

### User Story 1 – Drop-in styling via a single stylesheet (Priority: P1) 🎯 MVP

A developer adds one `<link>` to an HTML page and immediately gets a modern reset, beautiful typography,
and a set of components they can apply with class names — no build step.

**Why this priority**: This is the "Bootstrap moment": zero-config value. It proves tokens, base styles and
components work end-to-end and is the foundation every other story builds on.

**Independent Test**: Open `examples/plain-html/index.html` which links only `dist/newbrush.css`; every
documented component renders correctly in Chromium, Firefox and WebKit with no console errors and zero axe violations.

**Acceptance Scenarios**:

1. **Given** an unstyled HTML page, **When** `newbrush.css` is linked, **Then** headings, paragraphs, lists,
   tables, forms and code blocks get consistent, readable defaults (fluid type scale, vertical rhythm).
2. **Given** a `<button class="nb-btn nb-btn--primary">`, **When** rendered, **Then** it shows the primary
   style with visible hover, active, focus-visible and disabled states.
3. **Given** the OS is in dark mode, **When** the page loads, **Then** all components switch to the dark
   theme automatically; **And** `data-nb-theme="light"` on `<html>` forces light.
4. **Given** consumer CSS `.nb-btn { border-radius: 0 }` written *without* layers, **When** loaded after
   newBrush, **Then** it wins without `!important`.

---

### User Story 2 – Utility-first composition with on-demand generation (Priority: P1)

A developer using a bundler writes utility classes in their templates; newBrush scans the source files and
emits only the CSS for classes actually used, including responsive, state, dark-mode and container variants.

**Why this priority**: Utility-first is the dominant modern workflow (Tailwind). Without it newBrush cannot
compete at the "high-end" tier, and it is the same engine the MCP server reuses.

**Independent Test**: In `examples/vite-app`, add `class="grid md:grid-cols-3 gap-6 p-8 hover:shadow-lg"`;
the generated CSS contains exactly those rules (and their variants) and nothing unused.

**Acceptance Scenarios**:

1. **Given** content files containing `md:px-6`, **When** the build runs, **Then** output contains a rule
   for `.md\:px-6` inside the `md` media/container query and nothing for unused classes.
2. **Given** an arbitrary value `w-[37ch]`, **When** built, **Then** a valid rule `width: 37ch` is emitted;
   **And** an invalid one `w-[;evil]` is rejected with a warning, not emitted.
3. **Given** a watch session, **When** a new class is added to a file, **Then** CSS updates in < 50 ms (p95).
4. **Given** the same input twice, **When** built, **Then** output is byte-identical.

---

### User Story 3 – Theming and brand customisation (Priority: P2)

A design lead defines brand colors, fonts, radius and density in a config file (or by overriding CSS custom
properties) and every component + utility adopts the brand, with accessible contrast guaranteed.

**Why this priority**: Customisation is what turns a framework into a product's design system.

**Independent Test**: Set `theme.colors.brand = "oklch(62% 0.19 255)"` in `newbrush.config.ts`; rebuild;
all brand-tinted components update and the contrast report shows no AA failures.

**Acceptance Scenarios**:

1. **Given** a single brand seed color, **When** built, **Then** a full 50–950 scale is generated in OKLCH
   with perceptually even steps, and semantic tokens (`--nb-color-accent`, `--nb-color-on-accent`) map to it.
2. **Given** a brand color that would produce failing contrast for `on-accent` text, **When** built, **Then**
   the build warns and auto-selects the nearest passing foreground.
3. **Given** no build step, **When** a user sets `--nb-color-brand-seed` in their own CSS, **Then** components
   re-tint at runtime via relative color syntax / `color-mix()`.
4. **Given** `data-nb-theme="<name>"` on any element, **When** rendered, **Then** that subtree uses the theme
   (scoped theming).

---

### User Story 4 – Rich component library (Priority: P2)

A developer builds a full application UI (dashboard, marketing site, docs) using only newBrush components.

**Acceptance Scenarios**:

1. **Given** the component catalogue (below), **When** each is used per docs, **Then** it renders correctly
   in all supported browsers, both themes, LTR and RTL, and at narrow/medium/wide container sizes.
2. **Given** a component inside a narrow sidebar, **When** rendered, **Then** it adapts to its *container*
   width (container queries), not the viewport.

**Component catalogue v1.0** (each with variants, sizes, states):
Layout — container, stack, cluster, grid, sidebar layout, switcher, center, cover, frame (aspect).
Content — typography/prose, code, kbd, blockquote, table, list-group, divider, avatar, badge, chip/tag.
Actions — button (+ group, icon button), link, split button, FAB.
Forms — input, textarea, select, checkbox, radio, switch, range, file, input-group, floating label, validation states, fieldset.
Navigation — navbar, sidebar/nav rail, tabs, breadcrumb, pagination, stepper, menu/dropdown (popover), command palette shell.
Feedback — alert, toast, progress (bar/ring), spinner, skeleton, empty state, tooltip (popover/anchor).
Overlay — modal (`<dialog>`), drawer/sheet, popover, accordion (`<details>`).
Data — card, stat/KPI, timeline, description list, data-table styling.
Marketing — hero, feature grid, pricing table, testimonial, CTA band, footer, logo cloud.

---

### User Story 5 – Modern visual effects & motion (Priority: P3)

Designers can apply high-end visual treatments — glass/frosted surfaces, gradient meshes, glow, layered
elevation, view transitions and scroll-driven reveal animations — that degrade gracefully.

**Acceptance Scenarios**:

1. **Given** `prefers-reduced-motion: reduce`, **When** any animation utility is used, **Then** motion is
   removed or replaced by an opacity cross-fade.
2. **Given** a browser lacking scroll-driven animations, **When** `nb-reveal` is used, **Then** content is
   simply visible (no hidden content).

---

### User Story 6 – Documentation & playground (Priority: P2)

A developer discovers, previews and copies any component, utility or token from a documentation site with
live examples, theme switcher, and an in-browser playground.

**Acceptance Scenarios**:

1. **Given** the docs site, **When** a user searches "button", **Then** the button page, related utilities and
   tokens appear in < 200 ms.
2. **Given** any example, **When** "Copy" is clicked, **Then** HTML is copied; **And** "Open in playground" loads it editable.

### Edge Cases

- Consumer already uses Tailwind/Bootstrap on the page → class-name collisions must be avoidable via a configurable prefix.
- RTL documents (`dir="rtl"`) → logical properties make all components mirror correctly.
- Windows High Contrast / `forced-colors: active` → borders and focus rings remain visible using system colors.
- Print media → sensible print stylesheet (no backgrounds, URLs shown for links in prose).
- Very old browsers outside matrix → content remains readable (no invisible text), layout may simplify.
- Arbitrary values containing injection attempts → rejected by the class parser.
- Huge content sets (10k+ files) → scanner stays under 2 s cold build.

## Requirements *(mandatory)*

### Functional Requirements

**Tokens & theming**
- **FR-001**: Framework MUST define all design tokens in DTCG JSON, tiered primitive → semantic → component.
- **FR-002**: Framework MUST expose every token as a CSS custom property prefixed `--nb-`.
- **FR-003**: Framework MUST ship light, dark and high-contrast themes; dark MUST auto-follow `prefers-color-scheme`
  and be overridable via `data-nb-theme` at any DOM scope.
- **FR-004**: Framework MUST generate complete color scales from a single seed color in OKLCH.
- **FR-005**: Framework MUST verify contrast of all semantic fg/bg pairs at build time and fail/warn per config.

**Architecture**
- **FR-006**: All CSS MUST be placed in ordered cascade layers: `nb.reset, nb.tokens, nb.base, nb.layout, nb.components, nb.utilities`. *(Feature 004 plans an `nb.styles` layer between components and utilities, pending a constitution amendment.)*
- **FR-007**: Framework MUST use logical properties exclusively for direction-sensitive styling.
- **FR-008**: Components MUST be responsive to container size via container queries where layout depends on width.
- **FR-009**: A configurable class prefix MUST be supported. Defaults: components `nb-`, utilities unprefixed; `nb doctor` MUST warn when Tailwind/Bootstrap are detected alongside unprefixed utilities.

**Utilities engine**
- **FR-010**: Engine MUST parse the class grammar defined normatively in `contracts/class-grammar.md` (informally: `[variant:]*[-]utility[-value][/modifier][!]`, where value may be a token key, fraction, `[arbitrary]` or `(--custom-prop)`, and value and modifier may combine, e.g. `bg-brand-600/80`).
- **FR-011**: Engine MUST support variants: responsive (`sm md lg xl 2xl`), container (`@sm`…`@2xl`), state
  (`hover focus focus-visible active disabled checked invalid user-invalid open placeholder`), structural
  (`first last odd even empty`), relational (`group-*`, `peer-*`, `has-*`), theme (`dark light contrast`),
  motion (`motion-safe motion-reduce`), direction (`ltr rtl`), print, and `supports-[...]`.
- **FR-012**: Engine MUST scan configured content globs and emit only used classes (JIT), with safelist/blocklist.
- **FR-013**: Engine MUST validate arbitrary values against a per-property allow-list grammar.
- **FR-014**: Engine MUST be usable as a library (pure function `generate(classes, config) → css`), CLI, PostCSS plugin and Vite plugin.
- **FR-015**: Engine MUST provide `@apply`-equivalent composition (`@nb-apply`) for authoring custom components.

**Components & effects**
- **FR-016**: Framework MUST deliver the v1.0 component catalogue defined in User Story 4.
- **FR-017**: Every component MUST work without JavaScript; optional `@newbrush/js` MAY add enhancements (focus trap polyfill, toast queue, roving tabindex).
- **FR-018**: Framework MUST provide motion tokens and effect utilities (glass, gradient, glow, elevation, view-transition, scroll-reveal) honouring reduced-motion.

**Metadata (for agents & tooling)**
- **FR-019**: Build MUST emit `manifest.json` describing every token, utility family, variant and component
  (name, description, slots/anatomy, variants, states, example HTML, a11y notes).
- **FR-020**: Build MUST emit TypeScript types for config and class names (for editor autocompletion).

**Docs**
- **FR-021**: Documentation site MUST include a page per component/utility family/token group with live, copyable examples generated from the manifest, organised around design styles per feature 004 (global style switcher, style galleries, per-component style tabs).
- **FR-022**: Default typography MUST use a system UI font stack with no font downloads; an opt-in `@newbrush/fonts` package MUST provide self-hostable variable fonts (`font-display: swap`, subsetted WOFF2) wired to the `font.family.*` tokens.

### Key Entities

- **Token**: name, tier, type (color, dimension, fontFamily, duration, cubicBezier, shadow…), value, per-theme overrides, description.
- **Theme**: name, base (light/dark), token overrides, color-scheme.
- **Utility family**: name (e.g. `padding`), class pattern(s), CSS property map, value source (token scale | arbitrary grammar), supported variants.
- **Variant**: name, kind (media | container | selector | at-rule), wrapper template, sort order.
- **Component**: name, anatomy (parts/classes), modifiers, sizes, states, required HTML structure, ARIA requirements, tokens consumed.
- **Config**: prefix, content globs, theme extensions, enabled families/components, safelist, output options.

## Success Criteria *(mandatory)*

- **SC-001**: A first-time user goes from zero to a styled page in under 2 minutes using only the CDN link.
- **SC-002**: 100 % of documented examples pass axe-core with zero violations and visual regression in 3 engines.
- **SC-003**: All size budgets from the constitution are met at v1.0.
- **SC-004**: JIT rebuild p95 < 50 ms; cold build of a 1 000-file project < 1 s and of a 10 000-file project < 2 s.
- **SC-005**: Changing a single brand seed re-themes 100 % of brand-tinted surfaces with no AA contrast failures.
- **SC-006**: Lighthouse accessibility and best-practices = 100 on the docs site.

## Assumptions

- Target audience: frontend developers, designers, and AI agents/MCP clients generating UIs.
- Browser support follows the constitution (Baseline widely available, Safari ≥ 17).
- Fonts: system stack by default; `@newbrush/fonts` opt-in (clarified 2026-10-01).
- Icons are out of scope for v1.0 (framework is icon-library agnostic; documents pairing with Lucide/Phosphor).
- Framework-specific component wrappers (React/Vue/Svelte) are out of scope for v1.0; class-based API works everywhere.
