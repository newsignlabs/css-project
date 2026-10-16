/**
 * Semantic colour pairs at WCAG AA, as [fg, bg, min] rows for the token tests. The list itself lives in
 * lib/contrast.ts, which the build-time checker uses.
 */
import { PAIRS as CONTRAST_PAIRS, MINIMUMS } from "../lib/contrast.ts";

export { THEME_NAMES as THEMES, type ThemeName } from "../lib/contrast.ts";

export const PAIRS: [fg: string, bg: string, min: number][] = CONTRAST_PAIRS.map((p) => [
  p.fg,
  p.bg,
  MINIMUMS.AA[p.kind],
]);
