// The newBrush stylesheets build_page and compose_component assemble from, bundled as text (tsup's ".css" text loader;
// vitest.config.ts does the same). Layout primitives (stack, cluster, grid…) are part of core.
import accordion from "newbrush/components/accordion.min.css";
import alert from "newbrush/components/alert.min.css";
import badge from "newbrush/components/badge.min.css";
import button from "newbrush/components/button.min.css";
import card from "newbrush/components/card.min.css";
import check from "newbrush/components/check.min.css";
import chip from "newbrush/components/chip.min.css";
import field from "newbrush/components/field.min.css";
import input from "newbrush/components/input.min.css";
import modal from "newbrush/components/modal.min.css";
import navbar from "newbrush/components/navbar.min.css";
import select from "newbrush/components/select.min.css";
import switchCss from "newbrush/components/switch.min.css";
import table from "newbrush/components/table.min.css";
import tabs from "newbrush/components/tabs.min.css";
import core from "newbrush/core.css";
import cyber from "newbrush/styles/cyber.css";
import gMorph from "newbrush/styles/g-morph.css";
import minimal from "newbrush/styles/minimal.css";
import nMorph from "newbrush/styles/n-morph.css";
import neon from "newbrush/styles/neon.css";
import pixelate from "newbrush/styles/pixelate.css";

export const CORE_CSS = core;

/** Per-component stylesheets (they need core). Components missing here are layout primitives, part of core. */
export const COMPONENT_CSS: Record<string, string> = {
  accordion,
  alert,
  badge,
  button,
  "button-group": button, // ships in button.css
  card,
  check,
  chip,
  field,
  input,
  modal,
  navbar,
  select,
  switch: switchCss,
  table,
  tabs,
};

/** Design style stylesheets (specs/004), one per style. */
export const STYLE_CSS: Record<string, string> = {
  cyber,
  "g-morph": gMorph,
  minimal,
  "n-morph": nMorph,
  neon,
  pixelate,
};
