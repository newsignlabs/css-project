// specs/003 T012 — get_tokens: design tokens by group, with a theme's values, as JSON or CSS.
import { manifest } from "../manifest.ts";
import { GetTokensInput, type GetTokensOutput } from "../schemas/index.ts";
import { THEME_NAMES, TOKEN_GROUPS, tokenGroup } from "../tokens.ts";
import { fail } from "./errors.ts";
import { parseInput } from "./validate.ts";

export function getTokens(input: GetTokensInput): GetTokensOutput {
  const { group, theme = "light", format = "json" } = parseInput(GetTokensInput, input);
  if (group !== undefined && !TOKEN_GROUPS.includes(group))
    fail(
      "NB_SCHEMA_INVALID",
      `Unknown token group "${group}". Groups: ${TOKEN_GROUPS.join(", ")}.`,
      { path: "group" },
    );
  if (!THEME_NAMES.includes(theme))
    fail("NB_SCHEMA_INVALID", `Unknown theme "${theme}". Themes: ${THEME_NAMES.join(", ")}.`, {
      path: "theme",
    });
  const tokens = manifest.tokens
    .filter((t) => group === undefined || tokenGroup(t) === group)
    .map((t) => ({
      path: t.name,
      cssVar: t.cssVar,
      type: t.type,
      value: t.themes[theme] ?? t.value,
      ...(t.description ? { description: t.description } : {}),
    }));
  if (format !== "css") return { tokens };
  const selector = theme === "light" ? ":root" : `[data-nb-theme="${theme}"]`;
  const css = `${selector} {\n${tokens.map((t) => `  ${t.cssVar}: ${t.value};`).join("\n")}\n}\n`;
  return { tokens, css };
}
