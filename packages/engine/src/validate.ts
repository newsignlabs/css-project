/** Arbitrary-value grammars (specs/001-core-framework/contracts/class-grammar.md §Arbitrary-value validation). */
export type Grammar =
  | "length"
  | "color"
  | "percentage"
  | "number"
  | "time"
  | "image-safe"
  | "grid-template"
  | "ident";
export type Validation = { ok: true } | { ok: false; reason: string };

const MAX_LENGTH = 200;
const FORBIDDEN = /[;{}<>@\\!"'`]|\/\*|javascript:|expression\(|url\(|image-set\(|@import/i;
const UNIT =
  "(?:px|rem|em|ex|ch|lh|rlh|vw|vh|vi|vb|vmin|vmax|dvh|dvw|dvi|dvb|svh|svw|lvh|lvw|cqw|cqh|cqi|cqb|cqmin|cqmax|%|cm|mm|in|pt|pc|q)";
const NUMBER = "-?(?:\\d+\\.?\\d*|\\.\\d+)";
const LENGTH_TOKEN = new RegExp(`^(?:${NUMBER}${UNIT}|-?0|${NUMBER})$`, "i");
const VAR = /^var\(--[a-z0-9_-]+(?:,[^()]*)?\)$/i;
const NAMED_COLOR = /^[a-z]{3,20}$/i;
const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const FUNCTIONS: Record<Grammar, Set<string>> = {
  length: new Set(["calc", "min", "max", "clamp", "var"]),
  percentage: new Set(["calc", "var"]),
  number: new Set(["calc", "var"]),
  time: new Set(["calc", "var"]),
  color: new Set([
    "rgb",
    "rgba",
    "hsl",
    "hsla",
    "hwb",
    "lab",
    "lch",
    "oklab",
    "oklch",
    "color",
    "color-mix",
    "light-dark",
    "var",
    "calc",
  ]),
  "image-safe": new Set([
    "linear-gradient",
    "radial-gradient",
    "conic-gradient",
    "repeating-linear-gradient",
    "repeating-radial-gradient",
    "repeating-conic-gradient",
    "rgb",
    "rgba",
    "hsl",
    "hsla",
    "oklch",
    "oklab",
    "lab",
    "lch",
    "color",
    "color-mix",
    "var",
    "calc",
  ]),
  "grid-template": new Set([
    "repeat",
    "minmax",
    "fit-content",
    "calc",
    "min",
    "max",
    "clamp",
    "var",
  ]),
  ident: new Set([]),
};

const fail = (reason: string): Validation => ({ ok: false, reason });

function functionsUsed(value: string): string[] {
  return [...value.matchAll(/([a-z-]+)\(/gi)].map((m) => (m[1] as string).toLowerCase());
}

function balanced(value: string): boolean {
  let depth = 0;
  for (const ch of value) {
    if (ch === "(") depth++;
    else if (ch === ")" && --depth < 0) return false;
  }
  return depth === 0;
}

/** Splits on whitespace and commas outside parentheses. */
function topLevelTokens(value: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of value) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (depth === 0 && (ch === " " || ch === ",")) {
      if (cur) out.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

function isLengthToken(token: string): boolean {
  return (
    LENGTH_TOKEN.test(token) || VAR.test(token) || /^(?:calc|min|max|clamp)\(.*\)$/i.test(token)
  );
}

export function validateArbitrary(raw: string, grammar: Grammar): Validation {
  const value = raw.trim();
  if (!value) return fail("empty value");
  if (value.length > MAX_LENGTH) return fail(`longer than ${MAX_LENGTH} characters`);
  if (FORBIDDEN.test(value)) return fail("contains a forbidden character or function");
  if (!/^[a-z0-9#%.,()+\-*/ _]+$/i.test(value))
    return fail("contains characters outside the allowed set");
  if (!balanced(value)) return fail("unbalanced parentheses");
  for (const fn of functionsUsed(value)) {
    if (!FUNCTIONS[grammar].has(fn))
      return fail(`function ${fn}() is not allowed for ${grammar} values`);
  }

  const tokens = topLevelTokens(value);
  switch (grammar) {
    case "length":
      return tokens.length === 1 && isLengthToken(value) ? { ok: true } : fail("not a length");
    case "percentage":
      return /^-?\d*\.?\d+%$/.test(value) || VAR.test(value) || /^calc\(/i.test(value)
        ? { ok: true }
        : fail("not a percentage");
    case "number":
      return /^-?\d*\.?\d+$/.test(value) || VAR.test(value) || /^calc\(/i.test(value)
        ? { ok: true }
        : fail("not a number");
    case "time":
      return /^\d*\.?\d+m?s$/i.test(value) || VAR.test(value) || /^calc\(/i.test(value)
        ? { ok: true }
        : fail("not a time");
    case "color":
      return tokens.length === 1 &&
        (HEX.test(value) || NAMED_COLOR.test(value) || /^[a-z-]+\(.*\)$/i.test(value))
        ? { ok: true }
        : fail("not a color");
    case "image-safe":
      return /gradient\(/i.test(value) || VAR.test(value)
        ? { ok: true }
        : fail("only gradients are allowed");
    case "grid-template":
      return tokens.every(
        (t) =>
          isLengthToken(t) ||
          /^\d*\.?\d+fr$/.test(t) ||
          /^(?:auto|min-content|max-content|subgrid|none)$/.test(t) ||
          /^[a-z-]+\(.*\)$/i.test(t),
      )
        ? { ok: true }
        : fail("not a grid template");
    case "ident":
      return /^[a-z][a-z0-9-]*$/i.test(value) ? { ok: true } : fail("not an identifier");
  }
}

/** Grammar guess for families that accept several value types (e.g. text-[…] is a size or a color). */
export function looksLikeColor(value: string): boolean {
  return (
    HEX.test(value) ||
    /^(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark)\(/i.test(value) ||
    /^(?:transparent|currentcolor)$/i.test(value)
  );
}
