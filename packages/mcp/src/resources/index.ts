// specs/003 T013 — newbrush:// resources: the manifest and its parts, with name completion on every template.
import { type McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import contrast from "newbrush/themes/contrast.css";
import dark from "newbrush/themes/dark.css";
import light from "newbrush/themes/light.css";
import { manifest } from "../manifest.ts";
import { TOKEN_GROUPS, tokenGroup } from "../tokens.ts";

const THEME_CSS: Record<string, string> = { light, dark, contrast };
const json = (uri: URL, value: unknown) => ({
  contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(value, null, 2) }],
});
const notFound = (what: string, name: unknown, known: readonly string[]) =>
  new Error(`No ${what} "${String(name)}". Known: ${known.join(", ")}.`);
const startsWith = (names: readonly string[]) => (value: string) =>
  names.filter((n) => n.startsWith(value.toLowerCase())).slice(0, 50);

interface Collection {
  key: string;
  title: string;
  description: string;
  mimeType: string;
  names: readonly string[];
  read: (name: string, uri: URL) => { contents: { uri: string; mimeType: string; text: string }[] };
}

const collections: Collection[] = [
  {
    key: "components",
    title: "Component",
    description:
      "A newBrush component: anatomy, modifiers, sizes, states, accessibility, tokens and examples",
    mimeType: "application/json",
    names: manifest.components.map((c) => c.name),
    read: (name, uri) =>
      json(
        uri,
        manifest.components.find((c) => c.name === name),
      ),
  },
  {
    key: "utilities",
    title: "Utility family",
    description: "A newBrush utility family: class patterns, CSS properties, values and variants",
    mimeType: "application/json",
    names: manifest.utilities.map((u) => u.name),
    read: (name, uri) =>
      json(
        uri,
        manifest.utilities.find((u) => u.name === name),
      ),
  },
  {
    key: "tokens",
    title: "Token group",
    description: "Design tokens in one group, with their light, dark and contrast values",
    mimeType: "application/json",
    names: TOKEN_GROUPS,
    read: (name, uri) =>
      json(
        uri,
        manifest.tokens.filter((t) => tokenGroup(t) === name),
      ),
  },
  {
    key: "themes",
    title: "Theme",
    description: "A built-in theme's CSS (light, dark or high contrast)",
    mimeType: "text/css",
    names: Object.keys(THEME_CSS),
    read: (name, uri) => ({
      contents: [{ uri: uri.href, mimeType: "text/css", text: THEME_CSS[name] ?? "" }],
    }),
  },
  {
    key: "styles",
    title: "Design style",
    description:
      "A design style: personality, token overrides, recipes, effects and accessibility notes",
    mimeType: "application/json",
    names: manifest.styles.map((s) => s.name),
    read: (name, uri) =>
      json(
        uri,
        manifest.styles.find((s) => s.name === name),
      ),
  },
];

export function registerResources(server: McpServer): void {
  server.registerResource(
    "manifest",
    "newbrush://manifest",
    {
      title: "newBrush manifest",
      description:
        "Everything newBrush ships: tokens, themes, variants, utilities, components and design styles",
      mimeType: "application/json",
    },
    (uri) => json(uri, manifest),
  );
  for (const c of collections) {
    server.registerResource(
      c.key,
      new ResourceTemplate(`newbrush://${c.key}/{name}`, {
        list: () => ({
          resources: c.names.map((name) => ({
            uri: `newbrush://${c.key}/${name}`,
            name: `${c.key}/${name}`,
            title: `${c.title}: ${name}`,
            mimeType: c.mimeType,
          })),
        }),
        complete: { name: startsWith(c.names) },
      }),
      { title: c.title, description: c.description, mimeType: c.mimeType },
      (uri, { name }) => {
        const key = String(name);
        if (!c.names.includes(key)) throw notFound(c.title.toLowerCase(), key, c.names);
        return c.read(key, uri);
      },
    );
  }
}
