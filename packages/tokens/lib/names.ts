/** Token path → CSS custom property name. A trailing "default" segment is dropped: color.surface.default → --nb-color-surface. */
export function cssVarName(path: readonly string[]): string {
  const parts = path.at(-1) === "default" ? path.slice(0, -1) : path;
  return `--nb-${parts.join("-").toLowerCase()}`;
}

/** "{color.neutral.50}" → ["color", "neutral", "50"], or null when the value is not a single alias. */
export function aliasPath(value: unknown): string[] | null {
  if (typeof value !== "string") return null;
  const m = /^\{([^{}]+)\}$/.exec(value.trim());
  return m?.[1] ? m[1].split(".") : null;
}

/**
 * Semantic groups whose tokens get a `-base` alias (specs/004 T005). Each is declared as
 * `--nb-x-base: <value>; --nb-x: var(--nb-x-base);` wherever a theme declares it, so a design style can override
 * `--nb-x` with a value derived from itself (`color-mix(in oklch, var(--nb-x-base) 60%, transparent)`) and
 * `.style-default` can restore it, without a reference cycle.
 */
export const BASE_ALIAS_GROUPS: readonly (readonly string[])[] = [
  ["color", "surface"],
  ["color", "text"],
  ["color", "border"],
  ["color", "focus"],
];

/** Whether a token path has a `-base` alias. */
export const hasBaseAlias = (path: readonly string[]): boolean =>
  BASE_ALIAS_GROUPS.some((group) => group.every((part, i) => path[i] === part));

/** `--nb-color-surface-raised-base` for color.surface.raised. */
export const baseVarName = (path: readonly string[]): string => `${cssVarName(path)}-base`;
