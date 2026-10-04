import type { Family } from "../types.ts";
import { keywords, range, scaleFamily, staticFamily } from "./helpers.ts";

// T043 — display, position, inset, z-index, overflow, container, columns, aspect ratio, visibility, object fit.
export const layout: Family[] = [
  staticFamily("display", "layout", "Display type", {
    ...keywords("", "display", {
      block: "block",
      "inline-block": "inline-block",
      inline: "inline",
      flex: "flex",
      "inline-flex": "inline-flex",
      grid: "grid",
      "inline-grid": "inline-grid",
      contents: "contents",
      "flow-root": "flow-root",
      table: "table",
      "table-row": "table-row",
      "table-cell": "table-cell",
      "list-item": "list-item",
      hidden: "none",
    }),
  }),
  staticFamily("position", "layout", "Positioning scheme", {
    ...keywords("", "position", {
      static: "static",
      relative: "relative",
      absolute: "absolute",
      fixed: "fixed",
      sticky: "sticky",
    }),
  }),
  staticFamily("box-sizing", "layout", "Box sizing", {
    "box-border": [["box-sizing", "border-box"]],
    "box-content": [["box-sizing", "content-box"]],
  }),
  staticFamily("visibility", "layout", "Visibility", {
    ...keywords("", "visibility", {
      visible: "visible",
      invisible: "hidden",
      collapse: "collapse",
    }),
  }),
  staticFamily("isolation", "layout", "Stacking context isolation", {
    isolate: [["isolation", "isolate"]],
    "isolation-auto": [["isolation", "auto"]],
  }),
  staticFamily("container-type", "layout", "Establishes a size container for @sm…@2xl variants", {
    "@container": [["container-type", "inline-size"]],
    "@container-size": [["container-type", "size"]],
    "@container-normal": [["container-type", "normal"]],
  }),
  ...(
    [
      ["inset", ["inset"]],
      ["inset-x", ["inset-inline"]],
      ["inset-y", ["inset-block"]],
      ["start", ["inset-inline-start"]],
      ["end", ["inset-inline-end"]],
      ["top", ["inset-block-start"]],
      ["bottom", ["inset-block-end"]],
    ] as const
  ).map(([root, props]) =>
    scaleFamily({
      name: root === "inset" ? "inset" : `inset-${root.replace("inset-", "")}`,
      category: "layout",
      description: `Logical inset (${props.join(", ")}); top/bottom map to the block axis`,
      roots: [root],
      properties: [...props],
      scale: (t) => t.space,
      tokenGroup: "space",
      extra: { auto: "auto", full: "100%", px: "1px" },
      negative: true,
      fractions: true,
    }),
  ),
  scaleFamily({
    name: "z-index",
    category: "layout",
    description: "Stacking order: token layers (dropdown, modal…) or numbers",
    roots: ["z"],
    properties: ["z-index"],
    scale: (t) => t.z,
    tokenGroup: "z",
    extra: { auto: "auto", ...Object.fromEntries(range(0, 50, 10).map((n) => [n, n])) },
    arbitrary: "number",
    negative: true,
  }),
  staticFamily("overflow", "layout", "Overflow behaviour", {
    ...keywords("overflow", "overflow", {
      auto: "auto",
      hidden: "hidden",
      clip: "clip",
      visible: "visible",
      scroll: "scroll",
    }),
    ...keywords("overflow-x", "overflow-x", {
      auto: "auto",
      hidden: "hidden",
      clip: "clip",
      visible: "visible",
      scroll: "scroll",
    }),
    ...keywords("overflow-y", "overflow-y", {
      auto: "auto",
      hidden: "hidden",
      clip: "clip",
      visible: "visible",
      scroll: "scroll",
    }),
    ...keywords("overscroll", "overscroll-behavior", {
      auto: "auto",
      contain: "contain",
      none: "none",
    }),
  }),
  scaleFamily({
    name: "columns",
    category: "layout",
    description: "Multi-column layout",
    roots: ["columns"],
    properties: ["columns"],
    extra: { auto: "auto", ...Object.fromEntries(range(1, 12).map((n) => [n, n])) },
    arbitrary: "length",
  }),
  scaleFamily({
    name: "aspect-ratio",
    category: "layout",
    description: "Aspect ratio",
    roots: ["aspect"],
    properties: ["aspect-ratio"],
    extra: { auto: "auto", square: "1", video: "16 / 9", photo: "4 / 3", portrait: "3 / 4" },
    arbitrary: "number",
  }),
  staticFamily("object-fit", "layout", "Replaced element fit and position", {
    ...keywords("object", "object-fit", {
      contain: "contain",
      cover: "cover",
      fill: "fill",
      none: "none",
      "scale-down": "scale-down",
    }),
    ...keywords("object", "object-position", { center: "center", top: "top", bottom: "bottom" }),
  }),
];
