# Feature Specification: Distribution & Release (npm, CDN, Download)

**Feature Branch**: `002-distribution-release`
**Created**: 2026-10-01
**Status**: Draft
**Input**: User description: "The project will be downloadable, npm installable, CDN linked for testing, and shipped to the real world."

## Clarifications

### Session 2026-10-01

- Q: Which package names should newBrush publish under? → A: `newbrush` (main) + `@newbrush/*` scope. All candidate names were unpublished on 2026-10-01; reserve the `@newbrush` org and publish a `0.0.0` placeholder of `newbrush` before public announcement.
- Q: Hosted MCP at v1.0? → A: Yes — `mcp.newbrush.dev` is part of the v1.0 launch scope (see 003).

## User Scenarios & Testing *(mandatory)*

### User Story 1 – Install from npm (Priority: P1) 🎯

A developer runs `npm i newbrush` (or pnpm/yarn/bun) and imports CSS and tooling with correct types and exports.

**Independent Test**: In a clean temp project for each package manager, install the packed tarball, import
`newbrush/css`, `newbrush/config`, and run `npx nb build`; all succeed on Node 20, 22, 24 across Linux/macOS/Windows.

**Acceptance Scenarios**:

1. **Given** a Vite/Next/Astro project, **When** `import "newbrush/css"` is used, **Then** the bundler resolves `dist/newbrush.css`.
2. **Given** TypeScript, **When** `import { defineConfig } from "newbrush/config"`, **Then** types resolve (passes `arethetypeswrong`).
3. **Given** a published version, **When** inspected on npmjs.com, **Then** it shows a provenance attestation linked to the GitHub Actions run.

---

### User Story 2 – Use from a CDN for prototyping (Priority: P1)

A user pastes one `<link>` (and optionally one `<script>`) into CodePen/HTML and everything works, including
a no-build JIT "play" mode for utilities.

**Acceptance Scenarios**:

1. **Given** `<link href="https://cdn.jsdelivr.net/npm/newbrush@1/dist/newbrush.min.css">`, **Then** components and the curated utility preset render.
2. **Given** the same via unpkg and cdnjs, **Then** identical bytes are served.
3. **Given** `<script src="…/newbrush@1/dist/play.js">`, **When** the page uses arbitrary utilities, **Then** CSS is generated in-browser (dev only, console warns "not for production").
4. **Given** docs snippets, **Then** they include SRI `integrity` hashes for pinned versions.

---

### User Story 3 – Download a release bundle (Priority: P2)

A user without Node downloads a ZIP from GitHub Releases / the docs site containing compiled CSS/JS, source maps,
themes, examples, manifest and license.

**Acceptance Scenarios**:

1. **Given** a GitHub Release `v1.2.0`, **Then** it has `newbrush-1.2.0-dist.zip`, `newbrush-1.2.0-source.zip`, `SHA256SUMS`, and generated release notes.
2. **Given** the ZIP, **When** `examples/index.html` is opened from disk, **Then** it renders fully offline.

---

### User Story 4 – Automated, safe release pipeline (Priority: P1)

Maintainers merge PRs with changesets; a bot opens a "Version Packages" PR; merging it publishes all changed packages,
CDN purges, GitHub release, docs deploy — with no manual steps and no long-lived npm tokens.

**Acceptance Scenarios**:

1. **Given** merged changesets, **When** the Version PR merges, **Then** packages publish to npm with provenance via OIDC trusted publishing.
2. **Given** a `next` pre-release mode, **Then** versions publish under the `next` dist-tag without affecting `latest`.
3. **Given** a failed post-publish smoke test (install-and-render), **Then** the pipeline alerts and the dist-tag is not moved to `latest`.

---

### User Story 5 – Versioned docs & migration (Priority: P3)

Users on older majors can read matching docs and run codemods to upgrade.

### Edge Cases

- npm name `newbrush` unavailable → fallback scope documented in research.
- CDN cache staleness after publish → purge jsDelivr for `@1` / `@latest` aliases.
- Windows path handling in CLI and glob scanning.
- Corporate proxies / offline → download ZIP path.
- Accidental publish of secrets or tests → `files` allow-list + `publint` + tarball content check.

## Requirements *(mandatory)*

- **FR-001**: Publish packages `newbrush`, `@newbrush/{tokens,engine,cli,postcss,vite,js,mcp,schema,fonts,stylelint-config}` to npm.
- **FR-002**: Each package MUST declare `exports` map, `types`, `files` allow-list, `sideEffects` (CSS true), `engines.node >=20`, `license`, `repository`, `funding`.
- **FR-003**: `newbrush` MUST expose subpaths: `.` (CSS), `./css`, `./core.css`, `./full.css`, `./components/*`, `./themes/*`, `./config`, `./manifest.json`, `./tokens`.
- **FR-004**: Every CSS artifact MUST ship unminified + `.min.css` + source maps.
- **FR-005**: Releases MUST use Changesets, Conventional Commits, and npm provenance via OIDC trusted publishing.
- **FR-006**: CDN availability via jsDelivr and unpkg (automatic from npm) and cdnjs (via auto-update config PR).
- **FR-007**: A browser `play.js` build MUST provide in-browser JIT for prototyping only.
- **FR-008**: GitHub Releases MUST include dist ZIP, source ZIP, checksums, and SBOM (CycloneDX).
- **FR-009**: Post-publish smoke tests MUST install from the registry and render a fixture page in Playwright.
- **FR-010**: Docs site MUST deploy on every release, with versioned docs per major.
- **FR-011**: Security: Dependabot/Renovate, CodeQL, OpenSSF Scorecard, `npm audit` gate; signed tags.
- **FR-012**: Pre-release channels `next` (rc/beta) and `canary` (per-commit snapshot `0.0.0-canary-<sha>`).

## Success Criteria *(mandatory)*

- **SC-001**: Time from merging the Version PR to package live on npm + CDN < 15 minutes, zero manual steps.
- **SC-002**: 100 % of releases carry npm provenance and SBOM.
- **SC-003**: Install smoke tests pass on 3 OS × 3 Node × 4 package managers before `latest` moves.
- **SC-004**: `publint` and `arethetypeswrong` report zero errors for every package.
- **SC-005**: Docs CDN snippets always reference a version that exists with valid SRI.

## Assumptions

- GitHub is the code host; GitHub Actions is the CI provider.
- npm names `newbrush` + `@newbrush` org chosen (clarified 2026-10-01); reserved as the first setup task.
- Docs hosted on Cloudflare Pages (free tier sufficient); domain to be purchased.
