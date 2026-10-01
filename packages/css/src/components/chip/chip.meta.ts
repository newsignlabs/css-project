import { defineComponent, SINCE } from "../../meta.ts";

export default defineComponent({
  name: "chip",
  title: "Chip",
  description: "Compact interactive token: filters, selections and removable tags.",
  className: "nb-chip",
  category: "content",
  anatomy: [
    { part: "root", className: "nb-chip", element: "label", required: true },
    {
      part: "remove",
      className: "nb-chip__remove",
      element: "button",
      required: false,
      requiredParent: "nb-chip",
    },
  ],
  modifiers: [],
  sizes: [],
  states: ["hover", "focus-visible", "checked", "aria-pressed"],
  html: { element: "label" },
  a11y: {
    requirements: [
      "Filter chips: wrap a native checkbox/radio in a <label class=nb-chip> or use <button aria-pressed>",
      "Remove buttons need aria-label naming the item",
    ],
  },
  tokens: ["--nb-control-height-sm", "--nb-radius-full"],
  examples: [
    {
      title: "Filter chips",
      html: `<fieldset class="nb-cluster" style="border: 0; padding: 0">
  <legend>Filter by tag</legend>
  <label class="nb-chip"><input type="checkbox" checked> Design</label>
  <label class="nb-chip"><input type="checkbox"> Engineering</label>
  <button class="nb-chip" type="button" aria-pressed="false">Remote</button>
  <span class="nb-chip">CSS <button class="nb-chip__remove" type="button" aria-label="Remove CSS">×</button></span>
</fieldset>`,
    },
  ],
  status: "beta",
  since: SINCE,
});
