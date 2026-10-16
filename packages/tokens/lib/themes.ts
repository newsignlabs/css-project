/**
 * Where each built-in theme's semantic tokens are declared. Shared by the token build (tokens.css) and by contrast
 * fixes (contrast.ts), which restate the same structure with doubled specificity so the two can never drift apart.
 * Order matters: themes later in the list win over earlier ones at equal specificity.
 */
export const THEME_NAMES = ["light", "dark", "contrast"] as const;
export type ThemeName = (typeof THEME_NAMES)[number];

export interface ThemeRule {
  /** Wrapping media query, if any. */
  media?: string;
  selectors: string[];
}

export const THEME_RULES: Record<ThemeName, ThemeRule[]> = {
  // ::backdrop does not inherit custom properties in every supported engine, so tokens are declared on it too.
  light: [
    { selectors: [":root", "::backdrop", '[data-nb-theme="light"]', '[data-nb-theme="contrast"]'] },
  ],
  dark: [
    { selectors: ['[data-nb-theme="dark"]'] },
    { media: "(prefers-color-scheme: dark)", selectors: [":root:not([data-nb-theme])"] },
  ],
  contrast: [
    { selectors: ['[data-nb-theme="contrast"]'] },
    {
      media: "(prefers-contrast: more) and (prefers-color-scheme: light)",
      selectors: [":root:not([data-nb-theme])"],
    },
  ],
};

/**
 * Doubles a selector's specificity without changing what it matches: `:root` → `:root:root`,
 * `::backdrop` → `:root ::backdrop`, `[a]` → `[a][a]`, `:root:not(…)` → `:root:root:not(…)`.
 */
export function doubleSpecificity(selector: string): string {
  if (selector.startsWith("::")) return `:root ${selector}`;
  if (selector.startsWith(":root")) return `:root${selector}`;
  return `${selector}${selector}`;
}

/** CSS rules (indented for an `@layer` block) declaring `lines` for every rule of a theme. */
export function themeBlocks(
  theme: ThemeName,
  lines: string[],
  { double = false }: { double?: boolean } = {},
): string[] {
  return THEME_RULES[theme].map(({ media, selectors }) => {
    const sel = selectors.map((s) => (double ? doubleSpecificity(s) : s));
    const pad = media ? "    " : "  ";
    const rule = `${pad}${sel.join(`,\n${pad}`)} {\n${lines.map((l) => `${pad}  ${l}`).join("\n")}\n${pad}}`;
    return media ? `  @media ${media} {\n${rule}\n  }` : rule;
  });
}
