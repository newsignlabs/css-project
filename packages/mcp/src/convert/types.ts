// Shared types for convert_markup's converters (specs/003 T030).

export interface ElementInfo {
  tag: string;
  classes: string[];
  attrs: Record<string, string>;
}

/** An element being converted, with its ancestors (nearest last) and child elements. */
export interface ConvertContext extends ElementInfo {
  ancestors: ElementInfo[];
  children: ElementInfo[];
}

export interface Unmapped {
  class: string;
  reason: string;
}

/** What a converter makes of one element's classes. */
export interface ElementResult {
  /** newBrush classes for the element, in order. */
  classes: string[];
  unmapped: Unmapped[];
  /** Classes the parent element needs (e.g. nb-field around a converted label). */
  parent?: string[];
}

export type Converter = (ctx: ConvertContext, known: (cls: string) => boolean) => ElementResult;

/** Splits a class into its variant prefix ("md:hover:") and base, ignoring colons inside [arbitrary] values. */
export function splitVariants(cls: string): { prefix: string; base: string } {
  let depth = 0;
  let cut = -1;
  for (let i = 0; i < cls.length; i++) {
    const ch = cls[i];
    if (ch === "[") depth++;
    else if (ch === "]") depth--;
    else if (ch === ":" && depth === 0) cut = i;
  }
  return { prefix: cls.slice(0, cut + 1), base: cls.slice(cut + 1) };
}
