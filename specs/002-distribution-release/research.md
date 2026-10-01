# Research: Distribution & Release (Phase 0)

## R-01 Versioning tool
- **Decision**: Changesets with `linked` groups for `@newbrush/*` core packages; `changesets/action` opens the Version PR.
- **Alternatives**: semantic-release (commit-message-driven, less control in monorepos), release-please (good, but Changesets is the pnpm-monorepo norm).

## R-02 npm publishing auth
- **Decision**: npm **Trusted Publishing (OIDC)** from GitHub Actions + `--provenance`. No long-lived `NPM_TOKEN`.
- **Rationale**: Eliminates token-leak supply-chain risk; provenance shows build origin on npmjs.com.

## R-03 CDN strategy
- **Decision**: jsDelivr (primary in docs; multi-CDN, China-friendly), unpkg (secondary), cdnjs via `cdnjs/packages` auto-update JSON PR.
  Docs show major-pinned URLs (`newbrush@1`) for testing and exact-pinned URLs with SRI for production. Post-publish job calls jsDelivr purge API for alias URLs.
- **Alternatives**: Self-hosted CDN (cost/ops), Cloudflare R2 bucket (possible later for the `play.js` endpoint).

## R-04 Package exports shape (newbrush)
```jsonc
{
  "name": "newbrush",
  "type": "module",
  "style": "./dist/newbrush.css",
  "unpkg": "./dist/newbrush.min.css",
  "jsdelivr": "./dist/newbrush.min.css",
  "exports": {
    ".":               { "style": "./dist/newbrush.css", "default": "./dist/newbrush.css" },
    "./css":           "./dist/newbrush.css",
    "./core.css":      "./dist/newbrush-core.css",
    "./full.css":      "./dist/newbrush-full.css",
    "./components/*":  "./dist/components/*.css",
    "./themes/*":      "./dist/themes/*.css",
    "./config":        { "types": "./dist/config.d.ts", "import": "./dist/config.js", "require": "./dist/config.cjs" },
    "./tokens":        { "types": "./dist/tokens.d.ts", "default": "./dist/tokens.js" },
    "./manifest.json": "./dist/manifest.json",
    "./package.json":  "./package.json"
  },
  "files": ["dist", "src", "LICENSE", "README.md"],
  "sideEffects": ["*.css"]
  // no "bin": the `nb` command ships only in @newbrush/cli, keeping `newbrush` free of runtime deps
}
```

## R-05 Release artifacts
- Dist ZIP built by `scripts/pack-release.ts` (deterministic zip: sorted entries, fixed mtimes) + `SHA256SUMS`.
- SBOM via `@cyclonedx/cyclonedx-npm`. Attach with `softprops/action-gh-release`.

## R-06 Docs hosting
- **Decision**: Cloudflare Pages; preview deploy per PR; production on release tag; versioned paths `/v1/`, `/v2/`.

## R-07 Supply-chain hardening
- Renovate (grouped weekly), CodeQL, OpenSSF Scorecard action, `pnpm audit --prod` gate, pinned action SHAs, `permissions:` least privilege, signed tags via gitsign.

## R-08 Clarified (session 2026-10-01)
- npm: `newbrush` + `@newbrush/*` — unpublished as of 2026-10-01; reserve org + placeholder now. Fallback only if reservation fails: `newbrush-css` / `@newbrush-css/*`.
- Still open: docs domain (placeholder `newbrush.dev`).
