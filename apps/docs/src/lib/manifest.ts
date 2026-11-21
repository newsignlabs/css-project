import type { Component, Manifest, ResolvedToken, UtilityFamily } from "@newbrush/schema";
import data from "newbrush/manifest.json";

// specs/001 T081 — every reference page reads the build manifest, so the docs cannot drift from the code.

export const manifest = data as unknown as Manifest;

/** A site path with the configured base (the site is served under /site/). */
export const url = (path: string) => `${import.meta.env.BASE_URL.replace(/\/$/, "")}${path}`;

export const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const titleCase = (text: string) => text[0]?.toUpperCase() + text.slice(1);

/** Items grouped by a key, keeping first-seen order of the groups. */
export function groupBy<T>(items: readonly T[], key: (item: T) => string): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    groups.set(k, [...(groups.get(k) ?? []), item]);
  }
  return [...groups];
}

/** Token groups: the first path segment, plus the second for colours (color.text, color.neutral…). */
export const tokenGroup = (t: ResolvedToken) =>
  t.path[0] === "color" ? `color.${t.path[1]}` : (t.path[0] ?? t.name);

export const tierOrder = ["semantic", "component", "primitive"] as const;

export const tokensByTier = tierOrder.map(
  (tier) =>
    [
      tier,
      groupBy(
        manifest.tokens.filter((t) => t.tier === tier),
        tokenGroup,
      ),
    ] as const,
);

/** The values of a utility family, as `pattern → value` rows (token groups list the token names). */
export function utilityValues(u: UtilityFamily): string {
  if (u.values.source === "token") return `--nb-${u.values.group}-* tokens`;
  const entries = Object.entries(u.values.map);
  const shown = entries.slice(0, 12).map(([k, v]) => (k === v ? k : `${k}: ${v}`));
  return entries.length > 12 ? `${shown.join(", ")}, … (${entries.length})` : shown.join(", ");
}

export const componentHeadings = (c: Component) =>
  [
    "Examples",
    "Anatomy",
    c.modifiers.length ? "Modifiers" : "",
    c.sizes.length || c.states.length ? "Sizes and states" : "",
    "Accessibility",
    c.tokens.length ? "Tokens" : "",
  ]
    .filter(Boolean)
    .map((text) => ({ depth: 2, slug: slug(text), text }));
