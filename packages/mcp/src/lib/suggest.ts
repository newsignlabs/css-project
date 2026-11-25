// Nearest-known-class suggestions for unknown classes (specs/003 T005): Levenshtein distance over every utility the
// engine can generate plus every component and style class in the manifest. Variants are kept as typed.
import { createEngine } from "@newbrush/engine";
import { manifest } from "../manifest.ts";

let known: string[] | undefined;

/** Component, part, modifier, size and style classes: valid newBrush classes that are not utilities. */
export const componentClasses: ReadonlySet<string> = new Set([
  ...manifest.components.flatMap((c) => [
    c.className,
    ...c.anatomy.map((a) => a.className),
    ...c.modifiers.map((m) => m.className),
    ...c.sizes.map((s) => `${c.className}--${s}`),
  ]),
  ...manifest.styles.flatMap((s) => [s.name, `nb-${s.name}`, ...s.aliases]),
  "style-default",
  "nb-style-default",
]);

function knownClasses(): string[] {
  known ??= [
    ...new Set([...createEngine({ content: ["mcp"] }).knownClasses(), ...componentClasses]),
  ];
  return known;
}

function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min((prev[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
      row.push(value);
      best = Math.min(best, value);
    }
    if (best > max) return max + 1;
    prev = row;
  }
  return prev[b.length] ?? max + 1;
}

/** Up to `limit` candidates closest to `word` by edit distance (ties sorted alphabetically). */
export function nearest(word: string, candidates: readonly string[], limit = 3): string[] {
  const max = Math.max(1, Math.min(3, Math.floor(word.length / 3)));
  return candidates
    .map((k) => ({ k, d: distance(word, k, max) }))
    .filter((x) => x.d <= max)
    .sort((x, y) => x.d - y.d || x.k.localeCompare(y.k))
    .slice(0, limit)
    .map((x) => x.k);
}

/** Up to three known classes closest to `cls` (ties sorted alphabetically), keeping its variant prefix. */
export function suggest(cls: string, limit = 3): string[] {
  const at = cls.lastIndexOf(":");
  const prefix = at === -1 ? "" : cls.slice(0, at + 1);
  const base = cls.slice(at + 1);
  return nearest(base, knownClasses(), limit).map((k) => prefix + k);
}
