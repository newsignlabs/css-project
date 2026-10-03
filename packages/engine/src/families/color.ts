import type { Family } from "../types.ts";
import { colorFamily, keywords, range, scaleFamily, staticFamily } from "./helpers.ts";

const stops =
  "var(--nb-gradient-from, transparent), var(--nb-gradient-via, transparent), var(--nb-gradient-to, transparent)";

// T048 — color, background and gradients.
export const color: Family[] = [
  colorFamily({
    name: "background-color",
    description: "Background color; bg-surface-* and palette steps",
    roots: ["bg"],
    properties: ["background-color"],
    ns: "surface",
  }),
  {
    name: "background-image",
    category: "color",
    description:
      "Linear gradient between from-/via-/to- colors: bg-linear-to-t, bg-linear-to-b or bg-linear-<angle>",
    roots: ["bg-linear"],
    properties: ["background-image"],
    valueSource: { source: "static", map: { "to-t": "to top", "to-b": "to bottom" } },
    values: () => ["to-t", "to-b", "0", "45", "90", "135", "180"],
    resolve(input) {
      if (input.negative || input.modifier !== undefined || input.arbitrary) return null;
      const dir =
        input.value === "to-t"
          ? "to top"
          : input.value === "to-b"
            ? "to bottom"
            : /^\d{1,3}$/.test(input.value ?? "")
              ? `${input.value}deg`
              : null;
      return dir ? { decls: [["background-image", `linear-gradient(${dir}, ${stops})`]] } : null;
    },
  },
  {
    name: "background-image-arbitrary",
    category: "color",
    description: "Arbitrary gradient background: bg-[linear-gradient(…)] (url() is never allowed)",
    roots: ["bg"],
    arbitrary: "image-safe",
    properties: ["background-image"],
    valueSource: { source: "static", map: {} },
    values: () => [],
    resolve: (input) =>
      input.arbitrary && !input.negative && input.modifier === undefined
        ? { decls: [["background-image", input.arbitrary]] }
        : null,
  },
  colorFamily({
    name: "gradient-from",
    description: "Gradient start color",
    roots: ["from"],
    properties: ["--nb-gradient-from"],
  }),
  colorFamily({
    name: "gradient-via",
    description: "Gradient middle color",
    roots: ["via"],
    properties: ["--nb-gradient-via"],
  }),
  colorFamily({
    name: "gradient-to",
    description: "Gradient end color",
    roots: ["to"],
    properties: ["--nb-gradient-to"],
  }),
  staticFamily("background", "color", "Background size, position, repeat, attachment and clip", {
    ...keywords("bg", "background-size", { auto: "auto", cover: "cover", contain: "contain" }),
    ...keywords("bg", "background-position", { center: "center", top: "top", bottom: "bottom" }),
    ...keywords("bg", "background-repeat", {
      repeat: "repeat",
      "no-repeat": "no-repeat",
      "repeat-x": "repeat-x",
      "repeat-y": "repeat-y",
    }),
    ...keywords("bg", "background-attachment", {
      fixed: "fixed",
      local: "local",
      scroll: "scroll",
    }),
    ...keywords("bg-clip", "background-clip", {
      border: "border-box",
      padding: "padding-box",
      content: "content-box",
      text: "text",
    }),
    "bg-none": [["background-image", "none"]],
  }),
  scaleFamily({
    name: "opacity",
    category: "color",
    description: "Opacity 0–100 in steps of 5, or tokens (disabled, muted)",
    roots: ["opacity"],
    properties: ["opacity"],
    scale: (t) => t.opacity,
    tokenGroup: "opacity",
    extra: Object.fromEntries(range(0, 100, 5).map((n) => [n, String(Number(n) / 100)])),
    arbitrary: "number",
  }),
  colorFamily({ name: "fill", description: "SVG fill", roots: ["fill"], properties: ["fill"] }),
  colorFamily({
    name: "stroke",
    description: "SVG stroke",
    roots: ["stroke"],
    properties: ["stroke"],
  }),
  scaleFamily({
    name: "stroke-width",
    category: "color",
    description: "SVG stroke width",
    roots: ["stroke"],
    properties: ["stroke-width"],
    extra: { 0: "0", 1: "1", 2: "2" },
    arbitrary: "number",
  }),
  colorFamily({
    name: "accent-color",
    description: "Accent color of native controls",
    roots: ["accent"],
    properties: ["accent-color"],
  }),
  colorFamily({
    name: "caret-color",
    description: "Text caret color",
    roots: ["caret"],
    properties: ["caret-color"],
  }),
];
