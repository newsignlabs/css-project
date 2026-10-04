/**
 * Legacy-compatible stylesheet for the overview page.
 *
 * newBrush targets modern engines (Baseline widely available, Safari ≥ 17). A browser without cascade
 * layers (Chrome < 99, Safari < 15.4, Firefox < 97) drops every `@layer` block, so the page renders as
 * plain text. For the overview only, this flattens the layers into the same cascade order and lets
 * Lightning CSS lower the rest (OKLCH → hex/P3/Lab fallbacks, logical shorthands, vendor prefixes).
 * Features that cannot be lowered (`:has()`, container queries, `@starting-style`) degrade gracefully.
 */
import browserslist from "browserslist";
import { browserslistToTargets, transform } from "lightningcss";

/** Oldest engines the overview aims to style (all support `:where()`, which the framework relies on). */
export const LEGACY_BROWSERS = [
  "chrome >= 88",
  "edge >= 88",
  "firefox >= 78",
  "safari >= 14",
  "ios_saf >= 14",
  "samsung >= 15",
];

/** A statement (`@layer a, b;`) or a block (`prelude { body }`); `body` holds the raw inner text. */
type Node = { prelude: string; body: string | null };

/** Splits CSS text into top-level statements and blocks, skipping strings and comments. */
export function parse(css: string): Node[] {
  const nodes: Node[] = [];
  let i = 0;
  let start = 0;
  let depth = 0;
  let open = 0;
  while (i < css.length) {
    const ch = css[i];
    if (ch === "/" && css[i + 1] === "*") {
      const close = css.indexOf("*/", i + 2);
      i = close === -1 ? css.length : close + 2;
      if (depth === 0) start = i; // drop top-level comments
      continue;
    }
    if (ch === '"' || ch === "'") {
      i++;
      while (i < css.length && css[i] !== ch) i += css[i] === "\\" ? 2 : 1;
      i++;
      continue;
    }
    if (ch === "{") {
      if (depth++ === 0) open = i;
    } else if (ch === "}") {
      if (--depth === 0) {
        nodes.push({ prelude: css.slice(start, open).trim(), body: css.slice(open + 1, i) });
        start = i + 1;
      }
    } else if (ch === ";" && depth === 0) {
      const prelude = css.slice(start, i).trim();
      if (prelude) nodes.push({ prelude, body: null });
      start = i + 1;
    }
    i++;
  }
  return nodes;
}

type Buckets = Map<string, string[]>;
const layerName = (prelude: string) => prelude.replace(/^@layer\b/, "").trim();
const isGroup = (prelude: string) => /^@(media|supports|container)\b/.test(prelude);

/**
 * Splits rules into per-layer buckets, keeping source order inside each bucket. Conditional group rules
 * (`@media`, `@supports`, `@container`) that contain layers are cloned into every bucket they feed.
 */
function collect(css: string, layer: string[], names: string[][], into: Buckets) {
  const push = (bucket: string, text: string) => {
    if (!into.has(bucket)) into.set(bucket, []);
    into.get(bucket)?.push(text);
  };
  const register = (path: string[]) => {
    for (let i = 1; i <= path.length; i++) {
      const prefix = path.slice(0, i).join(".");
      if (!names.some((n) => n.join(".") === prefix)) names.push(path.slice(0, i));
    }
  };
  for (const { prelude, body } of parse(css)) {
    if (prelude.startsWith("@layer") && body === null) {
      for (const name of layerName(prelude).split(","))
        register([...layer, ...name.trim().split(".")]);
    } else if (prelude.startsWith("@layer") && body !== null) {
      const name = layerName(prelude);
      const path = [...layer, ...(name ? name.split(".") : [`anonymous-${names.length}`])];
      register(path);
      collect(body, path, names, into);
    } else if (body !== null && isGroup(prelude) && /@layer\b/.test(body)) {
      const inner: Buckets = new Map();
      collect(body, layer, names, inner);
      for (const [bucket, list] of inner) push(bucket, `${prelude}{${list.join("")}}`);
    } else {
      push(layer.join("."), body === null ? `${prelude};` : `${prelude}{${body}}`);
    }
  }
}

/** Cascade order of layers: sub-layers before their parent's own rules, unlayered rules last. */
function order(names: string[][]): string[] {
  const out: string[] = [];
  const visit = (parent: string[]) => {
    const prefix = parent.join(".");
    for (const child of names.filter(
      (n) => n.length === parent.length + 1 && n.slice(0, -1).join(".") === prefix,
    )) {
      visit(child);
    }
    out.push(prefix);
  };
  visit([]);
  return out; // the root (unlayered rules, key "") is visited last
}

/** Same rules, same cascade order, no `@layer`. `@charset`/`@import` would need hoisting; the bundle has none. */
export function flattenLayers(css: string): string {
  const names: string[][] = [];
  const buckets: Buckets = new Map();
  collect(css, [], names, buckets);
  return order(names)
    .flatMap((name) => buckets.get(name) ?? [])
    .join("\n");
}

/**
 * `color-mix()` and relative colours built on `var()` cannot be lowered at build time, and an older engine does
 * not fall back to an earlier declaration: a `var()` value is accepted at parse time and then computes to the
 * initial value. So the declaration becomes the plain variable, and the mixed colour moves into an `@supports`
 * copy of the rule right after it.
 */
const MIXED =
  /([a-z-]+):((?:color-mix\(in [a-z]+, ?var\((--[\w-]+)\)|oklch\(from var\((--[\w-]+)\))[^;}]*)/g;
const SUPPORTS =
  "@supports (color:color-mix(in oklch,red 50%,red)) and (color:oklch(from red l c h))";

export function addColorFallbacks(css: string): string {
  return css.replace(/([^{}]+)\{([^{}]*)\}/g, (rule, selector: string, body: string) => {
    const modern: string[] = [];
    const legacy = body.replace(
      MIXED,
      (_, prop: string, value: string, mixVar?: string, relVar?: string) => {
        modern.push(`${prop}:${value}`);
        return `${prop}:var(${mixVar ?? relVar})`;
      },
    );
    if (!modern.length) return rule;
    const sel = selector.trim();
    return `${selector}{${legacy}}${SUPPORTS}{${sel}{${modern.join(";")}}}`;
  });
}

export function compat(css: string): string {
  const license = css.match(/^\s*(\/\*![\s\S]*?\*\/)/)?.[1] ?? "";
  const { code } = transform({
    filename: "overview.css",
    code: Buffer.from(flattenLayers(css)),
    minify: true,
    targets: browserslistToTargets(browserslist(LEGACY_BROWSERS)),
  });
  return `${license}${license ? "\n" : ""}${addColorFallbacks(code.toString())}`;
}
