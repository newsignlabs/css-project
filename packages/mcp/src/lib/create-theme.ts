// specs/003 T027 — create_theme: brand seed colours (plus radius, density and font choices) → token CSS for light,
// dark and high-contrast, a WCAG/APCA contrast report, and a themeId that generate_css and build_page accept for the
// rest of the session. Failing colours are moved to the nearest passing palette step unless `strict` is set.
import { createEngine } from "@newbrush/engine";
import { checkThemeName } from "@newbrush/tokens/theme";
import { CreateThemeInput, type CreateThemeOutput } from "../schemas/index.ts";
import { fail } from "./errors.ts";
import { defaultThemes, type ThemeStore } from "./theme-store.ts";
import { parseInput } from "./validate.ts";

const RADIUS_STEPS = ["xs", "sm", "md", "lg", "xl", "2xl"] as const;
const RADIUS: Record<"sharp" | "round", string[]> = {
  sharp: ["0rem", "0rem", "0rem", "0rem", "0rem", "0rem"],
  round: ["0.25rem", "0.5rem", "0.75rem", "1rem", "1.5rem", "2rem"],
};

const DENSITY: Record<"compact" | "comfortable", Record<string, string>> = {
  compact: {
    "--nb-control-height-sm": "1.75rem",
    "--nb-control-height-md": "2.25rem",
    "--nb-control-height-lg": "2.75rem",
    "--nb-control-padding-inline-sm": "var(--nb-space-2)",
    "--nb-control-padding-inline-md": "var(--nb-space-3)",
    "--nb-control-padding-inline-lg": "var(--nb-space-4)",
  },
  comfortable: {
    "--nb-control-height-sm": "2.25rem",
    "--nb-control-height-md": "2.75rem",
    "--nb-control-height-lg": "3.25rem",
    "--nb-control-padding-inline-sm": "var(--nb-space-4)",
    "--nb-control-padding-inline-md": "var(--nb-space-5)",
    "--nb-control-padding-inline-lg": "var(--nb-space-6)",
  },
};

/** System font stacks only: a theme never downloads fonts. */
const FONTS: Record<"humanist" | "geometric" | "serif" | "mono", string> = {
  humanist:
    "Seravek, 'Gill Sans Nova', Ubuntu, Calibri, 'DejaVu Sans', source-sans-pro, system-ui, sans-serif",
  geometric: "Avenir, Montserrat, Corbel, 'URW Gothic', source-sans-pro, system-ui, sans-serif",
  serif: "var(--nb-font-family-serif)",
  mono: "var(--nb-font-family-mono)",
};

/** 64-bit FNV-1a as 16 hex digits: deterministic and the same in every runtime. */
function fnv1a64(text: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(text)) {
    hash ^= BigInt(byte);
    hash = (hash * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, "0");
}

/** The light (first) value of every custom property a CSS string declares, skipping Display P3 duplicates. */
function declaredTokens(css: string): Record<string, string> {
  const out: Record<string, string> = {};
  const withoutP3 = css.replace(/@media \(color-gamut: p3\) \{[\s\S]*?\n {2}\}/g, "");
  // Seed steps read `var(--nb-tint-…, value)` so runtime tints still win; report the value itself.
  for (const m of withoutP3.matchAll(/(--nb-[a-z0-9-]+):\s*([^;]+);/g))
    if (m[1] && m[2] && !(m[1] in out))
      out[m[1]] = m[2].trim().replace(/^var\(--nb-tint-[a-z0-9-]+,\s*(.*)\)$/, "$1");
  return out;
}

const round = (n: number, digits: number) => Number(n.toFixed(digits));

export function createTheme(
  input: CreateThemeInput,
  store: ThemeStore = defaultThemes,
): CreateThemeOutput {
  const spec = parseInput(CreateThemeInput, input);
  const problem = checkThemeName(spec.name);
  if (problem) fail("NB_SCHEMA_INVALID", `name: ${problem}.`, { path: "name" });
  const colorScheme = spec.colorScheme ?? "both";
  const level = spec.level ?? "AA";
  const seeds = Object.fromEntries(
    Object.entries(spec.seeds).filter(([, v]) => v !== undefined),
  ) as Record<string, string>;

  let engine: ReturnType<typeof createEngine>;
  try {
    engine = createEngine({
      content: ["mcp"],
      theme: { seeds },
      contrast: { level, onFail: spec.strict ? "warn" : "fix" },
    });
    void engine.themeCss; // seeds are validated here
  } catch (error) {
    // `fail` always throws; the rethrow tells the compiler `engine` is assigned below.
    fail("NB_SCHEMA_INVALID", `seeds: ${(error as Error).message}`, { path: "seeds" });
    throw error;
  }

  const themes = colorScheme === "both" ? ["light", "dark", "contrast"] : [colorScheme];
  const report = engine.contrast;
  const checked = report.results.filter((r) => themes.includes(r.theme));
  if (spec.strict) {
    const failures = checked.filter((r) => !r.pass);
    if (failures.length)
      fail(
        "NB_CONTRAST_FAIL",
        `${failures.length} colour pair${failures.length === 1 ? "" : "s"} miss WCAG ${level}: ${failures
          .slice(0, 6)
          .map((f) => `${f.theme} ${f.fg} on ${f.bg} ${f.ratio.toFixed(2)}:1 (needs ${f.min}:1)`)
          .join(
            "; ",
          )}${failures.length > 6 ? "; …" : ""}. Drop strict to adjust them automatically, or pick other seeds.`,
        { path: "seeds" },
      );
  }
  const fixed = new Set(report.fixes.map((f) => `${f.theme}|${f.token}`));
  const isFixed = (theme: string, token: string) =>
    fixed.has(`${theme}|${token}`) || fixed.has(`${theme}|${token}.default`);

  const extra: string[] = [];
  if (spec.radius && spec.radius !== "default") {
    const values = RADIUS[spec.radius];
    RADIUS_STEPS.forEach((step, i) => {
      extra.push(`--nb-radius-${step}: ${values[i]};`);
    });
  }
  if (spec.density && spec.density !== "default")
    for (const [prop, value] of Object.entries(DENSITY[spec.density]))
      extra.push(`${prop}: ${value};`);
  if (spec.font && spec.font !== "system")
    extra.push(`--nb-font-family-sans: ${FONTS[spec.font]};`);

  const canonical = JSON.stringify({
    name: spec.name,
    seeds: { brand: seeds.brand, accent: seeds.accent, neutral: seeds.neutral },
    colorScheme,
    level,
    radius: spec.radius ?? "default",
    density: spec.density ?? "default",
    font: spec.font ?? "system",
    strict: spec.strict ?? false,
  });
  const themeId = `nbt_${spec.name}_${fnv1a64(canonical)}`;
  const css = [
    `/* newBrush theme "${spec.name}" (${themeId}) */`,
    engine.themeCss.trim(),
    extra.length
      ? `@layer nb.tokens {\n  :root:root,\n  :root ::backdrop {\n${extra.map((d) => `    ${d}`).join("\n")}\n  }\n}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n")
    .concat("\n");

  store.set(themeId, { name: spec.name, css, colorScheme });
  return {
    themeId,
    css,
    tokens: declaredTokens(css),
    contrast: checked.map((r) => ({
      pair: `${r.theme}: ${r.fg} on ${r.bg}`,
      ratio: round(r.ratio, 2),
      apca: round(r.lc, 1),
      pass: r.pass,
      ...(isFixed(r.theme, r.fg) || isFixed(r.theme, r.bg) ? { adjusted: true } : {}),
    })),
  };
}

/**
 * The theme a ThemeRef names: a stored themeId (its CSS and colour scheme), or seed colours. An unknown themeId is
 * an error unless seeds are given as well.
 */
export function resolveTheme(
  theme:
    | {
        themeId?: string;
        seeds?: Record<string, string | undefined>;
        colorScheme?: "light" | "dark" | "both";
      }
    | undefined,
  store: ThemeStore = defaultThemes,
  path = "theme",
): { css?: string; seeds?: Record<string, string>; colorScheme?: "light" | "dark" | "both" } {
  if (!theme) return {};
  const seeds = theme.seeds
    ? (Object.fromEntries(Object.entries(theme.seeds).filter(([, v]) => v !== undefined)) as Record<
        string,
        string
      >)
    : undefined;
  if (theme.themeId) {
    const stored = store.get(theme.themeId);
    if (stored) return { css: stored.css, colorScheme: theme.colorScheme ?? stored.colorScheme };
    if (!seeds)
      fail(
        "NB_SCHEMA_INVALID",
        `Unknown themeId "${theme.themeId}": themes last for one session. Call create_theme again with the same spec (it returns the same id), or pass seeds.`,
        { path: `${path}.themeId` },
      );
  }
  return {
    ...(seeds ? { seeds } : {}),
    ...(theme.colorScheme ? { colorScheme: theme.colorScheme } : {}),
  };
}
