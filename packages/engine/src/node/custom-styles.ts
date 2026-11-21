/**
 * Custom styles (specs/004 T030): config `customStyles` folders (style.json, optional recipes.css and preview.html),
 * validated and compiled with the same pipeline as the built-in styles (@newbrush/styles/lib), and checked for
 * contrast where their colours resolve at build time.
 */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import type { ResolvedConfig } from "@newbrush/schema";
import {
  checkUnique,
  type LoadedStyle,
  parseStyle,
  resetCss,
  resetSelectors,
  resolveOverrides,
  styleCss,
  styleSelectors,
  type TokenInfo,
  tokenIndex,
} from "@newbrush/styles/lib";
import { MINIMUMS, PAIRS } from "@newbrush/tokens/contrast";
import { themeDeclarations } from "@newbrush/tokens/theme";
import { parse, wcagContrast } from "culori";
import { BUILT_IN_STYLES, type CustomStyles } from "../engine.ts";
import type { StyleRef } from "../variants.ts";

const require = createRequire(import.meta.url);

interface TokensJson {
  tokens: { name: string; cssVar: string; value: string; themes?: Record<string, string> }[];
}

export interface LoadedCustomStyles extends CustomStyles {
  refs: StyleRef[];
  /** What `nb style list` shows for each custom style. */
  info: {
    name: string;
    aliases: string[];
    title: string;
    preferredScheme: string;
    status: string;
    path: string;
  }[];
  /** style.json, recipes.css and preview.html of every custom style (for watchers). */
  files: string[];
}

const EMPTY: LoadedCustomStyles = {
  css: "",
  names: [],
  messages: [],
  failures: 0,
  refs: [],
  info: [],
  files: [],
};

/** Loads, validates and compiles config `customStyles`. Throws on invalid styles. */
export async function loadCustomStyles(
  config: ResolvedConfig,
  cwd: string,
): Promise<LoadedCustomStyles> {
  const paths = config.customStyles ?? [];
  if (!paths.length) return EMPTY;
  const files: string[] = [];
  const styles: LoadedStyle[] = [];
  const origins: string[] = [];
  for (const path of paths) {
    const dir = resolve(cwd, path);
    const jsonPath = join(dir, "style.json");
    if (!existsSync(jsonPath)) throw new Error(`customStyles: no style.json in ${path}`);
    const optional = async (name: string) => {
      const file = join(dir, name);
      files.push(file);
      return existsSync(file) ? readFile(file, "utf8") : undefined;
    };
    files.push(jsonPath);
    let json: unknown;
    try {
      json = JSON.parse(await readFile(jsonPath, "utf8"));
    } catch (error) {
      throw new Error(
        `customStyles: ${path}/style.json is not valid JSON (${(error as Error).message})`,
      );
    }
    origins.push(path);
    styles.push({
      source: parseStyle(json, `${path}/style.json`),
      recipes: await optional("recipes.css"),
      preview: await optional("preview.html"),
    });
  }
  // Names and aliases are unique across built-in and custom styles.
  checkUnique([...BUILT_IN_STYLES, ...styles.map((s) => s.source)]);

  const tokensCss = await readFile(require.resolve("@newbrush/tokens/tokens.css"), "utf8");
  const tokensJson = JSON.parse(
    await readFile(require.resolve("@newbrush/tokens/tokens.json"), "utf8"),
  ) as TokensJson;
  const tokens = tokenIndex(tokensJson, tokensCss);
  const darkTheme = themeDeclarations(tokensCss, "dark");
  const prefix = config.prefix?.styles ?? "";
  const all = [...BUILT_IN_STYLES, ...styles.map((s) => s.source)];
  const css = styles.map((style) => {
    const others = [
      ...all.filter((o) => o.name !== style.source.name).flatMap((o) => styleSelectors(o, prefix)),
      ...resetSelectors(prefix),
    ];
    return styleCss(style, { tokens, others, darkTheme, prefix });
  });
  css.push(resetCss(styles, tokens, { prefix }));

  const level = config.contrast?.level ?? "AA";
  const findings = styles.flatMap((style) => checkStyleContrast(style, tokens, tokensJson, level));
  return {
    css: `/* newBrush custom styles (config customStyles) */\n${css.join("\n")}`,
    names: styles.map((s) => s.source.name),
    refs: styles.map((s) => ({ name: s.source.name, aliases: s.source.aliases, custom: true })),
    info: styles.map((s, i) => ({
      name: s.source.name,
      aliases: s.source.aliases,
      title: s.source.title,
      preferredScheme: s.source.preferredScheme,
      status: s.source.status,
      path: origins[i] ?? "",
    })),
    messages: findings.map((f) => f.message),
    failures: findings.filter((f) => f.fail).length,
    files,
  };
}

type Scheme = "light" | "dark";

/**
 * Contrast gate for a custom style: every semantic pair touching a colour the style overrides, in each scheme,
 * where both colours resolve at build time (literal colours, or references to tokens). Others are reported once as
 * unchecked: the visual contrast suite measures what the browser paints.
 */
export function checkStyleContrast(
  style: LoadedStyle,
  tokens: Map<string, TokenInfo>,
  tokensJson: TokensJson,
  level: "AA" | "AAA",
): { message: string; fail: boolean }[] {
  const byVar = new Map(tokensJson.tokens.map((t) => [t.cssVar, t]));
  const byName = new Map(tokensJson.tokens.map((t) => [t.name, t]));
  const name = (n: string) => byName.get(n) ?? byName.get(`${n}.default`);
  const themed = (cssVar: string, scheme: Scheme): string | undefined => {
    const t = byVar.get(cssVar);
    return t ? (scheme === "dark" ? (t.themes?.dark ?? t.value) : t.value) : undefined;
  };
  const overrides = resolveOverrides(style.source, tokens).filter((o) =>
    o.path.startsWith("color."),
  );
  if (!overrides.length) return [];
  const valueIn = (raw: string, scheme: Scheme): string | undefined => {
    const v = raw.trim();
    const ref = /^var\((--nb-[a-z0-9-]+?)(-base)?\)$/.exec(v);
    if (ref?.[1]) return themed(ref[1], scheme);
    return parse(v) ? v : undefined;
  };
  const out: { message: string; fail: boolean }[] = [];
  const unchecked = new Set<string>();
  for (const scheme of ["light", "dark"] as const) {
    const overridden = new Map<string, string | undefined>();
    for (const o of overrides)
      overridden.set(o.path, valueIn(o.schemes ? o.schemes[scheme] : o.value, scheme));
    const colour = (token: string) => {
      const t = name(token);
      if (!t) return undefined;
      return overridden.has(t.name) ? overridden.get(t.name) : themed(t.cssVar, scheme);
    };
    for (const pair of PAIRS) {
      const fg = name(pair.fg)?.name ?? "";
      const bg = name(pair.bg)?.name ?? "";
      if (!overridden.has(fg) && !overridden.has(bg)) continue;
      const [a, b] = [colour(pair.fg), colour(pair.bg)];
      if (!a || !b) {
        for (const t of [fg, bg]) if (overridden.has(t) && !overridden.get(t)) unchecked.add(t);
        continue;
      }
      const ratio = wcagContrast(a, b);
      const min = MINIMUMS[level][pair.kind];
      if (ratio + 0.005 < min)
        out.push({
          message: `style ${style.source.name} (${scheme}): ${pair.fg} on ${pair.bg} ${ratio.toFixed(2)}:1 < ${min.toFixed(2)}:1 (${level})`,
          fail: true,
        });
    }
  }
  if (unchecked.size)
    out.push({
      message: `style ${style.source.name}: ${[...unchecked].join(", ")} not checked at build time (computed in the browser; the visual contrast suite measures them)`,
      fail: false,
    });
  return out;
}
