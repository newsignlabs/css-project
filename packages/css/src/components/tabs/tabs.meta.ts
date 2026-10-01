import { defineComponent, SINCE } from "../../meta.ts";

export default defineComponent({
  name: "tabs",
  title: "Tabs",
  description:
    "CSS-only tabs driven by a native radio group (up to 8 tabs); enhanced to ARIA tabs by @newbrush/js.",
  className: "nb-tabs",
  category: "navigation",
  anatomy: [
    { part: "root", className: "nb-tabs", element: "div", required: true },
    {
      part: "list",
      className: "nb-tabs__list",
      element: "fieldset",
      required: true,
      requiredParent: "nb-tabs",
    },
    {
      part: "tab",
      className: "nb-tabs__tab",
      element: "label",
      required: true,
      requiredParent: "nb-tabs__list",
    },
    {
      part: "panel",
      className: "nb-tabs__panel",
      element: "div",
      required: true,
      requiredParent: "nb-tabs",
    },
  ],
  modifiers: [
    {
      name: "pills",
      className: "nb-tabs--pills",
      description: "Rounded pill tabs without underline",
    },
  ],
  sizes: [],
  states: ["checked", "hover", "focus-visible"],
  html: { element: "div" },
  a11y: {
    requirements: [
      "The tab list is a <fieldset> with a visually hidden or visible <legend> naming the tabs",
      "Each tab is a <label> wrapping a radio sharing one name; panels follow in the same order",
      "Without JS this is a radio group, which is a fully accessible pattern; @newbrush/js upgrades to role=tablist",
    ],
    keyboard: ["Arrow keys move between tabs", "Tab moves into the active panel"],
  },
  tokens: ["--nb-color-accent", "--nb-control-height-md"],
  examples: [
    {
      title: "Underline tabs",
      html: `<div class="nb-tabs">
  <fieldset class="nb-tabs__list"><legend hidden>Sections</legend>
    <label class="nb-tabs__tab"><input type="radio" name="tabs-1" checked> Overview</label>
    <label class="nb-tabs__tab"><input type="radio" name="tabs-1"> Tokens</label>
    <label class="nb-tabs__tab"><input type="radio" name="tabs-1"> Usage</label>
  </fieldset>
  <div class="nb-tabs__panel"><p>Overview content.</p></div>
  <div class="nb-tabs__panel"><p>Tokens content.</p></div>
  <div class="nb-tabs__panel"><p>Usage content.</p></div>
</div>`,
    },
  ],
  status: "beta",
  since: SINCE,
});
