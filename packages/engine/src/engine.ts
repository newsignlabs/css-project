import {
  Config,
  type ParsedClass,
  type ResolvedConfig,
  type UtilityFamily,
  type Variant,
} from "@newbrush/schema";
import { escapeClassName } from "./escape.ts";
import { families as defaultFamilies } from "./families/index.ts";
import { createTheme, type Theme } from "./theme.ts";
import type { Decl, Family, Resolved } from "./types.ts";
import { validateArbitrary } from "./validate.ts";
import { createVariants, type RuleState, type VariantRegistry } from "./variants.ts";

export interface Diagnostic {
  code: "NB_ARBITRARY_REJECTED" | "NB_UNKNOWN_CLASS" | "NB_UNKNOWN_VARIANT";
  severity: "error" | "warning";
  message: string;
  class: string;
}

export interface Rule {
  selector: string;
  atRules: string[];
  decls: Decl[];
  sort: { variants: bigint; family: number; cls: string; index: number };
}

export interface GenerateResult {
  css: string;
  classes: { used: string[]; rejected: Diagnostic[]; unknown: string[] };
  stats: { rules: number; bytes: number; ms: number };
}

export type Explanation = { parsed: ParsedClass; family: string; css: string } | Diagnostic;

interface Match {
  parsed: ParsedClass;
  family: Family;
  familyIndex: number;
  resolved: Resolved;
}

type Compiled =
  | { ok: true; match: Match; rules: Rule[]; keyframes: Record<string, string> }
  | { ok: false; diagnostic: Diagnostic };

const EMPTY_STATE: RuleState = {
  self: [],
  pseudoElement: "",
  wrappers: [],
  atRules: [],
  extraDecls: [],
};

/** Splits on `:` outside [] and (). */
export function splitVariants(raw: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of raw) {
    if (ch === "[" || ch === "(") depth++;
    else if ((ch === "]" || ch === ")") && depth > 0) depth--;
    if (ch === ":" && depth === 0) {
      parts.push(cur);
      cur = "";
    } else cur += ch;
  }
  parts.push(cur);
  return parts;
}

function hasTopLevelComma(selector: string): boolean {
  let depth = 0;
  for (const ch of selector) {
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    else if (ch === "," && depth === 0) return true;
  }
  return false;
}

const wrap = (template: string, inner: string) =>
  template.replaceAll(
    "&",
    hasTopLevelComma(inner) && template.trim() !== "&" ? `:is(${inner})` : inner,
  );

export class Engine {
  readonly config: ResolvedConfig;
  readonly theme: Theme;
  private readonly families: Family[];
  private readonly statics = new Map<string, number>();
  private readonly functional = new Map<string, number[]>();
  private readonly variantRegistry: VariantRegistry;
  private readonly cache = new Map<string, Compiled>();
  private readonly candidates = new Set<string>();

  constructor(
    config: Config = { content: ["**/*"] },
    families: Family[] = defaultFamilies,
    theme: Theme = createTheme(),
  ) {
    this.config = Config.parse(config);
    this.theme = theme;
    this.families = families;
    families.forEach((f, i) => {
      for (const cls of Object.keys(f.statics ?? {}))
        if (!this.statics.has(cls)) this.statics.set(cls, i);
      for (const root of f.roots)
        this.functional.set(root, [...(this.functional.get(root) ?? []), i]);
    });
    this.variantRegistry = createVariants(theme, this.config);
  }

  private get prefix(): string {
    return this.config.prefix?.utilities ?? "";
  }

  /** Parses a candidate into the data-model AST, or null when it is not a newBrush utility. */
  parse(raw: string): ParsedClass | null {
    const result = this.compile(raw);
    return result.ok ? result.match.parsed : null;
  }

  private match(raw: string): Match | Diagnostic {
    const unknown: Diagnostic = {
      code: "NB_UNKNOWN_CLASS",
      severity: "warning",
      message: `"${raw}" is not a newBrush utility`,
      class: raw,
    };
    const parts = splitVariants(raw);
    let body = parts.pop() ?? "";
    const variants = parts;
    if (variants.some((v) => !v)) return unknown;
    const important = body.endsWith("!");
    if (important) body = body.slice(0, -1);
    const negative = body.startsWith("-");
    if (negative) body = body.slice(1);
    if (this.prefix) {
      if (!body.startsWith(this.prefix)) return unknown;
      body = body.slice(this.prefix.length);
    }
    if (!body) return unknown;

    const base = { raw, variants, negative } as const;
    const build = (fi: number, resolved: Resolved, fields: Partial<ParsedClass>): Match => ({
      parsed: { ...base, ...fields, important } as ParsedClass,
      family: this.families[fi] as Family,
      familyIndex: fi,
      resolved,
    });

    // Static utilities: flex, sr-only…
    const staticIndex = this.statics.get(body);
    if (staticIndex !== undefined && !negative) {
      const entry = (this.families[staticIndex] as Family).statics?.[body];
      if (entry)
        return build(staticIndex, Array.isArray(entry) ? { decls: entry } : entry, {
          utility: body,
        });
    }

    // Arbitrary values: w-[37ch], bg-(--brand), bg-[#fff]/50.
    const arb = /^(.+?)-(\[[^\]]+\]|\(--[a-zA-Z0-9_-]+\))(?:\/(\d{1,3}))?$/.exec(body);
    if (arb) {
      const [, root = "", token = "", modifier] = arb;
      const indices = this.functional.get(root);
      if (!indices) return unknown;
      const value = token.startsWith("(")
        ? `var(${token.slice(1, -1)})`
        : token.slice(1, -1).replace(/_/g, " ");
      let reason: string | undefined;
      for (const fi of indices) {
        const family = this.families[fi] as Family;
        if (!family.arbitrary) continue;
        const check = validateArbitrary(value, family.arbitrary);
        if (!check.ok) {
          reason ??= check.reason;
          continue;
        }
        const resolved = family.resolve?.({ arbitrary: value, negative, modifier }, this.theme);
        if (resolved)
          return build(fi, resolved, {
            utility: root,
            arbitrary: value,
            ...(modifier ? { modifier } : {}),
          });
      }
      return reason
        ? {
            code: "NB_ARBITRARY_REJECTED",
            severity: "error",
            message: `Arbitrary value rejected: ${reason}`,
            class: raw,
          }
        : unknown;
    }

    // Functional utilities: longest registered root that resolves wins (grid-cols-3 → grid-cols + 3).
    const segments = body.split("-");
    for (let i = segments.length; i >= 1; i--) {
      const root = segments.slice(0, i).join("-");
      const rest = i < segments.length ? segments.slice(i).join("-") : undefined;
      for (const fi of this.functional.get(root) ?? []) {
        const family = this.families[fi] as Family;
        let value = rest;
        let modifier: string | undefined;
        if (rest && family.opacityModifier && rest.includes("/")) {
          const slash = rest.lastIndexOf("/");
          value = rest.slice(0, slash);
          modifier = rest.slice(slash + 1);
        }
        const resolved = family.resolve?.({ value, negative, modifier }, this.theme);
        if (resolved) {
          return build(fi, resolved, {
            utility: root,
            ...(value !== undefined ? { value } : {}),
            ...(modifier ? { modifier } : {}),
          });
        }
      }
    }
    return unknown;
  }

  private compile(raw: string): Compiled {
    const cached = this.cache.get(raw);
    if (cached) return cached;
    const result = this.compileUncached(raw);
    this.cache.set(raw, result);
    return result;
  }

  private compileUncached(raw: string): Compiled {
    const match = this.match(raw);
    if (!("parsed" in match)) return { ok: false, diagnostic: match };

    let states: RuleState[] = [EMPTY_STATE];
    let mask = 0n;
    for (const name of match.parsed.variants) {
      const variant = this.variantRegistry.resolve(name);
      if (!variant)
        return {
          ok: false,
          diagnostic: {
            code: "NB_UNKNOWN_VARIANT",
            severity: "warning",
            message: `Unknown variant "${name}"`,
            class: raw,
          },
        };
      states = states.flatMap((s) => variant.def.apply(s, variant.arg));
      if (states.length === 0) {
        return {
          ok: false,
          diagnostic: {
            code: "NB_UNKNOWN_VARIANT",
            severity: "warning",
            message: `Invalid variant "${name}"`,
            class: raw,
          },
        };
      }
      mask |= 1n << BigInt(variant.def.order);
    }

    const escaped = escapeClassName(raw);
    const important = match.parsed.important;
    const rules = states.map((state, index): Rule => {
      let selector = `.${escaped}${state.self.join("")}${state.pseudoElement}`;
      if (match.resolved.selector) selector = wrap(match.resolved.selector, selector);
      for (let i = state.wrappers.length - 1; i >= 0; i--)
        selector = wrap(state.wrappers[i] as string, selector);
      const decls = [...match.resolved.decls, ...state.extraDecls].map(
        ([p, v]): Decl => [p, important ? `${v} !important` : v],
      );
      return {
        selector,
        atRules: state.atRules,
        decls,
        sort: { variants: mask, family: match.familyIndex, cls: raw, index },
      };
    });
    return { ok: true, match, rules, keyframes: match.resolved.keyframes ?? {} };
  }

  /** Generates layered CSS for exactly the given classes (plus config safelist, minus blocklist). */
  generate(classes: Iterable<string>, options: { reportUnknown?: boolean } = {}): GenerateResult {
    const start = performance.now();
    const blocked = new Set(this.config.blocklist ?? []);
    const input = new Set<string>(
      [...(this.config.safelist ?? []), ...classes].filter((c) => c && !blocked.has(c)),
    );
    const used: string[] = [];
    const unknown: string[] = [];
    const rejected: Diagnostic[] = [];
    const rules: Rule[] = [];
    const keyframes = new Map<string, string>();

    for (const cls of input) {
      const result = this.compile(cls);
      if (result.ok) {
        used.push(cls);
        rules.push(...result.rules);
        for (const [name, body] of Object.entries(result.keyframes)) keyframes.set(name, body);
      } else if (result.diagnostic.code === "NB_ARBITRARY_REJECTED")
        rejected.push(result.diagnostic);
      else if (options.reportUnknown !== false) unknown.push(cls);
    }

    rules.sort(
      (a, b) =>
        (a.sort.variants < b.sort.variants ? -1 : a.sort.variants > b.sort.variants ? 1 : 0) ||
        a.sort.family - b.sort.family ||
        (a.sort.cls < b.sort.cls ? -1 : a.sort.cls > b.sort.cls ? 1 : 0) ||
        a.sort.index - b.sort.index,
    );
    const css = rules.length || keyframes.size ? printLayer(rules, keyframes) : "";
    const sortStr = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
    return {
      css,
      classes: {
        used: used.sort(sortStr),
        rejected: rejected.sort((a, b) => sortStr(a.class, b.class)),
        unknown: unknown.sort(sortStr),
      },
      stats: {
        rules: rules.length,
        bytes: new TextEncoder().encode(css).length,
        ms: performance.now() - start,
      },
    };
  }

  /** Incremental use (watch mode): add candidates; `changed` is true when a new valid utility appeared. */
  addCandidates(candidates: Iterable<string>): { changed: boolean } {
    let changed = false;
    for (const c of candidates) {
      if (this.candidates.has(c)) continue;
      this.candidates.add(c);
      if (this.compile(c).ok) changed = true;
    }
    return { changed };
  }

  css(): string {
    return this.generate(this.candidates, { reportUnknown: false }).css;
  }

  usedClasses(): string[] {
    return this.generate(this.candidates, { reportUnknown: false }).classes.used;
  }

  /** Rules for a class with `&` standing for the host selector — used by @nb-apply. */
  rulesFor(cls: string): { ok: true; rules: Rule[] } | { ok: false; diagnostic: Diagnostic } {
    const result = this.compile(cls);
    if (!result.ok) return result;
    const escaped = `.${escapeClassName(cls)}`;
    return {
      ok: true,
      rules: result.rules.map((r) => ({ ...r, selector: r.selector.replaceAll(escaped, "&") })),
    };
  }

  explain(cls: string): Explanation {
    const result = this.compile(cls);
    if (!result.ok) return result.diagnostic;
    return {
      parsed: result.match.parsed,
      family: result.match.family.name,
      css: this.generate([cls]).css,
    };
  }

  utilityFamilies(): UtilityFamily[] {
    return this.families.map((f) => {
      const statics = Object.keys(f.statics ?? {});
      const valueGroup = f.valueSource.source === "token" ? f.valueSource.group : "value";
      const patterns = [
        ...statics,
        ...f.roots.map((r) => `${r}-{${valueGroup}}`),
        ...(f.arbitrary ? f.roots.map((r) => `${r}-[${f.arbitrary}]`) : []),
      ];
      return {
        name: f.name,
        patterns: patterns.length ? patterns : [f.name],
        properties: f.properties.length ? f.properties : ["(none)"],
        values: f.valueSource,
        ...(f.arbitrary ? { arbitrary: { grammar: f.arbitrary } } : {}),
        ...(f.negative ? { negative: true } : {}),
        ...(f.opacityModifier ? { modifiers: { opacity: true } } : {}),
        variants: "all",
        category: f.category,
        description: f.description,
      } satisfies UtilityFamily;
    });
  }

  variants(): Variant[] {
    return this.variantRegistry.defs.map((d) => ({
      name: d.name,
      kind: d.kind,
      template: d.template,
      order: d.order,
      composable: true,
    }));
  }

  /** Every concrete class the registry can produce without arbitrary values (for presets and editor types). */
  knownClasses(): string[] {
    const out = new Set<string>();
    for (const f of this.families) {
      for (const cls of Object.keys(f.statics ?? {})) out.add(cls);
      for (const root of f.roots) for (const v of f.values(this.theme)) out.add(`${root}-${v}`);
    }
    return [...out].filter((c) => this.compile(c).ok).sort();
  }
}

function printLayer(rules: Rule[], keyframes: Map<string, string>): string {
  const lines: string[] = ["@layer nb.utilities {"];
  for (const [name, body] of [...keyframes].sort(([a], [b]) => (a < b ? -1 : 1))) {
    lines.push(`  @keyframes ${name} {`, `    ${body}`, "  }");
  }
  for (const rule of rules) lines.push(printRule(rule, 1));
  lines.push("}");
  return `${lines.join("\n")}\n`;
}

export function printRule(rule: Rule, depth: number): string {
  const pad = (n: number) => "  ".repeat(n);
  const open = rule.atRules.map((a, i) => `${pad(depth + i)}${a} {`);
  const inner = depth + rule.atRules.length;
  const body = [
    `${pad(inner)}${rule.selector} {`,
    ...rule.decls.map(([p, v]) => `${pad(inner + 1)}${p}: ${v};`),
    `${pad(inner)}}`,
  ];
  const close = rule.atRules.map((_, i) => `${pad(depth + rule.atRules.length - 1 - i)}}`);
  return [...open, ...body, ...close].join("\n");
}
