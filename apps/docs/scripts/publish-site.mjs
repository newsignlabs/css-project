// Copies the built docs (apps/docs/dist) to /site at the repository root, which Catalyst Slate serves as-is (it has
// no build step and deploys every push to main). Run `pnpm site` after changing the docs, and commit /site.
import { cpSync, existsSync, rmSync } from "node:fs";

const dist = new URL("../dist/", import.meta.url);
const site = new URL("../../../site/", import.meta.url);
if (!existsSync(new URL("index.html", dist))) {
  console.error("apps/docs/dist is missing: run `pnpm --filter @newbrush/docs build` first.");
  process.exit(1);
}
rmSync(site, { recursive: true, force: true });
cpSync(dist, site, { recursive: true });
console.log("Copied apps/docs/dist → site/");
