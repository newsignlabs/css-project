import { z } from "zod";
import { TOOL_SCHEMAS } from "./index.ts";

/** `<tool>.input.json` / `<tool>.output.json` → formatted JSON Schema text. */
export function schemaFiles(): Record<string, string> {
  const files: Record<string, string> = {};
  for (const [tool, { input, output }] of Object.entries(TOOL_SCHEMAS)) {
    for (const [kind, schema] of [
      ["input", input],
      ["output", output],
    ] as const)
      files[`${tool}.${kind}.json`] = `${JSON.stringify(
        { $id: `https://newbrush.dev/mcp/${tool}.${kind}.json`, ...z.toJSONSchema(schema) },
        null,
        2,
      )}\n`;
  }
  return files;
}
