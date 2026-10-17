# Brand theme example

Two named themes generated from one brand colour with `nb theme create`, used without a build step:

```bash
cd examples/brand-theme
nb theme create acme      --seed "#e11d48"              # light base → themes/acme.css
nb theme create acme-dark --seed "#e11d48" --from dark  # dark base  → themes/acme-dark.css
```

Each command prints the theme's contrast report (every semantic pair must pass AA). Load the files after
`newbrush.css` and set `data-nb-theme="acme"` on `<html>` or any element; `index.html` uses `acme` for the page and
`acme-dark` for one card. Add `--accent` or `--neutral` to seed those palettes too.

Open `index.html` directly in a browser (it links `../../packages/css/dist/newbrush.css`, so run `pnpm build` first).
