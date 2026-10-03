/**
 * Curated utility preset for newbrush-full.css (specs/001-core-framework T057): the CDN/no-build option.
 * Every concrete utility, plus the variants people actually reach for on the families that need them.
 * Budget: newbrush-full.min.css ≤ 70 kB brotli (constitution §VI), enforced by size-limit.
 */
import type { Engine } from "@newbrush/engine";

const RESPONSIVE = ["sm", "md", "lg", "xl"];
const CONTAINER = ["@sm", "@md", "@lg"];
const STATES = ["hover", "focus-visible", "active"];

const responsiveFamilies =
  /^(block|inline-block|inline|flex|inline-flex|grid|inline-grid|hidden|contents|flex-(row|col|wrap|nowrap)|items-|justify-|self-|content-|place-|grid-cols-|col-span-|order-|gap-|p[xyestb]?-|m[xyestb]?-|w-|max-w-|text-(xs|sm|base|lg|xl|[2-6]xl|start|center|end)$|basis-|aspect-)/;
const containerFamilies =
  /^(block|flex|grid|hidden|flex-(row|col)|grid-cols-|col-span-|gap-|p-|text-(sm|base|lg|xl|2xl)$)/;
const semanticColor =
  /^(bg|text|border|ring|outline|from|to)-(surface|text|muted|subtle|link|inverse|accent|on-|success|warning|danger|info|default|strong|border|transparent|current|white|black)/;
const stateFamilies =
  /^(shadow-|opacity-|underline$|no-underline$|ring-[0-8]$|outline-[0-8]$|scale-|translate-y-|-translate-y-)/;
const paletteSteps =
  /^(bg|text|border)-(neutral|brand|accent|success|warning|danger|info)-(50|100|200|700|800|900|950)$/;

export function presetClasses(engine: Engine): string[] {
  const known = engine.knownClasses();
  const out = new Set(known);
  const add = (variants: string[], classes: string[]) => {
    for (const v of variants) for (const c of classes) out.add(`${v}:${c}`);
  };
  add(
    RESPONSIVE,
    known.filter((c) => responsiveFamilies.test(c) && !c.startsWith("-")),
  );
  add(
    CONTAINER,
    known.filter((c) => containerFamilies.test(c)),
  );
  add(
    STATES,
    known.filter((c) => semanticColor.test(c) || stateFamilies.test(c)),
  );
  add(
    ["dark"],
    known.filter((c) => paletteSteps.test(c) || /^shadow-/.test(c)),
  );
  add(
    ["group-hover", "group-focus-visible"],
    known.filter((c) =>
      /^(opacity-|underline$|translate-x-|-?translate-y-|scale-|text-(accent|link|default))/.test(
        c,
      ),
    ),
  );
  add(
    ["disabled"],
    ["opacity-50", "opacity-disabled", "cursor-not-allowed", "pointer-events-none"],
  );
  add(["motion-reduce"], ["animate-none", "transition-none"]);
  add(
    ["motion-safe"],
    known.filter((c) => /^(animate-|transition)/.test(c)),
  );
  add(["print"], ["hidden", "block"]);
  add(
    ["first", "last"],
    known.filter((c) => /^(m[tbse]?-0$|border-0$|rounded-(t|b|s|e)-)/.test(c)),
  );
  add(
    ["placeholder"],
    known.filter((c) => /^text-(muted|subtle)$/.test(c)),
  );
  return [...out].sort();
}
