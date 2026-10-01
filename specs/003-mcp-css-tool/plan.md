# Implementation Plan: newBrush MCP Server

**Branch**: `003-mcp-css-tool` | **Date**: 2026-10-01 | **Spec**: [spec.md](./spec.md)

## Summary

A TypeScript MCP server (`@newbrush/mcp`) wrapping `@newbrush/engine` and the build `manifest.json`. It exposes
discovery (resources, search), generation (`generate_css`, `compose_component`, `build_page`, `create_theme`)
and quality tools (`validate_markup`, `explain_class`, `convert_markup`) over stdio and Streamable HTTP, plus a
transport-free library and REST mirror. Output is deterministic, sanitised and accessible by construction.

## Technical Context

**Language/Version**: TypeScript 5.6+, Node ≥ 20; Workers-compatible core
**Primary Dependencies**: @modelcontextprotocol/sdk, zod, @newbrush/engine, @newbrush/schema, parse5, minisearch, hono (HTTP/REST + Workers)
**Testing**: Vitest (unit, golden), MCP Inspector CLI scripted e2e, Playwright + axe on rendered blueprints, html-validate, fast-check fuzzing, LLM eval harness (SC-003)
**Target Platform**: Local stdio (npx), Cloudflare Workers, Docker
**Performance Goals**: SC-001 latencies; cold start < 300 ms
**Constraints**: No LLM calls, no filesystem writes, no outbound network; input limits per spec

## Constitution Check

| Principle | Status | Notes |
| --------- | ------ | ----- |
| II. Tokens Single Source | ✅ | Reads tokens only via manifest |
| IV. Accessibility Gate | ✅ | Every blueprint axe + html-validate tested |
| V. Test-First | ✅ | Tool contracts tested before implementation |
| VI. Performance Budgets | ✅ | SC-004 page CSS budget in tests |
| VII. Deterministic, Machine-Friendly | ✅ | Pure functions, output schemas, annotations |
| VIII. SemVer | ✅ | Tool names + schemas are public API |
| IX. Secure | ✅ | Escaping, URL allow-list, limits, no I/O |
| X. Simplicity | ✅ | Thin layer over engine |

## Project Structure

```text
packages/mcp/
├── package.json             # bin: newbrush-mcp; exports: ".", "./lib", "./http"
├── server.json              # MCP Registry metadata
├── Dockerfile
├── src/
│   ├── index.ts             # CLI entry: --transport stdio|http --port --allow-raw-html
│   ├── server.ts            # createServer(): registers tools/resources/prompts
│   ├── lib/                 # transport-free tool implementations
│   │   ├── generate-css.ts  search.ts  get-component.ts  get-tokens.ts
│   │   ├── compose-component.ts  build-page.ts  create-theme.ts
│   │   ├── validate-markup.ts  explain-class.ts  convert-markup.ts
│   ├── schemas/             # zod schemas (input + output) — single source for contracts/
│   ├── blueprints/          # section blueprints: <name>/{index.ts,variants.ts,meta.ts}
│   ├── html/                # escaping tagged template, sanitizer, document shell
│   ├── resources/           # newbrush:// resource handlers
│   ├── prompts/             # prompt templates
│   ├── search/              # minisearch index + synonyms
│   ├── convert/             # tailwind.ts, bootstrap.ts mapping tables
│   └── transports/          # stdio.ts, http.ts (hono + Streamable HTTP, auth, rate limit, CORS)
├── worker/                  # Cloudflare Workers entry + wrangler.toml
└── test/{unit,golden,e2e,a11y,fuzz,evals}/
```

## Tool pipeline (build_page)

```text
PageSpec (zod-validated)
  → resolve theme (seeds → tokens; contrast fix)       [engine + tokens]
  → for each section: blueprint(props, slots) → HTML   [escaped templates]
  → collect classes from produced HTML                  [extractCandidates]
  → generate(classes, theme) → minimal CSS              [engine]
  → wrap: <!doctype html><html lang dir data-nb-theme>…<style>css</style>…
  → post-validate (parse5 + sanitizer) → structuredContent { html, css, stats, diagnostics }
```

## Milestones

| Milestone | Scope |
| --------- | ----- |
| P0 | Package scaffold, stdio server, `generate_css`, `explain_class`, manifest resources |
| P1 | `search`, `get_component`, `get_tokens`, prompts |
| P2 | Blueprints v1 + `compose_component` + `build_page` + a11y/HTML validation suite |
| P3 | `create_theme`, `validate_markup`, `convert_markup` |
| P4 | Streamable HTTP + REST mirror + auth/rate limit; Workers + Docker deploy |
| P5 | Registry listing, client config docs, LLM eval harness (SC-003), MCP Apps preview |

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| Hosted remote service (ops burden) | Browser-based & SaaS builders can't spawn stdio processes | stdio-only excludes web clients and website builders |
