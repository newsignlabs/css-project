import { readFileSync } from "node:fs";
import type { ThemeName } from "./pairs.ts";

/**
 * Resolves semantic colour tokens straight from the DTCG sources, with any palette swapped for a generated one,
 * so a seed's effect on every semantic pair can be checked without running the token build.
 */
type Node = { $value?: string; $extensions?: { "nb.themes"?: Record<string, string> } };
const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const primitives: Record<string, Record<string, Node> & Node> = read(
  "../src/primitive/color.json",
).color;
const semantic = new Map<string, Node>();
(function walk(node: Record<string, unknown>, path: string[]) {
  if ("$value" in node) semantic.set(path.join("."), node as Node);
  for (const [key, child] of Object.entries(node)) {
    if (!key.startsWith("$") && child && typeof child === "object") {
      walk(child as Record<string, unknown>, [...path, key]);
    }
  }
})(read("../src/semantic/color.json").color, ["color"]);

/** Palettes to substitute, e.g. `{ brand: { "600": "oklch(…)" } }`. */
export type Palettes = Record<string, Record<string, string>>;

export function semanticColor(name: string, theme: ThemeName, palettes: Palettes = {}): string {
  const token = semantic.get(name) ?? semantic.get(`${name}.default`);
  if (!token?.$value) throw new Error(`Unknown semantic colour ${name}`);
  const ref = (theme !== "light" && token.$extensions?.["nb.themes"]?.[theme]) || token.$value;
  const match = /^\{color\.([\w-]+)(?:\.(\w+))?\}$/.exec(ref);
  if (!match) return ref;
  const [, palette = "", step] = match;
  if (!step) return primitives[palette]?.$value ?? ref;
  return palettes[palette]?.[step] ?? primitives[palette]?.[step]?.$value ?? ref;
}

/** The default value of every step of a primitive palette, 50 → 950. */
export const primitivePalette = (palette: string) =>
  Object.entries(primitives[palette] ?? {})
    .filter(([key]) => !key.startsWith("$"))
    .map(([, node]) => (node as Node).$value);
