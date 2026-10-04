import { defineComponent, SINCE } from "../../meta.ts";

export default defineComponent({
  name: "card",
  title: "Card",
  description: "Groups related content and actions on a raised surface.",
  className: "nb-card",
  category: "data",
  anatomy: [
    { part: "root", className: "nb-card", element: "article", required: true },
    {
      part: "media",
      className: "nb-card__media",
      element: "img",
      required: false,
      requiredParent: "nb-card",
    },
    {
      part: "header",
      className: "nb-card__header",
      element: "header",
      required: false,
      requiredParent: "nb-card",
    },
    { part: "title", className: "nb-card__title", element: "h3", required: false },
    { part: "subtitle", className: "nb-card__subtitle", element: "p", required: false },
    { part: "link", className: "nb-card__link", element: "a", required: false },
    {
      part: "body",
      className: "nb-card__body",
      element: "div",
      required: false,
      requiredParent: "nb-card",
    },
    {
      part: "footer",
      className: "nb-card__footer",
      element: "footer",
      required: false,
      requiredParent: "nb-card",
    },
    {
      part: "content",
      className: "nb-card__content",
      element: "div",
      required: false,
      requiredParent: "nb-card",
    },
  ],
  modifiers: [
    { name: "elevated", className: "nb-card--elevated", description: "Stronger shadow, no border" },
    { name: "flat", className: "nb-card--flat", description: "No shadow" },
    {
      name: "interactive",
      className: "nb-card--interactive",
      description: "Lifts on hover; pair with nb-card__link",
    },
    {
      name: "horizontal",
      className: "nb-card--horizontal",
      description: "Media beside content, wraps when narrow",
    },
  ],
  sizes: [],
  states: ["hover", "focus-within"],
  html: { element: "article" },
  a11y: {
    requirements: [
      "Use a heading for the card title so cards are navigable by heading",
      "Clickable cards: put one nb-card__link in the title; avoid other links inside",
      'Media needs alt text, or alt="" when decorative',
    ],
  },
  tokens: ["--nb-elevation-1", "--nb-radius-lg", "--nb-color-surface-raised"],
  examples: [
    {
      title: "Basic",
      html: `<article class="nb-card" style="max-inline-size: 22rem">
  <header class="nb-card__header">
    <h3 class="nb-card__title">Token-driven</h3>
    <p class="nb-card__subtitle">Layered and accessible</p>
  </header>
  <div class="nb-card__body"><p>Every value comes from a design token, so themes re-skin everything at once.</p></div>
  <footer class="nb-card__footer">
    <button class="nb-btn nb-btn--primary nb-btn--sm" type="button">Get started</button>
    <button class="nb-btn nb-btn--ghost nb-btn--sm" type="button">Docs</button>
  </footer>
</article>`,
    },
    {
      title: "Interactive",
      html: `<article class="nb-card nb-card--interactive" style="max-inline-size: 22rem">
  <div class="nb-card__body">
    <h3 class="nb-card__title"><a class="nb-card__link" href="#post">Release notes</a></h3>
    <p>The whole card is clickable; only the title link is focusable.</p>
  </div>
</article>`,
    },
  ],
  status: "beta",
  since: SINCE,
});
