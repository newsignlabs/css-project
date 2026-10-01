# Contributing to newBrush

Thanks for helping! newBrush is built with **spec-driven development** ([GitHub Spec Kit](https://github.com/github/spec-kit)).
Read the [constitution](.specify/memory/constitution.md) first: it is binding on every change.

## Setup

```bash
corepack enable          # or install pnpm >= 10
pnpm install
pnpm build               # builds every package via Turborepo
pnpm test                # unit tests
pnpm visual              # Playwright visual + accessibility tests
```

Node.js >= 20 is required (`.nvmrc`).

## Workflow

1. Find (or write) the task in `specs/<feature>/tasks.md`. New features need a spec first (`/speckit.specify`).
2. **Tests first**: write the failing test, then the implementation (constitution §V).
3. Keep CSS inside `nb.*` cascade layers, use logical properties, and consume tokens only. `pnpm lint` enforces this.
4. Run `pnpm lint && pnpm typecheck && pnpm test && pnpm size` before pushing.
5. If you touched a published package, add a changeset: `pnpm changeset`.
6. Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat(css): add nb-badge`).

## Repository layout

| Path | What lives there |
| ---- | ---------------- |
| `packages/tokens` | `@newbrush/tokens`: W3C DTCG design tokens + Style Dictionary build |
| `packages/schema` | `@newbrush/schema`: TypeScript types + JSON Schemas (config, manifest, component) |
| `packages/css` | `newbrush`: the framework stylesheet |
| `packages/stylelint-config` | `@newbrush/stylelint-config`: rules enforcing the constitution |
| `apps/visual-tests` | Playwright visual-regression + axe harness |
| `specs/` | Spec Kit features (spec, plan, tasks, contracts) |
