# newBrush overview on Zoho Catalyst

`client/index.html` (with `client/overview.css` and `client/overview.js`, no other network requests) shows how newBrush
is made today: architecture, design tokens, every component rendered live, the utility engine, themes, the planned
design styles and build status. It is generated from the real build outputs.

The stylesheet is a **legacy-compatible build** of the framework (`apps/overview/compat.ts`): cascade layers are
flattened in cascade order and OKLCH colours get hex/P3/Lab fallbacks, so the page is styled in browsers back to
Chrome 88 / Safari 14 / Firefox 78 — the framework itself targets current browsers. CSS and JS are external files
and there are no inline `style=""` attributes, so hosts with a strict Content-Security-Policy render it too.

## Regenerate

```bash
pnpm build      # build the framework
pnpm overview   # writes catalyst/client/{index.html,overview.css,overview.js}
```

## View it on Zoho Catalyst (Web Client Hosting)

- **Console**: Catalyst project → *Cloud Scale → Web Client Hosting* → upload the `client` folder (zip it first:
  `cd catalyst && zip -r client.zip client`). Open the generated app URL.
- **CLI**: from this `catalyst/` folder run `catalyst init` (choose *Client*, keep the folder name `client`), then
  `catalyst deploy --only client`.

The page also opens directly from disk — just double-click `client/index.html` (keep the three files together).
