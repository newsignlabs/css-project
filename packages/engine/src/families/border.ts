import type { Family } from "../types.ts";
import { colorFamily, keywords, scaleFamily, staticFamily } from "./helpers.ts";

const widths = {
  0: "0",
  thin: "var(--nb-border-width-thin)",
  2: "var(--nb-border-width-medium)",
  medium: "var(--nb-border-width-medium)",
  4: "var(--nb-border-width-thick)",
  thick: "var(--nb-border-width-thick)",
  8: "8px",
};
const borderSides = [
  ["", ""],
  ["x", "-inline"],
  ["y", "-block"],
  ["s", "-inline-start"],
  ["e", "-inline-end"],
  ["t", "-block-start"],
  ["b", "-block-end"],
] as const;
const corners = [
  ["", ["border-radius"]],
  ["s", ["border-start-start-radius", "border-end-start-radius"]],
  ["e", ["border-start-end-radius", "border-end-end-radius"]],
  ["t", ["border-start-start-radius", "border-start-end-radius"]],
  ["b", ["border-end-start-radius", "border-end-end-radius"]],
  ["ss", ["border-start-start-radius"]],
  ["se", ["border-start-end-radius"]],
  ["es", ["border-end-start-radius"]],
  ["ee", ["border-end-end-radius"]],
] as const;
const ring = "var(--nb-ring-shadow, 0 0 transparent), var(--nb-shadow, 0 0 transparent)";

// T049 — borders, radius, outline, ring, divide.
export const border: Family[] = [
  staticFamily("border", "border", "Hairline border in the default border color", {
    border: [
      ["border-style", "solid"],
      ["border-width", "var(--nb-border-width-thin)"],
      ["border-color", "var(--nb-color-border)"],
    ],
    ...Object.fromEntries(
      borderSides.slice(1).map(([s, p]) => [
        `border-${s}`,
        [
          [`border${p}-style`, "solid"],
          [`border${p}-width`, "var(--nb-border-width-thin)"],
          [`border${p}-color`, "var(--nb-color-border)"],
        ],
      ]),
    ),
  }),
  ...borderSides.map(([s, p]) =>
    scaleFamily({
      name: `border${p}-width`,
      category: "border",
      description: `Border width${p ? ` (${p.slice(1)})` : ""}`,
      roots: [s ? `border-${s}` : "border"],
      properties: [`border${p}-width`],
      extra: widths,
      build: (v) => [
        [`border${p}-style`, "solid"],
        [`border${p}-width`, v],
      ],
    }),
  ),
  staticFamily("border-style", "border", "Border style", {
    ...keywords("border", "border-style", {
      solid: "solid",
      dashed: "dashed",
      dotted: "dotted",
      double: "double",
      none: "none",
    }),
  }),
  colorFamily({
    name: "border-color",
    description: "Border color; border-strong/subtle resolve color.border.*",
    roots: ["border"],
    properties: ["border-color"],
    ns: "border",
  }),
  ...corners.map(([s, props]) =>
    scaleFamily({
      name: s ? `border-radius-${s}` : "border-radius",
      category: "border",
      description: `Corner radius${s ? ` (${s})` : ""}`,
      roots: [s ? `rounded-${s}` : "rounded"],
      properties: [...props],
      scale: (t) => t.radius,
      tokenGroup: "radius",
    }),
  ),
  staticFamily("outline-keywords", "border", "Outline presets", {
    outline: [["outline-style", "solid"]],
    "outline-hidden": [
      ["outline", "2px solid transparent"],
      ["outline-offset", "2px"],
    ],
    "outline-none": [["outline-style", "none"]],
    ...keywords("outline", "outline-style", {
      dashed: "dashed",
      dotted: "dotted",
      double: "double",
    }),
  }),
  scaleFamily({
    name: "outline-width",
    category: "border",
    description: "Outline width",
    roots: ["outline"],
    properties: ["outline-width"],
    extra: { 0: "0", 1: "1px", 2: "2px", 4: "4px", 8: "8px" },
    build: (v) => [
      ["outline-style", "var(--nb-outline-style, solid)"],
      ["outline-width", v],
    ],
  }),
  colorFamily({
    name: "outline-color",
    description: "Outline color",
    roots: ["outline"],
    properties: ["outline-color"],
  }),
  scaleFamily({
    name: "outline-offset",
    category: "border",
    description: "Outline offset",
    roots: ["outline-offset"],
    properties: ["outline-offset"],
    extra: { 0: "0", 1: "1px", 2: "2px", 4: "4px", 8: "8px" },
    negative: true,
  }),
  staticFamily("ring-keywords", "border", "Focus-style ring presets", {
    ring: [
      ["--nb-ring-shadow", "0 0 0 3px var(--nb-ring-color, var(--nb-color-focus-ring))"],
      ["box-shadow", ring],
    ],
    "ring-inset": [["--nb-ring-inset", "inset"]],
  }),
  scaleFamily({
    name: "ring-width",
    category: "border",
    description: "Ring (box-shadow outline) width; composes with shadow-*",
    roots: ["ring"],
    properties: ["box-shadow"],
    extra: { 0: "0px", 1: "1px", 2: "2px", 4: "4px", 8: "8px" },
    build: (v) => [
      [
        "--nb-ring-shadow",
        `var(--nb-ring-inset,) 0 0 0 ${v} var(--nb-ring-color, var(--nb-color-focus-ring))`,
      ],
      ["box-shadow", ring],
    ],
  }),
  colorFamily({
    name: "ring-color",
    description: "Ring color",
    roots: ["ring"],
    properties: ["--nb-ring-color"],
  }),
  scaleFamily({
    name: "divide-x",
    category: "border",
    description: "Inline borders between children",
    roots: ["divide-x"],
    properties: ["border-inline-end-width"],
    extra: { DEFAULT: "var(--nb-border-width-thin)", ...widths },
    selector: ":where(& > :not(:last-child))",
    build: (v) => [
      ["border-inline-end-style", "solid"],
      ["border-inline-end-width", v],
      ["border-inline-end-color", "var(--nb-divide-color, var(--nb-color-border))"],
    ],
  }),
  scaleFamily({
    name: "divide-y",
    category: "border",
    description: "Block borders between children",
    roots: ["divide-y"],
    properties: ["border-block-end-width"],
    extra: { DEFAULT: "var(--nb-border-width-thin)", ...widths },
    selector: ":where(& > :not(:last-child))",
    build: (v) => [
      ["border-block-end-style", "solid"],
      ["border-block-end-width", v],
      ["border-block-end-color", "var(--nb-divide-color, var(--nb-color-border))"],
    ],
  }),
  colorFamily({
    name: "divide-color",
    description: "Divider color",
    roots: ["divide"],
    properties: ["--nb-divide-color"],
  }),
];
