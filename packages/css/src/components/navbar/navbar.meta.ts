import { defineComponent, SINCE } from "../../meta.ts";

export default defineComponent({
  name: "navbar",
  title: "Navbar",
  description:
    "Site header with brand, primary navigation and actions; adapts to its container width without JS.",
  className: "nb-navbar",
  category: "navigation",
  anatomy: [
    { part: "root", className: "nb-navbar", element: "header", required: true },
    {
      part: "brand",
      className: "nb-navbar__brand",
      element: "a",
      required: false,
      requiredParent: "nb-navbar",
    },
    {
      part: "nav",
      className: "nb-navbar__nav",
      element: "nav",
      required: true,
      requiredParent: "nb-navbar",
    },
    {
      part: "links",
      className: "nb-navbar__links",
      element: "ul",
      required: true,
      requiredParent: "nb-navbar__nav",
    },
    { part: "link", className: "nb-navbar__link", element: "a", required: true },
    {
      part: "actions",
      className: "nb-navbar__actions",
      element: "div",
      required: false,
      requiredParent: "nb-navbar",
    },
  ],
  modifiers: [
    {
      name: "sticky",
      className: "nb-navbar--sticky",
      description: "Sticks to the top with a frosted background",
    },
  ],
  sizes: [],
  states: ["hover", "aria-current"],
  html: { element: "header" },
  a11y: {
    requirements: [
      "Wrap links in <nav aria-label> so assistive tech lists the landmark",
      'Mark the current page with aria-current="page"',
    ],
  },
  tokens: ["--nb-color-surface", "--nb-color-accent", "--nb-z-sticky"],
  examples: [
    {
      title: "Basic",
      html: `<header class="nb-navbar">
  <a class="nb-navbar__brand" href="#home">newBrush</a>
  <nav class="nb-navbar__nav" aria-label="Main">
    <ul class="nb-navbar__links">
      <li><a class="nb-navbar__link" href="#docs" aria-current="page">Docs</a></li>
      <li><a class="nb-navbar__link" href="#components">Components</a></li>
      <li><a class="nb-navbar__link" href="#themes">Themes</a></li>
      <li><a class="nb-navbar__link" href="#mcp">MCP</a></li>
    </ul>
  </nav>
  <div class="nb-navbar__actions"><a class="nb-btn nb-btn--primary nb-btn--sm" href="#start">Get started</a></div>
</header>`,
    },
  ],
  status: "beta",
  since: SINCE,
});
