// specs/003 T014 — prompts. Each prompt is registered with the release that brings the tools it relies on:
// restyle_with_brand (generate_css), design_landing_page and build_dashboard (build_page) now; convert_from_tailwind
// with convert_markup and validate_markup.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BLUEPRINTS } from "../blueprints/index.ts";

export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    "build_dashboard",
    {
      title: "Build a dashboard",
      description:
        "Plan an admin or analytics dashboard for some records and metrics, and build it with build_page.",
      argsSchema: {
        entities: z.string().describe('What the dashboard manages, e.g. "orders, customers"'),
        metrics: z.string().describe('The numbers to show, e.g. "orders today, revenue, churn"'),
      },
    },
    ({ entities, metrics }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              `Build a dashboard for ${entities}, showing ${metrics}.`,
              "",
              "1. Use these sections (read newbrush://sections/{name} for their props):",
              "   - dashboard-shell: app name, one link per area, the signed-in user and sign out;",
              "   - sidebar-layout or stats: the key metrics as label + value pairs (realistic sample values);",
              "   - table-view: one table per entity with a caption, clear column labels and numeric columns marked numeric;",
              "   - empty-state where an area has no data yet.",
              "2. Call build_page with a title and those sections. Fix any schema error at the path it names and call again.",
              "3. Reply with the HTML document and a one-line note on what each section shows.",
            ].join("\n"),
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "design_landing_page",
    {
      title: "Design a landing page",
      description: "Plan a landing page for a product and build it with build_page.",
      argsSchema: {
        product: z.string().describe("What the page sells or explains"),
        audience: z.string().describe("Who it is for"),
        brandColor: z.string().optional().describe("Brand colour, e.g. #7c4a2d"),
        tone: z.string().optional().describe("Voice, e.g. warm, playful, technical"),
      },
    },
    ({ product, audience, brandColor, tone }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              `Design a landing page for ${product}, aimed at ${audience}${tone ? `, in a ${tone} tone` : ""}.`,
              "",
              "1. Plan 5–8 sections. Available section types (read newbrush://sections/{name} for each one's props):",
              ...[...BLUEPRINTS.values()].map(
                (b) => `   - ${b.name} (${b.variants.join(", ")}): ${b.description}`,
              ),
              "2. Write real, specific copy for every prop: no lorem ipsum. Give images meaningful alt text.",
              `3. Call build_page with title, description, sections${brandColor ? `, and theme: { seeds: { brand: "${brandColor}" } }` : ""}. A design style (style: "neon", "g-morph"…) is optional.`,
              "4. If build_page reports a schema error, fix the named path and call it again. Review any diagnostics.",
              "5. Reply with the HTML document.",
            ].join("\n"),
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "restyle_with_brand",
    {
      title: "Restyle with a brand colour",
      description:
        "Restyle existing HTML with newBrush in a brand colour, and get the CSS to ship with it.",
      argsSchema: {
        html: z.string().describe("The HTML to restyle"),
        brandColor: z.string().describe("The brand colour, e.g. #e11d48 or oklch(62% 0.19 255)"),
      },
    },
    ({ html, brandColor }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              `Restyle this HTML with newBrush, in the brand colour ${brandColor}.`,
              "",
              "1. Use `search` and `get_component` to find newBrush components for each part (buttons → nb-btn, cards → nb-card, forms → nb-field and nb-input…), and replace ad-hoc classes with them. Keep the content and structure; keep it accessible.",
              "2. Use utilities (p-4, gap-6, md:grid-cols-2…) only for layout and spacing the components don't cover; `explain_class` shows what a class does.",
              `3. Call \`generate_css\` with the new HTML, theme: { seeds: { brand: "${brandColor}" } } and include: { components: true }. Fix every rejected or unknown class it reports, then call it again.`,
              "4. Reply with the final HTML and the CSS.",
              "",
              "HTML:",
              "```html",
              html,
              "```",
            ].join("\n"),
          },
        },
      ],
    }),
  );
}
