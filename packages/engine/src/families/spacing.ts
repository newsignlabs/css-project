import type { Family } from "../types.ts";
import { scaleFamily } from "./helpers.ts";

const sides = [
  ["", ""],
  ["x", "-inline"],
  ["y", "-block"],
  ["s", "-inline-start"],
  ["e", "-inline-end"],
  ["t", "-block-start"],
  ["b", "-block-end"],
] as const;

// T045 — padding, margin and space-between. Shorthands are registered before longhands so longhands win.
export const spacing: Family[] = [
  ...sides.map(([suffix, prop]) =>
    scaleFamily({
      name: `padding${prop}`,
      category: "spacing",
      description: `Padding${prop ? ` (${prop.slice(1)})` : ""}`,
      roots: [`p${suffix}`],
      properties: [`padding${prop}`],
      scale: (t) => t.space,
      tokenGroup: "space",
      extra: { px: "1px" },
    }),
  ),
  ...sides.map(([suffix, prop]) =>
    scaleFamily({
      name: `margin${prop}`,
      category: "spacing",
      description: `Margin${prop ? ` (${prop.slice(1)})` : ""}`,
      roots: [`m${suffix}`],
      properties: [`margin${prop}`],
      scale: (t) => t.space,
      tokenGroup: "space",
      extra: { px: "1px", auto: "auto" },
      negative: true,
    }),
  ),
  scaleFamily({
    name: "space-x",
    category: "spacing",
    description: "Inline space between direct children",
    roots: ["space-x"],
    properties: ["margin-inline-end"],
    scale: (t) => t.space,
    tokenGroup: "space",
    extra: { px: "1px" },
    negative: true,
    selector: ":where(& > :not(:last-child))",
  }),
  scaleFamily({
    name: "space-y",
    category: "spacing",
    description: "Block space between direct children",
    roots: ["space-y"],
    properties: ["margin-block-end"],
    scale: (t) => t.space,
    tokenGroup: "space",
    extra: { px: "1px" },
    negative: true,
    selector: ":where(& > :not(:last-child))",
  }),
];
