import { readFile } from "node:fs/promises";
import type { ResolvedToken } from "@newbrush/schema";
import { wcagContrast } from "culori";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * WCAG 2 contrast for semantic pairs in every theme (constitution §IV).
 * The full build-time checker with APCA and auto-fix is specs/001 T062; this guards the defaults now.
 */
let tokens: Map<string, ResolvedToken>;
beforeAll(async () => {
  const built = JSON.parse(await readFile(new URL("../dist/tokens.json", import.meta.url), "utf8"));
  tokens = new Map(built.tokens.map((t: ResolvedToken) => [t.name, t]));
});

const THEMES = ["light", "dark", "contrast"] as const;
const value = (name: string, theme: (typeof THEMES)[number]) => {
  const t = tokens.get(name) ?? tokens.get(`${name}.default`);
  if (!t) throw new Error(`Unknown token ${name}`);
  return theme === "light" ? t.value : (t.themes[theme] ?? t.value);
};

const TEXT = 4.5;
const UI = 3; // non-text contrast (WCAG 1.4.11): borders of controls, focus indicators
const surfaces = [
  "color.surface",
  "color.surface.subtle",
  "color.surface.raised",
  "color.surface.overlay",
];
const tones = ["success", "warning", "danger", "info"];

const pairs: [fg: string, bg: string, min: number][] = [
  ...surfaces.flatMap(
    (s) =>
      [
        ["color.text", s, TEXT],
        ["color.text.muted", s, TEXT],
        ["color.text.link", s, TEXT],
        ["color.accent.text", s, TEXT],
        ["color.border.strong", s, UI],
        ["color.focus.ring", s, UI],
        ...tones.map((t) => [`color.${t}.text`, s, TEXT]),
      ] as [string, string, number][],
  ),
  ["color.text.inverse", "color.surface.inverse", TEXT],
  ["color.on-accent", "color.accent", TEXT],
  ["color.on-accent", "color.accent.hover", TEXT],
  ["color.accent.text", "color.accent.subtle", TEXT],
  ["color.text", "color.selection", TEXT],
  ...tones.flatMap(
    (t) =>
      [
        [`color.on-${t}`, `color.${t}`, TEXT],
        [`color.on-${t}`, `color.${t}.hover`, TEXT],
        [`color.${t}.text`, `color.${t}.subtle`, TEXT],
        ["color.text", `color.${t}.subtle`, TEXT],
      ] as [string, string, number][],
  ),
];

describe.each(THEMES)("%s theme", (theme) => {
  it.each(pairs)("%s on %s ≥ %d:1", (fg, bg, min) => {
    const ratio = wcagContrast(value(fg, theme), value(bg, theme));
    expect(ratio, `${fg} on ${bg} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(min);
  });
});
