# newBrush overview on Zoho Catalyst

`client/index.html` is a single self-contained page (no external files, no network requests) showing how newBrush is
made today: architecture, design tokens, every component rendered live, the utility engine, themes, the planned design
styles and build status. It is generated from the real build outputs.

## Regenerate

```bash
pnpm build      # build the framework
pnpm overview   # writes catalyst/client/index.html
```

## View it on Zoho Catalyst (Web Client Hosting)

- **Console**: Catalyst project → *Cloud Scale → Web Client Hosting* → upload the `client` folder (zip it first:
  `cd catalyst && zip -r client.zip client`). Open the generated app URL.
- **CLI**: from this `catalyst/` folder run `catalyst init` (choose *Client*, keep the folder name `client`), then
  `catalyst deploy --only client`.

The page also opens directly from disk — just double-click `client/index.html`.
