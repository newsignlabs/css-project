import { defineComponent, SINCE } from "../../meta.ts";

export default defineComponent({
  name: "alert",
  title: "Alert",
  description:
    "Inline message communicating status, with optional title, actions and dismiss button.",
  className: "nb-alert",
  category: "feedback",
  anatomy: [
    { part: "root", className: "nb-alert", element: "div", required: true },
    {
      part: "icon",
      className: "nb-alert__icon",
      element: "span",
      required: false,
      requiredParent: "nb-alert",
    },
    {
      part: "content",
      className: "nb-alert__content",
      element: "div",
      required: true,
      requiredParent: "nb-alert",
    },
    {
      part: "title",
      className: "nb-alert__title",
      element: "p",
      required: false,
      requiredParent: "nb-alert__content",
    },
    { part: "actions", className: "nb-alert__actions", element: "div", required: false },
    {
      part: "close",
      className: "nb-alert__close",
      element: "button",
      required: false,
      requiredParent: "nb-alert",
    },
  ],
  modifiers: [
    { name: "success", className: "nb-alert--success", description: "Positive outcome" },
    { name: "warning", className: "nb-alert--warning", description: "Caution" },
    { name: "danger", className: "nb-alert--danger", description: "Error or destructive outcome" },
  ],
  sizes: [],
  states: [],
  html: { element: "div", attributes: { role: "status" } },
  a11y: {
    role: "status",
    requirements: [
      "Use role=status for polite updates and role=alert only for urgent, time-sensitive errors",
      "Decorative icons get aria-hidden=true; the title text must convey the tone",
      "Close buttons need aria-label",
    ],
  },
  tokens: ["--nb-color-info-subtle", "--nb-color-info-text", "--nb-radius-md"],
  examples: [
    {
      title: "Tones",
      html: `<div class="nb-stack nb-stack--sm">
  <div class="nb-alert" role="status"><span class="nb-alert__icon" aria-hidden="true">ℹ</span>
    <div class="nb-alert__content"><p class="nb-alert__title">Heads up</p><p>New tokens are available in v0.2.</p></div></div>
  <div class="nb-alert nb-alert--success" role="status"><span class="nb-alert__icon" aria-hidden="true">✓</span>
    <div class="nb-alert__content"><p class="nb-alert__title">Saved</p><p>Your theme was published.</p></div></div>
  <div class="nb-alert nb-alert--warning" role="status"><span class="nb-alert__icon" aria-hidden="true">!</span>
    <div class="nb-alert__content"><p class="nb-alert__title">Almost out of quota</p><p>90% of builds used.</p></div></div>
  <div class="nb-alert nb-alert--danger" role="alert"><span class="nb-alert__icon" aria-hidden="true">✕</span>
    <div class="nb-alert__content"><p class="nb-alert__title">Build failed</p><p>Contrast check failed for 2 pairs.</p>
      <div class="nb-alert__actions"><button class="nb-btn nb-btn--sm" type="button">View report</button></div></div>
    <button class="nb-alert__close" type="button" aria-label="Dismiss">×</button></div>
</div>`,
    },
  ],
  status: "beta",
  since: SINCE,
});
