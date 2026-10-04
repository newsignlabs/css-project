import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { run } from "../src/run.ts";

// Fixtures live inside the package so node resolution finds the workspace `newbrush` package (a dev dependency).
const TMP = new URL("./.tmp/", import.meta.url).pathname;

export async function fixture(
  files: Record<string, string> = {},
): Promise<{ dir: string; cleanup: () => Promise<void> }> {
  await mkdir(TMP, { recursive: true });
  const dir = await mkdtemp(join(TMP, "case-"));
  for (const [name, content] of Object.entries(files)) {
    await mkdir(join(dir, name, ".."), { recursive: true });
    await writeFile(join(dir, name), content);
  }
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

export async function nb(
  cwd: string,
  ...argv: string[]
): Promise<{ code: number; out: string; err: string }> {
  let out = "";
  let err = "";
  const code = await run(argv, { cwd, stdout: (s) => (out += s), stderr: (s) => (err += s) });
  return { code, out, err };
}

export const read = (dir: string, file: string) => readFile(join(dir, file), "utf8");
