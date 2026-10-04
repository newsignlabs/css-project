import { defineComponent, SINCE } from "../meta.ts";

const layout = (
  name: string,
  title: string,
  description: string,
  modifiers: [string, string][],
  props: string[],
  example: string,
) =>
  defineComponent({
    name,
    title,
    description,
    className: `nb-${name}`,
    category: "layout",
    anatomy: [{ part: "root", className: `nb-${name}`, required: true }],
    modifiers: modifiers.map(([m, d]) => ({
      name: m,
      className: `nb-${name}--${m}`,
      description: d,
    })),
    sizes: [],
    states: [],
    html: { element: "div" },
    a11y: { requirements: ["Purely presentational; keep DOM order equal to reading order"] },
    tokens: props,
    examples: [{ title, html: example }],
    status: "beta",
    since: SINCE,
  });

const boxes = (n: number, label = "Item") =>
  Array.from(
    { length: n },
    (_, i) => `<div class="nb-card"><div class="nb-card__body">${label} ${i + 1}</div></div>`,
  ).join("");

export default [
  layout(
    "container",
    "Container",
    "Centers content with a max inline size and fluid gutters.",
    [
      ["narrow", "48rem max"],
      ["wide", "96rem max"],
      ["full", "No max width"],
    ],
    ["--nb-container-max"],
    `<div class="nb-container"><p>Centered content with fluid gutters.</p></div>`,
  ),
  layout(
    "stack",
    "Stack",
    "Vertical flow with consistent gaps between children.",
    [
      ["xs", "Extra-small gap"],
      ["sm", "Small gap"],
      ["lg", "Large gap"],
      ["xl", "Extra-large gap"],
    ],
    ["--nb-stack-gap"],
    `<div class="nb-stack">${boxes(3)}</div>`,
  ),
  layout(
    "cluster",
    "Cluster",
    "Inline group that wraps — tags, buttons, toolbars.",
    [
      ["between", "Space between"],
      ["end", "Align to the end"],
      ["center", "Center"],
    ],
    ["--nb-cluster-gap", "--nb-cluster-justify", "--nb-cluster-align"],
    `<div class="nb-cluster"><span class="nb-badge">One</span><span class="nb-badge">Two</span><span class="nb-badge">Three</span></div>`,
  ),
  layout(
    "grid",
    "Grid",
    "Auto-fitting responsive grid without breakpoints.",
    [
      ["sm", "10rem minimum column"],
      ["lg", "22rem minimum column"],
    ],
    ["--nb-grid-min", "--nb-grid-gap"],
    `<div class="nb-grid">${boxes(4)}</div>`,
  ),
  layout(
    "sidebar",
    "Sidebar",
    "Two-pane layout; the sidebar wraps below content when space runs out.",
    [["end", "Sidebar on the inline end"]],
    ["--nb-sidebar-width", "--nb-sidebar-content-min", "--nb-sidebar-gap"],
    `<div class="nb-sidebar"><aside aria-label="Filters">${boxes(1, "Sidebar")}</aside><div>${boxes(1, "Content")}</div></div>`,
  ),
  layout(
    "switcher",
    "Switcher",
    "Row of equal children that switches to a column below a container threshold.",
    [],
    ["--nb-switcher-threshold", "--nb-switcher-gap"],
    `<div class="nb-switcher">${boxes(3)}</div>`,
  ),
  layout(
    "center",
    "Center",
    "Horizontally centered measure for readable text.",
    [
      ["text", "Center-align text"],
      ["intrinsic", "Center children by their own width"],
    ],
    ["--nb-center-max", "--nb-center-gutter"],
    `<div class="nb-center"><p>Readable measure, centered.</p></div>`,
  ),
  layout(
    "cover",
    "Cover",
    "Full-height region with a vertically centered principal element.",
    [],
    ["--nb-cover-min"],
    `<div class="nb-cover" style="--nb-cover-min: 16rem"><header>Top</header><h2 class="nb-cover__principal">Centered</h2><footer>Bottom</footer></div>`,
  ),
  layout(
    "frame",
    "Frame",
    "Aspect-ratio box that crops media to fit.",
    [
      ["square", "1:1"],
      ["photo", "4:3"],
      ["portrait", "3:4"],
    ],
    ["--nb-frame-ratio"],
    `<div class="nb-frame nb-frame--photo"><img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 4 3'/%3E" alt="Placeholder"></div>`,
  ),
];
