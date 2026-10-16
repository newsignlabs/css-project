import { readFileSync } from "node:fs";
import { palettes as seededPalettes } from "../lib/seeds.ts";
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

/** Default palettes as the token build generates them from their seeds (sRGB values). */
const defaults: Palettes = Object.fromEntries(
  Object.entries(seededPalettes({}, { all: true })).map(([name, steps]) => [
    name,
    Object.fromEntries(steps.map((s) => [String(s.step), s.value])),
  ]),
);

export function semanticColor(name: string, theme: ThemeName, palettes: Palettes = {}): string {
  const token = semantic.get(name) ?? semantic.get(`${name}.default`);
  if (!token?.$value) throw new Error(`Unknown semantic colour ${name}`);
  const ref = (theme !== "light" && token.$extensions?.["nb.themes"]?.[theme]) || token.$value;
  const match = /^\{color\.([\w-]+)(?:\.(\w+))?\}$/.exec(ref);
  if (!match) return ref;
  const [, palette = "", step] = match;
  if (!step) return primitives[palette]?.$value ?? ref;
  return palettes[palette]?.[step] ?? defaults[palette]?.[step] ?? ref;
}
