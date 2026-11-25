// specs/003 T002 — writes every tool's input and output JSON Schema to specs/003-mcp-css-tool/contracts/schemas/.
// test/schemas.test.ts fails when the committed files drift from the zod schemas: run `pnpm schemas` to update them.
import { mkdirSync, writeFileSync } from "node:fs";
import { schemaFiles } from "../src/schemas/json.ts";

const dir = new URL("../../../specs/003-mcp-css-tool/contracts/schemas/", import.meta.url);
mkdirSync(dir, { recursive: true });
for (const [file, json] of Object.entries(schemaFiles())) writeFileSync(new URL(file, dir), json);
console.log(
  `Wrote ${Object.keys(schemaFiles()).length} schemas to specs/003-mcp-css-tool/contracts/schemas/`,
);
