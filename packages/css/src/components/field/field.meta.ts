import { defineComponent, SINCE } from "../../meta.ts";

export default defineComponent({
  name: "field",
  title: "Field",
  description: "Label, control, hint and error message laid out consistently.",
  className: "nb-field",
  category: "forms",
  anatomy: [
    { part: "root", className: "nb-field", element: "div", required: true },
    {
      part: "label",
      className: "nb-field__label",
      element: "label",
      required: true,
      requiredParent: "nb-field",
    },
    { part: "required", className: "nb-field__required", element: "span", required: false },
    {
      part: "hint",
      className: "nb-field__hint",
      element: "p",
      required: false,
      requiredParent: "nb-field",
    },
    {
      part: "error",
      className: "nb-field__error",
      element: "p",
      required: false,
      requiredParent: "nb-field",
    },
  ],
  modifiers: [],
  sizes: [],
  states: ["user-invalid", "aria-invalid"],
  html: { element: "div" },
  a11y: {
    requirements: [
      "Associate the label with the control (for/id)",
      "Reference hint and error from the control with aria-describedby",
      "Add nb-field__error--auto to show the error only after the control becomes :user-invalid",
    ],
  },
  tokens: ["--nb-color-danger-text", "--nb-color-text-muted"],
  examples: [
    {
      title: "With hint and error",
      html: `<div class="nb-field" style="max-inline-size: 24rem">
  <label class="nb-field__label" for="f-email">Email <span class="nb-field__required" aria-hidden="true">*</span></label>
  <input class="nb-input" id="f-email" type="email" required aria-invalid="true" aria-describedby="f-email-hint f-email-error" value="not-an-email">
  <p class="nb-field__hint" id="f-email-hint">We never share your email.</p>
  <p class="nb-field__error" id="f-email-error">Enter a valid email address.</p>
</div>`,
    },
  ],
  status: "beta",
  since: SINCE,
});
