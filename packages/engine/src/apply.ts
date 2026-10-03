import { type Engine, printRule } from "./engine.ts";

export class DirectiveError extends Error {
  constructor(
    message: string,
    readonly classes: string[],
  ) {
    super(message);
    this.name = "DirectiveError";
  }
}

const APPLY = /@nb-apply\s+([^;{}]+);/g;
const UTILITIES = /@newbrush\s+utilities\s*;/g;

/** Inline declarations (and nested variant rules) for `@nb-apply a b c;` inside a rule. Uses CSS nesting. */
export function expandApply(engine: Engine, classList: string): string {
  const classes = classList.trim().split(/\s+/).filter(Boolean);
  const inline: string[] = [];
  const nested: string[] = [];
  const failed: string[] = [];
  for (const cls of classes) {
    const result = engine.rulesFor(cls);
    if (!result.ok) {
      failed.push(cls);
      continue;
    }
    for (const rule of result.rules) {
      if (rule.selector === "&" && rule.atRules.length === 0)
        inline.push(...rule.decls.map(([p, v]) => `${p}: ${v};`));
      else nested.push(printRule(rule, 0));
    }
  }
  if (failed.length)
    throw new DirectiveError(
      `@nb-apply: unknown or rejected utilities: ${failed.join(", ")}`,
      failed,
    );
  return [...inline, ...nested].join("\n");
}

/**
 * Replaces `@newbrush utilities;` with generated utilities for the given candidates and expands `@nb-apply`.
 * Returns the processed CSS; throws DirectiveError for unknown @nb-apply utilities.
 */
export function processDirectives(
  css: string,
  engine: Engine,
  candidates: Iterable<string> = [],
): { css: string; hasUtilities: boolean } {
  let hasUtilities = false;
  let out = css.replace(APPLY, (_, list: string) => expandApply(engine, list));
  out = out.replace(UTILITIES, () => {
    hasUtilities = true;
    return engine.generate(candidates, { reportUnknown: false }).css;
  });
  return { css: out, hasUtilities };
}

export function hasDirectives(css: string): boolean {
  return /@newbrush\s+utilities|@nb-apply/.test(css);
}
