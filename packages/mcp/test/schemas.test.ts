import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { schemaFiles } from "../src/schemas/json.ts";

// specs/003 T002 — the published JSON Schemas match the zod schemas (run `pnpm --filter @newbrush/mcp schemas`).
describe("contract schemas", () => {
  it("are up to date in specs/003-mcp-css-tool/contracts/schemas/", () => {
    const dir = new URL("../../../specs/003-mcp-css-tool/contracts/schemas/", import.meta.url);
    for (const [file, json] of Object.entries(schemaFiles()))
      expect(readFileSync(new URL(file, dir), "utf8"), file).toBe(json);
  });
});
