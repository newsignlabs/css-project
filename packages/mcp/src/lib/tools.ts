// Every tool as a plain function of (arguments, session themes): the REST mirror (transports/http.ts) calls these, and
// test/http.test.ts checks each against the MCP tool of the same name, so the two surfaces cannot drift.
import { buildPage } from "./build-page.ts";
import { composeComponent } from "./compose-component.ts";
import { convertMarkup } from "./convert-markup.ts";
import { createTheme } from "./create-theme.ts";
import { explainClass } from "./explain-class.ts";
import { generateCss } from "./generate-css.ts";
import { getComponent } from "./get-component.ts";
import { getTokens } from "./get-tokens.ts";
import { search } from "./search.ts";
import type { ThemeStore } from "./theme-store.ts";
import { validateMarkup } from "./validate-markup.ts";

// biome-ignore lint/suspicious/noExplicitAny: each tool validates its own arguments with its zod schema
type Tool = (args: any, themes: ThemeStore) => Record<string, unknown>;

export const TOOLS: Readonly<Record<string, Tool>> = {
  generate_css: (args, themes) => generateCss(args, themes),
  explain_class: (args) => explainClass(args),
  search: (args) => search(args),
  get_component: (args) => getComponent(args),
  get_tokens: (args) => getTokens(args),
  build_page: (args, themes) => buildPage(args, themes),
  compose_component: (args) => composeComponent(args),
  create_theme: (args, themes) => createTheme(args, themes),
  validate_markup: (args) => validateMarkup(args),
  convert_markup: (args) => convertMarkup(args),
};
