import { readFile } from "node:fs/promises";
import type { ResolvedToken } from "@newbrush/schema";
import { wcagContrast } from "culori";
import { beforeAll, describe, expect, it } from "vitest";
import { PAIRS, THEMES, type ThemeName } from "./pairs.ts";

/**
 * WCAG 2 contrast for semantic pairs in every theme (constitution §IV).
 * The full build-time checker with APCA and auto-fix is specs/001 T062; this guards the defaults now.
 */
let tokens: Map<string, ResolvedToken>;
beforeAll(async () => {
  const built = JSON.parse(await readFile(new URL("../dist/tokens.json", import.meta.url), "utf8"));
  tokens = new Map(built.tokens.map((t: ResolvedToken) => [t.name, t]));
});

const value = (name: string, theme: ThemeName) => {
  const t = tokens.get(name) ?? tokens.get(`${name}.default`);
  if (!t) throw new Error(`Unknown token ${name}`);
  return theme === "light" ? t.value : (t.themes[theme] ?? t.value);
};

describe.each(THEMES)("%s theme", (theme) => {
  it.each(PAIRS)("%s on %s ≥ %d:1", (fg, bg, min) => {
    const ratio = wcagContrast(value(fg, theme), value(bg, theme));
    expect(ratio, `${fg} on ${bg} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(min);
  });
});
