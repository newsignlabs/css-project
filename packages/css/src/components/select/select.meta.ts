import { defineComponent, SINCE } from "../../meta.ts";

export default defineComponent({
  name: "select",
  title: "Select",
  description: "Native <select> with consistent styling; the wrapper draws the chevron.",
  className: "nb-select",
  category: "forms",
  anatomy: [
    { part: "root", className: "nb-select", element: "div", required: true },
    {
      part: "control",
      className: "nb-select > select",
      element: "select",
      required: true,
      requiredParent: "nb-select",
    },
  ],
  modifiers: [],
  sizes: [],
  states: ["focus-visible", "disabled", "user-invalid", "aria-invalid"],
  html: { element: "div" },
  a11y: {
    requirements: [
      "Associate a <label> with the <select>",
      "Keep the native <select> for keyboard and screen readers",
    ],
  },
  tokens: ["--nb-control-height-md", "--nb-control-radius"],
  examples: [
    {
      title: "Basic",
      html: `<div style="max-inline-size: 24rem">
  <label for="s1">Plan</label>
  <div class="nb-select"><select id="s1"><option>Starter</option><option selected>Pro</option><option>Team</option></select></div>
</div>`,
    },
  ],
  status: "beta",
  since: SINCE,
});
