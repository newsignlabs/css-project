# Implementation Plan: Distribution & Release

**Branch**: `002-distribution-release` | **Date**: 2026-10-01 | **Spec**: [spec.md](./spec.md)

## Summary

Ship every package to npm with provenance via OIDC, expose the CSS through jsDelivr/unpkg/cdnjs, attach
deterministic download bundles + SBOM to GitHub Releases, and deploy versioned docs — all triggered by
merging a Changesets "Version Packages" PR, with post-publish smoke tests gating the `latest` dist-tag.

## Technical Context

**Language/Version**: TypeScript (scripts), YAML (GitHub Actions)
**Primary Dependencies**: Changesets, tsup, publint, @arethetypeswrong/cli, size-limit, CycloneDX, Playwright
**Testing**: Tarball content tests, install matrix (npm/pnpm/yarn/bun × Node 20/22/24 × ubuntu/macos/windows), CDN fetch tests
**Target Platform**: npm registry, jsDelivr, unpkg, cdnjs, GitHub Releases, Cloudflare Pages
**Constraints**: No long-lived secrets; reproducible builds; release < 15 min

## Constitution Check

| Principle | Status | Notes |
| --------- | ------ | ----- |
| VI. Performance Budgets | ✅ | size-limit runs before publish |
| VII. Deterministic Output | ✅ | Reproducible tarballs/zips; build twice + diff in CI |
| VIII. SemVer & Stability | ✅ | Changesets + manifest diff; deprecations warn |
| IX. Secure by Construction | ✅ | OIDC, provenance, SBOM, pinned actions, least privilege |
| Others | ✅ | N/A or inherited from 001 |

## Project Structure

```text
.github/
├── workflows/
│   ├── ci.yml                 # PR: lint, test, build, visual, size, publint, attw
│   ├── release.yml            # main: changesets/action → version PR or publish
│   ├── canary.yml             # main push: 0.0.0-canary-<sha> to `canary` tag
│   ├── smoke.yml              # post-publish install/render matrix, promote dist-tag
│   ├── docs.yml               # Cloudflare Pages deploy (preview + prod)
│   ├── codeql.yml  scorecard.yml
├── renovate.json
scripts/
├── pack-release.ts            # dist ZIP + source ZIP + SHA256SUMS
├── verify-tarball.ts          # asserts files allow-list, no tests/secrets
├── sri.ts                     # computes SRI hashes → docs data file
├── purge-cdn.ts               # jsDelivr purge for alias URLs
└── cdnjs-autoupdate.json      # config submitted to cdnjs/packages
packages/css/play/             # in-browser JIT (play.js) entry
```

## Release flow

```text
PR + changeset ─► CI green ─► merge to main
                                 │
                       changesets/action
                 ┌───────────────┴───────────────┐
         pending changesets               Version PR merged
          → open/update                     → pnpm build (twice, diff)
            "Version Packages" PR           → publish --provenance (tag: next|latest-candidate)
                                            → GitHub Release (+zip, sums, SBOM)
                                            → smoke.yml (matrix install + Playwright render via CDN & npm)
                                                 ├─ pass → npm dist-tag latest, purge CDN, deploy docs
                                                 └─ fail → alert, keep previous latest, open issue
```

## Milestones

| Milestone | Scope |
| --------- | ----- |
| D1 | Package metadata, exports, publint/attw in CI, tarball verification |
| D2 | Changesets + release workflow publishing `0.x` alphas under `next` |
| D3 | CDN docs snippets + SRI + play.js + cdnjs submission |
| D4 | Release ZIP, SBOM, checksums, smoke matrix & dist-tag promotion |
| D5 | Docs deploy & versioning, security hardening, `1.0.0` launch checklist |

## Launch checklist (v1.0.0 "ship to the real world")

- [ ] All 001 success criteria met; `1.0.0-rc` soaked ≥ 2 weeks under `next`
- [ ] npm org + names secured; 2FA + trusted publishing configured
- [ ] Domain + docs live; versioned docs `/v1/`
- [ ] Announcement: blog post, GitHub Discussions, social, Product Hunt, Hacker News "Show HN"
- [ ] Templates/starters published (Vite, Next, Astro); CodePen/StackBlitz collections
- [ ] Listed on MCP registries; hosted endpoint `mcp.newbrush.dev` live with free tier (feature 003)
- [ ] Support policy: last 2 majors get security fixes for 12 months

## Complexity Tracking

None.
