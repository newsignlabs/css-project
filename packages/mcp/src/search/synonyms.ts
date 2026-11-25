// Words people use for things newBrush names differently. A query term expands to its synonyms (both directions are
// listed explicitly, so the table stays readable).
export const SYNONYMS: Record<string, string[]> = {
  modal: ["dialog", "popup", "lightbox", "overlay"],
  dialog: ["modal", "popup"],
  popup: ["modal", "dialog"],
  lightbox: ["modal"],
  dropdown: ["select", "menu", "listbox", "combobox"],
  menu: ["navbar", "select", "dropdown"],
  combobox: ["select"],
  picker: ["select"],
  toggle: ["switch"],
  checkbox: ["check"],
  radio: ["check"],
  tickbox: ["check"],
  textbox: ["input", "field"],
  textfield: ["input", "field"],
  textarea: ["input", "field"],
  form: ["field", "input", "select", "check"],
  label: ["field"],
  tab: ["tabs"],
  tablist: ["tabs"],
  nav: ["navbar", "navigation"],
  navigation: ["navbar"],
  header: ["navbar"],
  topbar: ["navbar"],
  pricing: ["card", "table"],
  plan: ["card"],
  tile: ["card"],
  panel: ["card"],
  datagrid: ["table"],
  grid: ["layout", "columns"],
  columns: ["grid"],
  layout: ["grid", "stack", "sidebar", "container"],
  wrapper: ["container"],
  tag: ["badge", "chip"],
  pill: ["badge", "chip"],
  notification: ["alert"],
  toast: ["alert"],
  banner: ["alert"],
  callout: ["alert"],
  collapse: ["accordion"],
  disclosure: ["accordion"],
  expander: ["accordion"],
  spacing: ["padding", "margin", "gap", "space"],
  space: ["padding", "margin", "gap"],
  colour: ["color"],
  shadow: ["elevation"],
  rounded: ["radius"],
  corner: ["radius"],
  font: ["typography", "text"],
  size: ["sizing", "width", "height"],
  dark: ["theme"],
  glass: ["g-morph"],
  glassmorphism: ["g-morph"],
  neumorphism: ["n-morph"],
  soft: ["n-morph"],
  pixel: ["pixelate"],
  retro: ["pixelate"],
  cyberpunk: ["cyber"],
  glow: ["neon"],
};

/** The query's terms plus their synonyms, lower-cased and de-duplicated. */
export function expandQuery(query: string): string[] {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .filter(Boolean);
  const out = new Set(terms);
  for (const t of terms) for (const s of SYNONYMS[t] ?? []) out.add(s);
  return [...out];
}
