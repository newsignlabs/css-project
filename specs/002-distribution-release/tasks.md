# Tasks: Distribution & Release

**Input**: `/specs/002-distribution-release/` · **Depends on**: 001 Phase 2 (build exists)

## Phase 1: Setup (D1)

- [ ] T001 Verify/secure npm names (`newbrush`, `@newbrush` org) and domain; record outcome in research.md R-08
- [ ] T002 [P] Add complete `package.json` metadata + `exports` for every package (research R-04)
- [ ] T003 [P] `scripts/verify-tarball.ts`: `npm pack --dry-run --json`, assert allow-list, no `test/`, `.env`, fixtures
- [ ] T004 [P] Add `publint` and `@arethetypeswrong/cli` to CI for each package
- [ ] T005 Reproducibility check in CI: build twice, `diff -r dist/`

## Phase 2: User Story 1 & 4 – npm + automated pipeline (P1) (D2)

### Tests first
- [ ] T006 [P] [US1] Install-matrix workflow (`smoke.yml`) consuming a packed tarball: npm/pnpm/yarn/bun × Node 20/22/24 × 3 OS; runs `nb build` + imports
- [ ] T007 [P] [US1] Bundler fixtures (Vite, Next, Astro) resolving `newbrush/css` and `newbrush/config`

### Implementation
- [ ] T008 [US4] Changesets config + `release.yml` with `changesets/action` (version PR / publish)
- [ ] T009 [US4] Configure npm Trusted Publishing (OIDC) per package; `publish --provenance --access public`
- [ ] T010 [US4] Pre-release mode `next`; `canary.yml` snapshot releases
- [ ] T011 [US4] Smoke gating: publish to `next`/candidate tag → run smoke against registry → promote `latest` via `npm dist-tag`
- [ ] T012 [P] [US4] Failure alerting: auto-open issue with logs on failed smoke

## Phase 3: User Story 2 – CDN (P1) (D3)

- [ ] T013 [P] [US2] Test: fetch artifacts from jsDelivr/unpkg after canary publish, compare SHA with tarball
- [ ] T014 [US2] Add `unpkg`, `jsdelivr`, `style` fields; ensure `.min.css` + maps exist
- [ ] T015 [US2] `play.js` browser JIT build (engine + MutationObserver, dev warning banner in console)
- [ ] T016 [US2] `scripts/sri.ts` → `apps/docs/src/data/cdn.json` consumed by docs snippets
- [ ] T017 [US2] `scripts/purge-cdn.ts` (jsDelivr purge API for `@1`, `@latest`)
- [ ] T018 [US2] Submit cdnjs auto-update config PR (`cdnjs/packages`)
- [ ] T019 [P] [US2] `examples/cdn/index.html` + CodePen/StackBlitz templates

## Phase 4: User Story 3 – Downloads (P2) (D4)

- [ ] T020 [P] [US3] Test: unzip dist ZIP, open `examples/index.html` via `file://` in Playwright offline
- [ ] T021 [US3] `scripts/pack-release.ts` deterministic ZIPs + `SHA256SUMS`
- [ ] T022 [US3] CycloneDX SBOM generation
- [ ] T023 [US3] Attach assets to GitHub Release with generated notes from changesets
- [ ] T024 [P] [US3] Docs "Download" page linking latest release assets

## Phase 5: User Story 5 – Docs versioning & migration (P3) (D5)

- [ ] T025 [US5] `docs.yml` Cloudflare Pages: preview per PR, prod per release, `/vN/` snapshots
- [ ] T026 [P] [US5] Codemod package scaffold `@newbrush/codemod` (jscodeshift + HTML class rewriter)
- [ ] T027 [P] [US5] Migration guides from Bootstrap 5 and Tailwind 4 (class mapping tables generated from manifest)

## Phase 6: Hardening & launch

- [ ] T028 [P] Renovate, CodeQL, OpenSSF Scorecard, pinned action SHAs, `permissions: read-all` defaults
- [ ] T029 [P] `SECURITY.md` (disclosure policy), `SUPPORT.md`, branch protection + required checks
- [ ] T030 Execute v1.0.0 launch checklist (plan.md)

## Dependencies

D1 → D2 → (D3 ∥ D4) → D5. T015 requires 001 T052 (`generate()` browser-safe).
