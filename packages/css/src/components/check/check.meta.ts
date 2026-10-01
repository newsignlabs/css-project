import { defineComponent, SINCE } from "../../meta.ts";

export default defineComponent({
  name: "check",
  title: "Checkbox & radio",
  description:
    "Native checkbox or radio wrapped in its label, sized to meet the 24px target minimum.",
  className: "nb-check",
  category: "forms",
  anatomy: [
    { part: "root", className: "nb-check", element: "label", required: true },
    {
      part: "input",
      className: "nb-check > input",
      element: "input",
      required: true,
      requiredParent: "nb-check",
    },
    {
      part: "description",
      className: "nb-check__description",
      element: "span",
      required: false,
      requiredParent: "nb-check",
    },
  ],
  modifiers: [],
  sizes: [],
  states: ["checked", "indeterminate", "disabled", "focus-visible"],
  html: { element: "label" },
  a11y: {
    requirements: [
      "Group related options in a <fieldset> with a <legend>",
      "Radios in a group share the same name attribute",
    ],
    keyboard: ["Space toggles a checkbox", "Arrow keys move between radios in a group"],
  },
  tokens: ["--nb-color-accent", "--nb-size-target"],
  examples: [
    {
      title: "Checkboxes and radios",
      html: `<fieldset class="nb-stack nb-stack--xs">
  <legend>Notifications</legend>
  <label class="nb-check"><input type="checkbox" checked> Email</label>
  <label class="nb-check"><input type="checkbox"> <span>SMS <span class="nb-check__description">Carrier rates may apply.</span></span></label>
  <label class="nb-check"><input type="radio" name="freq" checked> Daily</label>
  <label class="nb-check"><input type="radio" name="freq"> Weekly</label>
  <label class="nb-check"><input type="checkbox" disabled> Push (unavailable)</label>
</fieldset>`,
    },
  ],
  status: "beta",
  since: SINCE,
});
