// specs/003 T014 — prompts. Each prompt is registered with the release that brings the tools it relies on:
// restyle_with_brand now (generate_css); design_landing_page and build_dashboard with build_page; convert_from_tailwind
// with convert_markup and validate_markup.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerPrompts(server: McpServer): void {
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
