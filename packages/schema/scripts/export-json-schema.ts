import { mkdir, writeFile } from "node:fs/promises";
import { z } from "zod";
import { jsonSchemas } from "../src/index.ts";

const outDir = new URL("../schemas/", import.meta.url);
await mkdir(outDir, { recursive: true });

for (const [file, schema] of Object.entries(jsonSchemas)) {
  const json = {
    ...z.toJSONSchema(schema, { target: "draft-2020-12", io: "input" }),
    $id: `https://newbrush.dev/schema/${file}`,
  };
  await writeFile(new URL(file, outDir), `${JSON.stringify(json, null, 2)}\n`);
}
console.log(`schemas: wrote ${Object.keys(jsonSchemas).length} files`);
