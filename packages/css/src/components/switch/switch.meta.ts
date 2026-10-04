import { defineComponent, SINCE } from "../../meta.ts";

export default defineComponent({
  name: "switch",
  title: "Switch",
  description: "On/off toggle built on a native checkbox with role=switch.",
  className: "nb-switch",
  category: "forms",
  anatomy: [
    { part: "label", className: "nb-switch-label", element: "label", required: false },
    { part: "root", className: "nb-switch", element: "input", required: true },
  ],
  modifiers: [],
  sizes: [],
  states: ["checked", "disabled", "focus-visible"],
  html: { element: "input", attributes: { type: "checkbox", role: "switch" } },
  a11y: {
    role: "switch",
    requirements: [
      'Use <input type="checkbox" role="switch"> with a label',
      "Changes should apply immediately",
    ],
    keyboard: ["Space toggles"],
  },
  tokens: ["--nb-color-accent", "--nb-size-target"],
  examples: [
    {
      title: "Basic",
      html: `<div class="nb-stack nb-stack--xs">
  <label class="nb-switch-label"><input class="nb-switch" type="checkbox" role="switch" checked> Dark mode</label>
  <label class="nb-switch-label"><input class="nb-switch" type="checkbox" role="switch"> Notifications</label>
  <label class="nb-switch-label"><input class="nb-switch" type="checkbox" role="switch" disabled> Beta features</label>
</div>`,
    },
  ],
  status: "beta",
  since: SINCE,
});
