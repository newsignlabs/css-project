---
"@newbrush/mcp": minor
---

New package: the newBrush MCP server (`npx -y @newbrush/mcp`). Over stdio it offers `generate_css` (utility CSS for
class names or HTML, with rejected and unknown classes, suggestions, brand seeds and optional core/full stylesheet) and
`explain_class` (how a class is read, its CSS and a docs link). `@newbrush/mcp/lib` exposes the same tools as plain
functions, plus HTML escaping, a URL allow-list and an inline-markup sanitizer.
