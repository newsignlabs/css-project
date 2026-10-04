import { defineComponent, SINCE } from "../../meta.ts";

export default defineComponent({
  name: "badge",
  title: "Badge",
  description: "Small status or count label.",
  className: "nb-badge",
  category: "content",
  anatomy: [{ part: "root", className: "nb-badge", element: "span", required: true }],
  modifiers: [
    { name: "accent", className: "nb-badge--accent", description: "Brand tone" },
    { name: "success", className: "nb-badge--success", description: "Positive tone" },
    { name: "warning", className: "nb-badge--warning", description: "Caution tone" },
    { name: "danger", className: "nb-badge--danger", description: "Error tone" },
    { name: "info", className: "nb-badge--info", description: "Informational tone" },
    {
      name: "solid",
      className: "nb-badge--solid",
      description: "Filled instead of tinted; combine with a tone",
    },
    { name: "dot", className: "nb-badge--dot", description: "Leading status dot" },
  ],
  sizes: [],
  states: [],
  html: { element: "span" },
  a11y: { requirements: ["Do not rely on color alone: the text must state the status"] },
  tokens: ["--nb-color-success-subtle", "--nb-color-success-text", "--nb-radius-full"],
  examples: [
    {
      title: "Tones",
      html: `<div class="nb-cluster">
  <span class="nb-badge">Neutral</span>
  <span class="nb-badge nb-badge--accent">New</span>
  <span class="nb-badge nb-badge--success nb-badge--dot">Active</span>
  <span class="nb-badge nb-badge--warning">Pending</span>
  <span class="nb-badge nb-badge--danger">Failed</span>
  <span class="nb-badge nb-badge--info nb-badge--solid">Beta</span>
</div>`,
    },
  ],
  status: "beta",
  since: SINCE,
});
