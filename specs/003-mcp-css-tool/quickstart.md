# Quickstart: newBrush MCP (validation scenarios)

## 1. Run & inspect locally

```bash
npx -y @newbrush/mcp                          # stdio
npx @modelcontextprotocol/inspector npx -y @newbrush/mcp
```
✅ Expect: 10 tools, 7 resource templates, 4 prompts listed.

## 2. Generate CSS for agent-written markup

```json
{ "tool": "generate_css",
  "arguments": { "html": "<main class='nb-container py-12'><button class='nb-btn nb-btn--primary md:px-8'>Go</button></main>", "mode": "inline" } }
```
✅ Expect: `<style>` with `@layer` order, tokens, button component, 3 utilities; `rejected: []`.

## 3. Build a page from a user query

User: *"Landing page for a coffee subscription called Brewly, warm brown brand, dark mode."*
The client LLM (guided by prompt `design_landing_page`) calls:

```json
{ "tool": "build_page",
  "arguments": {
    "title": "Brewly — Fresh coffee, delivered",
    "theme": { "seeds": { "brand": "oklch(48% 0.09 55)" }, "colorScheme": "dark" },
    "sections": [
      { "type": "navbar", "slots": { "brand": "Brewly", "links": [{ "href": "#plans", "text": "Plans" }] } },
      { "type": "hero", "variant": "split", "slots": { "title": "Fresh coffee, delivered", "lead": "Roasted weekly.", "primaryCta": { "href": "#plans", "text": "Start brewing" }, "image": { "src": "https://example.com/cup.jpg", "alt": "A cup of coffee" } } },
      { "type": "feature-grid", "props": { "columns": 3 }, "slots": { "items": [ { "title": "Single origin", "body": "…" } ] } },
      { "type": "pricing", "slots": { "plans": [ { "name": "Starter", "price": "$12", "features": ["1 bag / month"] } ] } },
      { "type": "footer", "slots": { "copyright": "© 2026 Brewly" } }
    ]
  } }
```
✅ Expect: full HTML document, CSS ≤ 15 KB brotli, zero axe violations, no diagnostics of severity `error`.

## 4. Safety

```json
{ "tool": "compose_component", "arguments": { "name": "alert", "slots": { "body": "<img src=x onerror=alert(1)>" } } }
```
✅ Expect: body rendered as escaped text.

## 5. Hosted

```bash
claude mcp add --transport http newbrush https://mcp.newbrush.dev/mcp
curl -s -X POST https://mcp.newbrush.dev/v1/tools/explain_class -d '{"classes":["md:grid-cols-3"]}'
```
