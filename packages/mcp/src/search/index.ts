// specs/003 T011 — one MiniSearch index over the bundled manifest: components, utilities, tokens and design styles.
import MiniSearch from "minisearch";
import { BLUEPRINTS } from "../blueprints/index.ts";
import { manifest } from "../manifest.ts";
import { tokenGroup } from "../tokens.ts";

export type SearchKind = "component" | "utility" | "token" | "style" | "section";

export interface SearchDoc {
  id: string;
  kind: SearchKind;
  name: string;
  title: string;
  description: string;
  uri: string;
  example?: string;
  /** Extra searchable text (patterns, properties, keywords…). */
  terms: string;
}

const words = (s: string) => s.replace(/[-_.]/g, " ");

function documents(): SearchDoc[] {
  const docs: SearchDoc[] = [];
  for (const c of manifest.components)
    docs.push({
      id: `component:${c.name}`,
      kind: "component",
      name: c.name,
      title: c.title,
      description: c.description,
      uri: `newbrush://components/${c.name}`,
      example: c.examples[0]?.html,
      terms: [
        c.className,
        c.category,
        ...c.modifiers.map((m) => `${m.name} ${m.description}`),
        ...c.a11y.requirements,
      ].join(" "),
    });
  for (const u of manifest.utilities)
    docs.push({
      id: `utility:${u.name}`,
      kind: "utility",
      name: u.name,
      title: words(u.name),
      description: u.description,
      uri: `newbrush://utilities/${u.name}`,
      example: u.patterns[0]?.replace(/\{[^}]+\}/, "4").replace(/\[[^\]]+\]$/, "[1rem]"),
      terms: [u.category, ...u.patterns, ...u.properties.map(words)].join(" "),
    });
  for (const t of manifest.tokens)
    docs.push({
      id: `token:${t.cssVar}`,
      kind: "token",
      name: t.cssVar,
      title: words(t.name),
      description: t.description ?? `${t.tier} ${t.type} token`,
      uri: `newbrush://tokens/${tokenGroup(t)}`,
      terms: [t.type, t.tier, tokenGroup(t), words(t.path.join(" "))].join(" "),
    });
  for (const s of manifest.styles)
    docs.push({
      id: `style:${s.name}`,
      kind: "style",
      name: s.name,
      title: s.title,
      description: s.description,
      uri: `newbrush://styles/${s.name}`,
      example: `<body class="${s.name}">`,
      terms: [...s.aliases, ...s.keywords, ...s.effects.map(words)].join(" "),
    });
  for (const b of BLUEPRINTS.values())
    docs.push({
      id: `section:${b.name}`,
      kind: "section",
      name: b.name,
      title: b.title,
      description: b.description,
      uri: `newbrush://sections/${b.name}`,
      example: JSON.stringify({ type: b.name, variant: b.variants[0] }),
      terms: ["section", "blueprint", "page", ...b.variants].join(" "),
    });
  return docs;
}

let index: MiniSearch<SearchDoc> | undefined;

export function searchIndex(): MiniSearch<SearchDoc> {
  if (index) return index;
  index = new MiniSearch<SearchDoc>({
    fields: ["name", "title", "description", "terms"],
    storeFields: ["kind", "name", "title", "description", "uri", "example"],
    tokenize: (text) =>
      text
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean),
    searchOptions: {
      boost: { name: 4, title: 3, description: 1, terms: 1 },
      prefix: true,
      fuzzy: 0.2,
    },
  });
  index.addAll(documents());
  return index;
}
