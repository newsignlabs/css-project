import { defineComponent, SINCE } from "../../meta.ts";

export default [
  defineComponent({
    name: "button",
    title: "Button",
    description:
      "Triggers an action. Works on <button> and on <a> for navigation styled as a button.",
    className: "nb-btn",
    category: "actions",
    anatomy: [{ part: "root", className: "nb-btn", element: "button", required: true }],
    modifiers: [
      {
        name: "primary",
        className: "nb-btn--primary",
        description: "Main call to action (accent fill)",
      },
      { name: "danger", className: "nb-btn--danger", description: "Destructive action" },
      { name: "ghost", className: "nb-btn--ghost", description: "Low emphasis, no border or fill" },
      {
        name: "link",
        className: "nb-btn--link",
        description: "Looks like a link, behaves like a button",
      },
      { name: "block", className: "nb-btn--block", description: "Full inline size" },
      {
        name: "icon",
        className: "nb-btn--icon",
        description: "Square icon-only button (requires aria-label)",
      },
    ],
    sizes: ["sm", "md", "lg"],
    states: ["hover", "active", "focus-visible", "disabled", "aria-disabled", "aria-busy"],
    html: { element: "button", attributes: { type: "button" } },
    a11y: {
      requirements: [
        "Must have an accessible name (text content or aria-label for icon buttons)",
        "Use <button type=button> for actions and <a href> for navigation",
        "Use aria-busy=true while loading; aria-disabled=true keeps the button focusable",
      ],
      keyboard: ["Enter / Space activates"],
    },
    tokens: [
      "--nb-control-height-md",
      "--nb-control-padding-inline-md",
      "--nb-control-radius",
      "--nb-color-accent",
    ],
    examples: [
      {
        title: "Variants",
        html: `<div class="nb-cluster">
  <button class="nb-btn nb-btn--primary" type="button">Primary</button>
  <button class="nb-btn" type="button">Secondary</button>
  <button class="nb-btn nb-btn--ghost" type="button">Ghost</button>
  <button class="nb-btn nb-btn--danger" type="button">Delete</button>
  <button class="nb-btn nb-btn--link" type="button">Link</button>
</div>`,
      },
      {
        title: "Sizes and states",
        html: `<div class="nb-cluster">
  <button class="nb-btn nb-btn--primary nb-btn--sm" type="button">Small</button>
  <button class="nb-btn nb-btn--primary nb-btn--lg" type="button">Large</button>
  <button class="nb-btn" type="button" disabled>Disabled</button>
  <button class="nb-btn nb-btn--primary" type="button" aria-busy="true">Saving</button>
  <button class="nb-btn nb-btn--icon" type="button" aria-label="Settings">⚙</button>
</div>`,
      },
    ],
    status: "beta",
    since: SINCE,
  }),
  defineComponent({
    name: "button-group",
    title: "Button group",
    description: "Joins related buttons into one segmented control.",
    className: "nb-btn-group",
    category: "actions",
    anatomy: [
      { part: "root", className: "nb-btn-group", required: true },
      {
        part: "button",
        className: "nb-btn",
        element: "button",
        required: true,
        requiredParent: "nb-btn-group",
      },
    ],
    modifiers: [],
    sizes: [],
    states: [],
    html: { element: "div", attributes: { role: "group" } },
    a11y: { role: "group", requirements: ["Give the group an accessible name with aria-label"] },
    tokens: ["--nb-control-radius"],
    examples: [
      {
        title: "Segmented",
        html: `<div class="nb-btn-group" role="group" aria-label="Text alignment">
  <button class="nb-btn" type="button" aria-pressed="true">Start</button>
  <button class="nb-btn" type="button" aria-pressed="false">Center</button>
  <button class="nb-btn" type="button" aria-pressed="false">End</button>
</div>`,
      },
    ],
    status: "beta",
    since: SINCE,
  }),
];
