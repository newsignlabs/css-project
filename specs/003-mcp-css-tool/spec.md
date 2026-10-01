# Feature Specification: newBrush MCP Server (CSS tool for AI agents)

**Feature Branch**: `003-mcp-css-tool`
**Created**: 2026-10-01
**Status**: Draft
**Input**: User description: "The project will also cater as a css-tool for MCP servers to dynamically build CSS-based outputs
for user queries and dynamic websites."

## Overview

`@newbrush/mcp` is a Model Context Protocol server that lets any MCP-capable client (Claude, IDE agents, custom
agent backends, website builders) **discover** newBrush's design system and **generate** production-ready, minimal,
accessible CSS/HTML on demand. The server is deterministic: the LLM decides *what* to build, newBrush decides *how*
it is styled. It reuses `@newbrush/engine` in-process — no browser, no LLM calls inside the server.

## Clarifications

### Session 2026-10-01

- Q: Should a hosted MCP endpoint be part of v1.0? → A: Yes. The Streamable HTTP endpoint (`mcp.newbrush.dev`, Cloudflare Workers) is v1.0 launch scope with a free, rate-limited anonymous tier; API keys for higher limits.
- Q: Utility prefix? → A: Unprefixed by default, so tool outputs, blueprints and `convert_markup` emit Tailwind-compatible utility names.

## User Scenarios & Testing *(mandatory)*

### User Story 1 – Agent generates exact CSS for its markup (Priority: P1) 🎯

An agent writes HTML using newBrush classes and calls a tool to get the minimal CSS for exactly those classes.

**Independent Test**: Using the MCP Inspector over stdio, call `generate_css` with `{ html: "<div class='p-4 md:flex nb-btn'>" }`;
receive CSS containing tokens, those utilities and the button component, plus `rejected: []`.

**Acceptance Scenarios**:

1. **Given** HTML or a class list, **When** `generate_css` is called, **Then** it returns minimal layered CSS, stats, and diagnostics for unknown/rejected classes with suggestions ("did you mean `px-4`?").
2. **Given** the same input twice, **Then** output is byte-identical (Constitution §VII).
3. **Given** `{ mode: "inline" }`, **Then** the result is a complete `<style>` block ready to embed.

---

### User Story 2 – Agent discovers the design system (Priority: P1)

An agent with no prior knowledge lists components, searches utilities, and reads token values to compose correct markup.

**Acceptance Scenarios**:

1. **Given** `search` with "pricing table", **Then** results rank the `pricing` component, related marketing components, and example HTML.
2. **Given** resource `newbrush://components/button`, **Then** anatomy, modifiers, states, a11y requirements and examples are returned as JSON.
3. **Given** `get_tokens { group: "color", theme: "dark" }`, **Then** resolved values and CSS variable names are returned.

---

### User Story 3 – Compose components & whole pages from structured intent (Priority: P1)

A website builder agent turns a user query ("a SaaS landing page for a coffee subscription, warm brown brand, dark mode")
into a structured page spec, calls `build_page`, and gets a complete, valid, accessible HTML document with embedded minimal CSS.

**Acceptance Scenarios**:

1. **Given** `compose_component { name: "card", modifiers: ["elevated"], slots: { title, body, actions } }`, **Then** valid HTML (escaped text) + CSS are returned.
2. **Given** a page spec with sections `[hero, feature-grid, pricing, testimonial, footer]` and `theme.seeds.brand`, **When** `build_page` runs, **Then** a full HTML5 document is returned that passes axe with zero violations and the HTML validator.
3. **Given** `output: "fragments"`, **Then** HTML and CSS are returned separately for injection into an existing site.

---

### User Story 4 – Dynamic theming for user/brand context (Priority: P2)

An agent creates a theme from brand colors (or a logo's palette supplied as colors) and applies it to subsequent output.

**Acceptance Scenarios**:

1. **Given** `create_theme { name: "acme", seeds: { brand: "#7c3aed" }, colorScheme: "both" }`, **Then** CSS custom properties for light+dark plus a contrast report are returned.
2. **Given** a failing pair, **Then** the tool auto-adjusts (unless `strict: true`) and reports what changed.
3. **Given** a returned `themeId` on the HTTP transport, **When** passed to later calls in the same session, **Then** the theme is applied.

---

### User Story 5 – Validate, explain and convert (Priority: P2)

Agents can lint generated markup, understand a class, and convert Tailwind/Bootstrap markup into newBrush.

**Acceptance Scenarios**:

1. **Given** `validate_markup` with HTML, **Then** unknown classes, component anatomy errors (e.g. `nb-card__body` outside `nb-card`), and basic a11y issues (missing alt, button without name, low contrast) are reported.
2. **Given** `convert_markup { from: "tailwind" }`, **Then** equivalent newBrush markup and a list of unmapped classes are returned.
3. **Given** `explain_class "md:hover:bg-brand-600/80"`, **Then** parse tree, CSS and docs link are returned.

---

### User Story 6 – Run locally or hosted (Priority: P1)

Users run the server locally via `npx -y @newbrush/mcp` (stdio) or connect to a hosted Streamable HTTP endpoint; developers
can also embed the same tool functions in their own server via a library export.

**Acceptance Scenarios**:

1. **Given** Claude Desktop/Code config with `npx -y @newbrush/mcp`, **Then** tools appear and work offline.
2. **Given** `https://mcp.newbrush.dev/mcp` [domain TBD], **Then** the same tools work over Streamable HTTP with rate limits.
3. **Given** `import { tools } from "@newbrush/mcp/lib"`, **Then** functions are callable without MCP transport.

---

### User Story 7 – Live preview (Priority: P3)

Clients supporting MCP UI resources (MCP Apps) can render a sandboxed preview of generated output.

### Edge Cases

- Oversized input (> 256 KB HTML, > 5 000 classes) → structured error `NB_INPUT_TOO_LARGE`.
- Malicious content in slots (`<script>`, `onerror=`) → escaped as text; `rawHtml` slots disallowed unless `allowRawHtml` server option is set (off by default).
- Arbitrary values attempting `url()` / `@import` → rejected with diagnostics (shared validator from 001).
- Unknown component/section names → error lists nearest matches.
- Version skew: clients can request `newbrushVersion`; server reports the version it serves.
- Concurrent HTTP sessions → no shared mutable state except LRU theme cache keyed by session.

## Requirements *(mandatory)*

- **FR-001**: Server MUST implement MCP via the official TypeScript SDK with **stdio** and **Streamable HTTP** transports.
- **FR-002**: Server MUST expose tools: `generate_css`, `search`, `get_component`, `get_tokens`, `compose_component`, `build_page`, `create_theme`, `validate_markup`, `explain_class`, `convert_markup`.
- **FR-003**: Every tool MUST have a JSON Schema input *and* `outputSchema` with `structuredContent` results, plus tool annotations (`readOnlyHint: true`, `idempotentHint: true`, `openWorldHint: false`).
- **FR-004**: Server MUST expose resources: `newbrush://manifest`, `newbrush://components/{name}`, `newbrush://utilities/{family}`, `newbrush://tokens/{group}`, `newbrush://themes/{name}`, `newbrush://docs/{slug}`, `newbrush://sections/{name}` (page-section blueprints).
- **FR-005**: Server MUST expose prompts: `design_landing_page`, `restyle_with_brand`, `convert_from_tailwind`, `build_dashboard`.
- **FR-006**: All output MUST be deterministic for identical inputs + server version.
- **FR-007**: All inputs MUST be schema-validated, size-limited and sanitised; HTML output MUST escape user text by default.
- **FR-008**: Generated pages MUST pass axe-core (zero violations) and W3C HTML validation in the test suite for all section blueprints.
- **FR-009**: A hosted deployment MUST ship at v1.0 and MUST support a free anonymous tier (60 req/min/IP) plus optional API-key/OAuth auth, per-key rate limiting, request logging without storing content, and CORS for browser clients.
- **FR-010**: Tool functions MUST be exported as a transport-free library (`@newbrush/mcp/lib`) and as an HTTP REST mirror (`POST /v1/tools/{name}`) for non-MCP integrations.
- **FR-011**: Server MUST be listed in the official MCP Registry with `server.json`, and ship a Docker image.
- **FR-012**: Section blueprints v1: navbar, hero (5 variants), logo-cloud, feature-grid, feature-split, stats, pricing, testimonial, faq, cta, blog-list, contact-form, footer, dashboard-shell, sidebar-layout, auth-form, table-view, empty-state, 404.

### Key Entities

- **PageSpec**: `{ title, lang, dir, theme, meta, sections: SectionSpec[] }`.
- **SectionSpec**: `{ type, variant?, props, slots }` mapped to a blueprint.
- **Blueprint**: section template (HTML with typed slots) + used classes + a11y contract — sourced from the manifest.
- **ThemeSpec**: seeds, overrides, colorScheme; returns resolved CSS + contrast report.
- **Diagnostic**: `{ code, severity, message, class?, path?, suggestion? }`.

## Success Criteria *(mandatory)*

- **SC-001**: p95 latency: `generate_css` < 30 ms, `build_page` < 150 ms (local, typical page).
- **SC-002**: 100 % of blueprint × theme × variant combinations pass axe + HTML validation.
- **SC-003**: In an eval set of 50 natural-language website requests driven by an LLM client, ≥ 90 % produce a valid page on first `build_page` call (no schema errors).
- **SC-004**: Generated page CSS ≤ 15 KB brotli for a 6-section landing page.
- **SC-005**: Zero XSS findings in fuzzing of slot inputs (10k cases).

## Assumptions

- The MCP spec revision targeted is the latest stable at implementation time (2025-06-18 or newer); structured tool output is available.
- Image hosting is out of scope; blueprints accept image URLs from the agent and render `<img>` with required `alt`.
- The server never calls an LLM itself.
