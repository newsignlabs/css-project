import type { Theme } from "../theme.ts";
import type { Family } from "../types.ts";
import { scaleFamily } from "./helpers.ts";

const intrinsic = {
  auto: "auto",
  full: "100%",
  min: "min-content",
  max: "max-content",
  fit: "fit-content",
  px: "1px",
};
const withContainers = (t: Theme) => new Map([...t.space, ...t.container]);

// T046 — sizing. w/h are emitted as logical inline-size/block-size.
export const sizing: Family[] = [
  scaleFamily({
    name: "size",
    category: "sizing",
    description: "Inline and block size together",
    roots: ["size"],
    properties: ["inline-size", "block-size"],
    scale: (t) => t.space,
    tokenGroup: "space",
    extra: intrinsic,
    fractions: true,
  }),
  scaleFamily({
    name: "inline-size",
    category: "sizing",
    description: "Width (logical inline-size)",
    roots: ["w"],
    properties: ["inline-size"],
    scale: (t) => t.space,
    tokenGroup: "space",
    extra: { ...intrinsic, screen: "100vi", dvw: "100dvi" },
    fractions: true,
  }),
  scaleFamily({
    name: "min-inline-size",
    category: "sizing",
    description: "Minimum width",
    roots: ["min-w"],
    properties: ["min-inline-size"],
    scale: withContainers,
    tokenGroup: "space",
    extra: { ...intrinsic, 0: "0" },
    fractions: true,
  }),
  scaleFamily({
    name: "max-inline-size",
    category: "sizing",
    description: "Maximum width; container keys (sm…2xl, prose)",
    roots: ["max-w"],
    properties: ["max-inline-size"],
    scale: withContainers,
    tokenGroup: "size",
    extra: { ...intrinsic, none: "none" },
    fractions: true,
  }),
  scaleFamily({
    name: "block-size",
    category: "sizing",
    description: "Height (logical block-size)",
    roots: ["h"],
    properties: ["block-size"],
    scale: (t) => t.space,
    tokenGroup: "space",
    extra: { ...intrinsic, screen: "100vb", dvh: "100dvb", svh: "100svb", lvh: "100lvb" },
    fractions: true,
  }),
  scaleFamily({
    name: "min-block-size",
    category: "sizing",
    description: "Minimum height",
    roots: ["min-h"],
    properties: ["min-block-size"],
    scale: (t) => t.space,
    tokenGroup: "space",
    extra: { ...intrinsic, 0: "0", screen: "100vb", dvh: "100dvb" },
    fractions: true,
  }),
  scaleFamily({
    name: "max-block-size",
    category: "sizing",
    description: "Maximum height",
    roots: ["max-h"],
    properties: ["max-block-size"],
    scale: (t) => t.space,
    tokenGroup: "space",
    extra: { ...intrinsic, none: "none", screen: "100vb", dvh: "100dvb" },
    fractions: true,
  }),
];
