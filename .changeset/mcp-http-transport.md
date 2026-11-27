---
"@newbrush/mcp": minor
---

`--transport http`: Streamable HTTP MCP at `/mcp` (per-session servers and themes), a REST mirror of every tool at
`/v1/tools/{name}`, `/v1/manifest` and `/healthz`, with optional API keys, a rate limit, CORS and a body limit. The app
is exported as `@newbrush/mcp/http` (`createHttpApp`) for any fetch runtime.
