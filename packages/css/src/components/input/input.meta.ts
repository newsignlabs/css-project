import { defineComponent, SINCE } from "../../meta.ts";

export default defineComponent({
  name: "input",
  title: "Input",
  description: "Text input and textarea with hover, focus, invalid, disabled and read-only states.",
  className: "nb-input",
  category: "forms",
  anatomy: [{ part: "root", className: "nb-input", element: "input", required: true }],
  modifiers: [],
  sizes: ["sm", "md", "lg"],
  states: ["hover", "focus-visible", "user-invalid", "aria-invalid", "disabled", "read-only"],
  html: { element: "input", attributes: { type: "text" } },
  a11y: {
    requirements: [
      "Every input needs a visible <label> (placeholder is not a label)",
      "Use the correct type and autocomplete attributes",
    ],
  },
  tokens: ["--nb-control-height-md", "--nb-control-radius", "--nb-color-border-strong"],
  examples: [
    {
      title: "States",
      html: `<div class="nb-stack nb-stack--sm" style="max-inline-size: 24rem">
  <label for="i1">Name</label><input class="nb-input" id="i1" type="text" placeholder="Ada Lovelace" autocomplete="name">
  <label for="i2">Disabled</label><input class="nb-input" id="i2" type="text" value="Locked" disabled>
  <label for="i3">Notes</label><textarea class="nb-input" id="i3">Grows with its content where supported.</textarea>
</div>`,
    },
  ],
  status: "beta",
  since: SINCE,
});
