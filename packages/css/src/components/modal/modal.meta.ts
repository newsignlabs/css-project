import { defineComponent, SINCE } from "../../meta.ts";

export default defineComponent({
  name: "modal",
  title: "Modal",
  description:
    "Dialog built on native <dialog>: focus trapping, Esc to close and inert background come from the platform. Open with dialog.showModal() or the command/commandfor attributes.",
  className: "nb-modal",
  category: "overlay",
  anatomy: [
    { part: "root", className: "nb-modal", element: "dialog", required: true },
    {
      part: "header",
      className: "nb-modal__header",
      element: "header",
      required: false,
      requiredParent: "nb-modal",
    },
    { part: "title", className: "nb-modal__title", element: "h2", required: true },
    { part: "close", className: "nb-modal__close", element: "button", required: false },
    {
      part: "body",
      className: "nb-modal__body",
      element: "div",
      required: true,
      requiredParent: "nb-modal",
    },
    {
      part: "footer",
      className: "nb-modal__footer",
      element: "footer",
      required: false,
      requiredParent: "nb-modal",
    },
  ],
  modifiers: [],
  sizes: ["sm", "md", "lg"],
  states: ["open"],
  html: { element: "dialog", attributes: { "aria-labelledby": "" } },
  a11y: {
    requirements: [
      "Point aria-labelledby at the title",
      'Close with <form method="dialog"> buttons so focus returns to the opener',
      "Open with showModal() (not show()) to get an inert background",
    ],
    keyboard: ["Esc closes", "Tab cycles within the dialog"],
  },
  tokens: [
    "--nb-color-surface-overlay",
    "--nb-elevation-5",
    "--nb-radius-xl",
    "--nb-color-backdrop",
  ],
  examples: [
    {
      title: "Confirm dialog (shown open, non-modal, for preview)",
      html: `<dialog class="nb-modal" open aria-labelledby="m-title" style="position: static">
  <header class="nb-modal__header">
    <h2 class="nb-modal__title" id="m-title">Delete theme?</h2>
    <form method="dialog"><button class="nb-btn nb-btn--ghost nb-btn--icon nb-modal__close" type="submit" aria-label="Close">×</button></form>
  </header>
  <div class="nb-modal__body"><p>“Ocean” will be removed from all projects. This cannot be undone.</p></div>
  <form class="nb-modal__footer" method="dialog">
    <button class="nb-btn" type="submit" value="cancel">Cancel</button>
    <button class="nb-btn nb-btn--danger" type="submit" value="delete">Delete</button>
  </form>
</dialog>`,
    },
  ],
  status: "beta",
  since: SINCE,
});
