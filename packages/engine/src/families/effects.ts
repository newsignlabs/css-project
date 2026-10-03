import type { Family } from "../types.ts";
import { keywords, scaleFamily, staticFamily } from "./helpers.ts";

const filter =
  "var(--nb-blur,) var(--nb-brightness,) var(--nb-contrast,) var(--nb-saturate,) var(--nb-grayscale,) var(--nb-invert,) var(--nb-sepia,)";
const backdrop = "var(--nb-backdrop-blur,) var(--nb-backdrop-saturate,)";
const blend = {
  normal: "normal",
  multiply: "multiply",
  screen: "screen",
  overlay: "overlay",
  darken: "darken",
  lighten: "lighten",
  "color-dodge": "color-dodge",
  "color-burn": "color-burn",
  difference: "difference",
  exclusion: "exclusion",
  luminosity: "luminosity",
};
const filterFn = (
  name: string,
  fn: string,
  values: Record<string, string>,
  backdropVar = false,
): Family =>
  scaleFamily({
    name,
    category: "effects",
    description: `${fn}() filter`,
    roots: [name],
    properties: [backdropVar ? "backdrop-filter" : "filter"],
    extra: values,
    arbitrary: "number",
    build: (v) =>
      backdropVar
        ? [
            [`--nb-${name}`, `${fn.replace("backdrop-", "")}(${v})`],
            ["backdrop-filter", backdrop],
          ]
        : [
            [`--nb-${name}`, `${fn}(${v})`],
            ["filter", filter],
          ],
  });

// T050 — shadows, filters, glass, blend modes.
export const effects: Family[] = [
  scaleFamily({
    name: "box-shadow",
    category: "effects",
    description: "Elevation shadows (sm…2xl or 0…5); composes with ring-*",
    roots: ["shadow"],
    properties: ["box-shadow"],
    scale: (t) => t.shadow,
    tokenGroup: "elevation",
    extra: { DEFAULT: "var(--nb-elevation-1)" },
    arbitrary: "length",
    build: (v) => [
      ["--nb-shadow", v],
      ["box-shadow", "var(--nb-ring-shadow, 0 0 transparent), var(--nb-shadow, 0 0 transparent)"],
    ],
  }),
  scaleFamily({
    name: "blur",
    category: "effects",
    description: "Blur filter",
    roots: ["blur"],
    properties: ["filter"],
    scale: (t) => t.blur,
    tokenGroup: "blur",
    extra: { none: "0" },
    build: (v) => [
      ["--nb-blur", `blur(${v})`],
      ["filter", filter],
    ],
  }),
  filterFn("brightness", "brightness", {
    50: "0.5",
    75: "0.75",
    90: "0.9",
    100: "1",
    110: "1.1",
    125: "1.25",
  }),
  filterFn("contrast", "contrast", { 50: "0.5", 75: "0.75", 100: "1", 125: "1.25", 150: "1.5" }),
  filterFn("saturate", "saturate", { 0: "0", 50: "0.5", 100: "1", 150: "1.5", 200: "2" }),
  staticFamily("filter-keywords", "effects", "Grayscale, invert, sepia and filter reset", {
    grayscale: [
      ["--nb-grayscale", "grayscale(1)"],
      ["filter", filter],
    ],
    invert: [
      ["--nb-invert", "invert(1)"],
      ["filter", filter],
    ],
    sepia: [
      ["--nb-sepia", "sepia(1)"],
      ["filter", filter],
    ],
    "filter-none": [["filter", "none"]],
  }),
  scaleFamily({
    name: "backdrop-blur",
    category: "effects",
    description: "Backdrop blur",
    roots: ["backdrop-blur"],
    properties: ["backdrop-filter"],
    scale: (t) => t.blur,
    tokenGroup: "blur",
    extra: { none: "0" },
    build: (v) => [
      ["--nb-backdrop-blur", `blur(${v})`],
      ["backdrop-filter", backdrop],
    ],
  }),
  filterFn(
    "backdrop-saturate",
    "backdrop-saturate",
    { 0: "0", 50: "0.5", 100: "1", 150: "1.5", 200: "2" },
    true,
  ),
  staticFamily("glass", "effects", "Frosted glass surface (translucent surface + backdrop blur)", {
    glass: [
      ["background-color", "color-mix(in oklch, var(--nb-color-surface-raised) 70%, transparent)"],
      [
        "border",
        "var(--nb-border-width-thin) solid color-mix(in oklch, var(--nb-color-border) 60%, transparent)",
      ],
      ["backdrop-filter", "blur(var(--nb-blur-md)) saturate(1.5)"],
    ],
  }),
  staticFamily("blend", "effects", "Blend modes", {
    ...keywords("mix-blend", "mix-blend-mode", blend),
    ...keywords("bg-blend", "background-blend-mode", blend),
  }),
];
