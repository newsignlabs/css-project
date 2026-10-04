import { defineComponent, SINCE } from "../../meta.ts";

export default defineComponent({
  name: "table",
  title: "Table",
  description:
    "Data table with tabular numbers, optional stripes, hover rows and a scrollable wrapper.",
  className: "nb-table",
  category: "data",
  anatomy: [
    { part: "wrap", className: "nb-table-wrap", element: "div", required: false },
    { part: "root", className: "nb-table", element: "table", required: true },
    {
      part: "num",
      className: "nb-table__num",
      element: "td",
      required: false,
      requiredParent: "nb-table",
    },
  ],
  modifiers: [
    { name: "striped", className: "nb-table--striped", description: "Zebra rows" },
    { name: "hover", className: "nb-table--hover", description: "Highlight row on hover" },
    { name: "compact", className: "nb-table--compact", description: "Tighter cells" },
  ],
  sizes: [],
  states: ["hover"],
  html: { element: "table" },
  a11y: {
    requirements: [
      "Use <th scope> for headers and a <caption> describing the table",
      'A scrollable nb-table-wrap needs tabindex="0", role="region" and an aria-label',
    ],
  },
  tokens: ["--nb-color-surface-subtle", "--nb-color-border"],
  examples: [
    {
      title: "Striped",
      html: `<div class="nb-table-wrap" tabindex="0" role="region" aria-label="Invoices">
  <table class="nb-table nb-table--striped nb-table--hover">
    <caption>Invoices</caption>
    <thead><tr><th scope="col">Invoice</th><th scope="col">Status</th><th scope="col" class="nb-table__num">Amount</th></tr></thead>
    <tbody>
      <tr><td>INV-001</td><td><span class="nb-badge nb-badge--success">Paid</span></td><td class="nb-table__num">$1,200.00</td></tr>
      <tr><td>INV-002</td><td><span class="nb-badge nb-badge--warning">Due</span></td><td class="nb-table__num">$340.50</td></tr>
      <tr><td>INV-003</td><td><span class="nb-badge nb-badge--danger">Overdue</span></td><td class="nb-table__num">$89.99</td></tr>
    </tbody>
  </table>
</div>`,
    },
  ],
  status: "beta",
  since: SINCE,
});
