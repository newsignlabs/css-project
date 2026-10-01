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
