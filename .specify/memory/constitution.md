# newBrush Constitution

> The non-negotiable principles that govern how newBrush is specified, designed, built, tested, and shipped.
> Every spec, plan, and task MUST pass a "Constitution Check" against this document before work starts.

**Version**: 1.0.0 | **Ratified**: 2026-10-01 | **Last Amended**: 2026-10-01

---

## Core Principles

### I. Platform-Native CSS First

newBrush is built on the modern CSS platform, not on preprocessor workarounds.

- Source styles MUST use native features: custom properties, cascade layers (`@layer`), nesting,
  container queries, `:has()`, `:where()`, logical properties, `oklch()` / `color-mix()`, `@property`,
  `light-dark()`, and the Popover / `<dialog>` APIs where behaviour is needed.
- Preprocessors (Sass/Less) MUST NOT be required by consumers. Build-time tooling (Lightning CSS)
  may lower syntax for the support matrix, never invent new syntax.
- Every rule MUST live inside a named cascade layer so consumer CSS always wins without `!important`.

### II. Tokens Are the Single Source of Truth

- All design decisions (color, type, space, radius, shadow, motion, z-index, breakpoints) MUST be
  defined once as design tokens in the W3C DTCG JSON format.
- CSS, JS/TS, JSON schema, docs tables, Figma variables and MCP responses MUST all be generated
  from those tokens. Hand-written magic values in component CSS are a defect.
- Tokens are tiered: **primitive → semantic → component**. Components consume only semantic or
  component tokens.

### III. Zero-JS by Default, Progressive Enhancement Always

- Every component MUST render and be usable with CSS alone.
- Interactive behaviour MUST use native HTML (`<details>`, `<dialog>`, `popover`, `:user-invalid`)
  first. The optional `@newbrush/js` package may only enhance, never be required.

### IV. Accessibility Is a Release Gate (NON-NEGOTIABLE)

- WCAG 2.2 AA is the floor: all semantic color pairs MUST meet contrast (verified in CI with APCA
  and WCAG 2 ratios), focus MUST be visible (`:focus-visible`), targets ≥ 24×24 CSS px.
- `prefers-reduced-motion`, `prefers-contrast`, `forced-colors` and `prefers-color-scheme` MUST be
  honoured by every component.
- Automated axe-core checks MUST pass with zero violations on every documented example.

### V. Test-First, Visually Verified

- Engine/CLI/MCP code: tests are written before implementation (red → green → refactor).
- CSS: every component and utility family has Playwright visual-regression snapshots across
  Chromium, Firefox, WebKit, light/dark, and at least three container widths.
- No PR merges with failing visual, unit, a11y, lint or size-budget checks.

### VI. Performance Budgets Are Contracts

| Artifact                                     | Budget (min + brotli) |
| -------------------------------------------- | --------------------- |
| `newbrush-core.css` (reset+tokens+base)      | ≤ 8 KB                |
| `newbrush.css` (core + all components)       | ≤ 35 KB               |
| `newbrush-full.css` (CDN, + utility preset)  | ≤ 70 KB               |
| JIT output for a typical landing page        | ≤ 15 KB               |
| `@newbrush/js` (all behaviours)              | ≤ 6 KB                |

Exceeding a budget fails CI. Raising a budget requires a constitution amendment.

### VII. Deterministic, Machine-Friendly Output

- Given the same input + config + version, every generator (CLI, PostCSS plugin, Vite plugin, MCP
  tool) MUST produce byte-identical CSS. Output ordering is stable.
- All public APIs (config, class grammar, MCP tools) MUST be described by JSON Schema / TypeScript
  types and be introspectable, so AI agents can discover and use them without reading prose docs.

### VIII. Semantic Versioning & Stability

- Public surface = class names, token names, custom property names, config schema, JS/TS API,
  CLI flags, MCP tool names + schemas. Breaking any of these requires a major version.
- Deprecations ship with a console/CLI warning and a codemod at least one minor release before removal.
- Releases are automated (Changesets), signed with npm provenance, and reproducible.

### IX. Secure & Safe by Construction

- The MCP server MUST treat all user/agent input as untrusted: schema-validated, size-limited,
  sanitised (no `url()` to arbitrary origins, no `@import`, no `expression`/`javascript:`), and
  never executes arbitrary code or touches the filesystem outside an explicit allow-list.
- Dependencies are minimal, pinned via lockfile, and scanned (npm audit, OSV, CodeQL) in CI.

### X. Simplicity & Ownership

- Prefer fewer, sharper features over a sprawling API. Each new component/utility family requires
  a spec with a real use-case.
- Docs are part of "done": no feature ships without a docs page, an example, and an MCP manifest entry.

---

## Technology Constraints

- **Language**: TypeScript 5.x (strict) for all tooling; native CSS for styles.
- **Runtime**: Node.js ≥ 20 LTS (tooling + MCP server). ESM-first, CJS shim for config loading only.
- **Package manager / monorepo**: pnpm workspaces + Turborepo.
- **CSS toolchain**: Lightning CSS (transform, minify, lower), Style Dictionary v4 (tokens).
- **Browser support**: Baseline "widely available" as of the release date — currently last 2
  versions of Chrome, Edge, Firefox, Safari (≥ 17), iOS Safari, Samsung Internet. Encoded once in
  `.browserslistrc`.
- **License**: MIT.

## Development Workflow

1. `/speckit.specify` → `spec.md` (what & why, no tech).
2. `/speckit.clarify` → resolve every `[NEEDS CLARIFICATION]`.
3. `/speckit.plan` → `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`.
4. `/speckit.tasks` → `tasks.md` (TDD-ordered, `[P]` marks parallelisable tasks).
5. `/speckit.analyze` → cross-artifact consistency check against this constitution.
6. `/speckit.implement` → execute tasks; one PR per user story where practical.
7. Conventional Commits; every PR adds a Changeset if it touches a published package.

## Governance

- This constitution supersedes all other conventions in the repository.
- Amendments require: a PR editing this file, a rationale, a migration note, and a version bump
  (MAJOR = principle removed/redefined, MINOR = principle added, PATCH = clarification).
- Every `plan.md` contains a **Constitution Check** section; violations must be listed in
  **Complexity Tracking** with justification or the plan is rejected.
