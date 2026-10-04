import { defineComponent, SINCE } from "../../meta.ts";

export default defineComponent({
  name: "accordion",
  title: "Accordion",
  description:
    "Disclosure list built on <details>/<summary>. A shared name attribute makes items exclusive; height animates where ::details-content is supported.",
  className: "nb-accordion",
  category: "overlay",
  anatomy: [
    { part: "root", className: "nb-accordion", element: "div", required: true },
    {
      part: "item",
      className: "nb-accordion__item",
      element: "details",
      required: true,
      requiredParent: "nb-accordion",
    },
    {
      part: "trigger",
      className: "nb-accordion__trigger",
      element: "summary",
      required: true,
      requiredParent: "nb-accordion__item",
    },
    {
      part: "panel",
      className: "nb-accordion__panel",
      element: "div",
      required: true,
      requiredParent: "nb-accordion__item",
    },
  ],
  modifiers: [],
  sizes: [],
  states: ["open", "hover", "focus-visible"],
  html: { element: "div" },
  a11y: {
    requirements: [
      "The <summary> is the accessible trigger; keep its text concise",
      'Use name="group" on <details> for exclusive (one-open) behaviour',
    ],
    keyboard: ["Enter / Space toggles"],
  },
  tokens: ["--nb-color-border", "--nb-control-height-lg"],
  examples: [
    {
      title: "FAQ",
      html: `<div class="nb-accordion">
  <details class="nb-accordion__item" name="faq" open>
    <summary class="nb-accordion__trigger">Does newBrush need JavaScript?</summary>
    <div class="nb-accordion__panel"><p>No. Every component works with CSS and native HTML alone.</p></div>
  </details>
  <details class="nb-accordion__item" name="faq">
    <summary class="nb-accordion__trigger">Can I theme it?</summary>
    <div class="nb-accordion__panel"><p>Yes — override tokens or generate a theme from one brand color.</p></div>
  </details>
</div>`,
    },
  ],
  status: "beta",
  since: SINCE,
});
