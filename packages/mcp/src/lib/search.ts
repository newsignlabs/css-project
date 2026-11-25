// specs/003 T011 — search: components, utilities, tokens and design styles by meaning, with synonyms.
import { SearchInput, type SearchOutput } from "../schemas/index.ts";
import { searchIndex } from "../search/index.ts";
import { expandQuery } from "../search/synonyms.ts";
import { parseInput } from "./validate.ts";

const tokens = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

export function search(input: SearchInput): SearchOutput {
  const { query, kinds, limit = 10 } = parseInput(SearchInput, input);
  // The user's own words count fully; synonyms help recall but rank lower.
  const own = new Set(tokens(query));
  const hits = searchIndex().search(expandQuery(query).join(" "), {
    boostTerm: (term: string) => (own.has(term) ? 1 : 0.5),
    ...(kinds ? { filter: (r) => (kinds as string[]).includes(String(r.kind)) } : {}),
  });
  const results = hits
    .map((h) => ({
      kind: h.kind,
      name: h.name,
      title: h.title,
      description: h.description,
      uri: h.uri,
      score: Math.round(h.score * 1000) / 1000,
      ...(h.example ? { example: h.example } : {}),
    }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit);
  return { results };
}
