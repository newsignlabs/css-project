// Token grouping shared by get_tokens, search and resources: the same groups as the docs' token reference
// (color.<group> for colours, otherwise the first path segment).
import type { ResolvedToken } from "@newbrush/schema";
import { manifest } from "./manifest.ts";

export const tokenGroup = (t: ResolvedToken): string =>
  t.path[0] === "color" ? `color.${t.path[1]}` : (t.path[0] ?? t.name);

export const TOKEN_GROUPS: readonly string[] = [...new Set(manifest.tokens.map(tokenGroup))].sort();
export const THEME_NAMES: readonly string[] = manifest.themes.map((t) => t.name);
