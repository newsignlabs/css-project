import type { Theme } from "../theme.ts";
import type { Category, Decl, Family, Resolved, ValueInput } from "../types.ts";
import type { Grammar } from "../validate.ts";

export const decls = (props: string[], value: string): Decl[] => props.map((p) => [p, value]);

/** "1/2" → "50%". */
export function fraction(value: string | undefined): string | undefined {
  const m = value ? /^(\d+)\/(\d+)$/.exec(value) : null;
  if (!m) return undefined;
  const [num, den] = [Number(m[1]), Number(m[2])];
  if (den === 0 || num > den) return undefined;
  return `${Number(((num / den) * 100).toFixed(6))}%`;
}

export const negate = (value: string) => `calc(${value} * -1)`;

/** "80" → "0.8"; undefined for anything that is not 0–100. */
export function alpha(modifier: string | undefined): string | undefined {
  if (modifier === undefined || !/^\d{1,3}$/.test(modifier)) return undefined;
  const n = Number(modifier);
  return n <= 100 ? String(n / 100) : undefined;
}

export function withAlpha(color: string, modifier: string | undefined): string | undefined {
  if (modifier === undefined) return color;
  const a = alpha(modifier);
  return a === undefined ? undefined : `oklch(from ${color} l c h / ${a})`;
}

interface ScaleOptions {
  name: string;
  category: Category;
  description: string;
  roots: string[];
  properties: string[];
  scale?: (t: Theme) => Map<string, string>;
  tokenGroup?: string;
  extra?: Record<string, string>;
  arbitrary?: Grammar;
  negative?: boolean;
  fractions?: boolean;
  selector?: string;
  /** Builds declarations from the resolved value (defaults to one declaration per property). */
  build?: (value: string) => Decl[];
}

export function scaleFamily(o: ScaleOptions): Family {
  return {
    name: o.name,
    category: o.category,
    description: o.description,
    roots: o.roots,
    arbitrary: o.arbitrary ?? "length",
    negative: o.negative,
    properties: o.properties,
    valueSource: o.tokenGroup
      ? { source: "token", group: o.tokenGroup }
      : { source: "static", map: o.extra ?? {} },
    values: (t) =>
      [...(o.scale ? o.scale(t).keys() : []), ...Object.keys(o.extra ?? {})].filter(
        (k) => k !== "DEFAULT",
      ),
    resolve(input: ValueInput, theme: Theme): Resolved | null {
      let value =
        input.arbitrary ??
        (input.value === undefined
          ? (o.extra?.DEFAULT ?? o.scale?.(theme).get("DEFAULT"))
          : undefined) ??
        (input.value !== undefined
          ? (o.extra?.[input.value] ?? o.scale?.(theme).get(input.value))
          : undefined) ??
        (o.fractions ? fraction(input.value) : undefined);
      if (value === undefined || input.modifier !== undefined) return null;
      if (input.negative) {
        if (!o.negative) return null;
        value = negate(value);
      }
      return { decls: o.build ? o.build(value) : decls(o.properties, value), selector: o.selector };
    },
  };
}

interface ColorOptions {
  name: string;
  description: string;
  roots: string[];
  properties: string[];
  /** Semantic namespace, so `text-muted` resolves color.text.muted and `border-strong` color.border.strong. */
  ns?: string;
  build?: (color: string) => Decl[];
  selector?: string;
}

export function lookupColor(theme: Theme, value: string, ns?: string): string | undefined {
  return (
    theme.colors.get(value) ??
    (ns ? theme.colors.get(`${ns}-${value}`) : undefined) ??
    (ns && value === "default" ? theme.colors.get(ns) : undefined)
  );
}

export function colorFamily(o: ColorOptions): Family {
  return {
    name: o.name,
    category: "color",
    description: o.description,
    roots: o.roots,
    arbitrary: "color",
    opacityModifier: true,
    properties: o.properties,
    valueSource: { source: "token", group: "color" },
    values: (t) => [...t.colors.keys()],
    resolve(input, theme) {
      if (input.negative) return null;
      const base =
        input.arbitrary ??
        (input.value !== undefined ? lookupColor(theme, input.value, o.ns) : undefined);
      if (base === undefined) return null;
      const color = withAlpha(base, input.modifier);
      if (color === undefined) return null;
      return { decls: o.build ? o.build(color) : decls(o.properties, color), selector: o.selector };
    },
  };
}

/** Value-less utilities: every class maps to fixed declarations. */
export function staticFamily(
  name: string,
  category: Category,
  description: string,
  map: Record<string, Decl[] | Resolved>,
): Family {
  const props = new Set<string>();
  for (const entry of Object.values(map))
    for (const [p] of Array.isArray(entry) ? entry : entry.decls) props.add(p);
  return {
    name,
    category,
    description,
    roots: [],
    statics: map,
    properties: [...props],
    valueSource: { source: "static", map: Object.fromEntries(Object.keys(map).map((k) => [k, k])) },
    values: () => Object.keys(map),
  };
}

/** Builds `prefix-key` static classes for one property, e.g. justify-center. */
export function keywords(
  prefix: string,
  property: string,
  map: Record<string, string>,
): Record<string, Decl[]> {
  return Object.fromEntries(
    Object.entries(map).map(([k, v]) => [prefix ? `${prefix}-${k}` : k, [[property, v]]]),
  );
}

export const range = (from: number, to: number, step = 1) =>
  Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => String(from + i * step));
