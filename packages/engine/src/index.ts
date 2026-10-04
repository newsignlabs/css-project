/**
 * @newbrush/engine — browser-safe core (specs/001-core-framework contracts/engine-api.md).
 * Node-only helpers (scan, watch, loadConfig, minify) live in "@newbrush/engine/node".
 */
import type { Config } from "@newbrush/schema";
import { Engine, type GenerateResult } from "./engine.ts";
import { extractCandidates } from "./extract.ts";

export { DirectiveError, expandApply, hasDirectives, processDirectives } from "./apply.ts";
export {
  type Diagnostic,
  Engine,
  type Explanation,
  type GenerateResult,
  type Rule,
  splitVariants,
} from "./engine.ts";
export { escapeClassName } from "./escape.ts";
export { extractCandidates } from "./extract.ts";
export { createTheme, type Theme } from "./theme.ts";
export type { Family, Resolved } from "./types.ts";
export { type Grammar, type Validation, validateArbitrary } from "./validate.ts";

export function createEngine(config?: Config): Engine {
  return new Engine(config);
}

/** One-shot generation from class names or raw content (html/jsx/… strings). */
export async function generate(
  input: { classes: Iterable<string> } | { content: string[] },
  config?: Config,
): Promise<GenerateResult> {
  const engine = new Engine(config);
  if ("classes" in input) return engine.generate(input.classes);
  const candidates = new Set<string>();
  for (const text of input.content) for (const c of extractCandidates(text)) candidates.add(c);
  return engine.generate(candidates, { reportUnknown: false });
}
