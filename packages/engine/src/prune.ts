/**
 * Config `styles` tree-shaking (specs/004 T028, FR-016): removes the CSS of design styles a build does not include.
 * Every selector @newbrush/styles emits names its own style first (`[data-nb-style="neon"]`, also when minified to
 * `[data-nb-style=neon]`), so each selector of a list belongs to the first style it mentions; a minifier that merges
 * rules of two styles leaves a list with two owners, and only the excluded one's selectors go. The `.style-default` reset
 * (`default`) is always kept, and at-rule blocks left empty are dropped. Browser-safe: a small block scanner that
 * respects strings and comments, no parser dependency.
 */

const STYLE = /data-nb-style=["']?([a-z0-9-]+)/;
const KEYFRAMES = /^@(?:-webkit-)?keyframes\s+([a-z0-9_-]+)/i;

interface Block {
  prelude: string;
  body: string;
}

/** Splits CSS into top-level statements: blocks `prelude { body }` and plain statements (returned as strings). */
function statements(css: string): (Block | string)[] {
  const out: (Block | string)[] = [];
  let start = 0;
  let depth = 0;
  let preludeEnd = -1;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2);
      i = end < 0 ? css.length : end + 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      for (i++; i < css.length && css[i] !== ch; i++) if (css[i] === "\\") i++;
      continue;
    }
    if (ch === "{") {
      if (depth === 0) preludeEnd = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        out.push({ prelude: css.slice(start, preludeEnd), body: css.slice(preludeEnd + 1, i) });
        start = i + 1;
      }
    } else if (ch === ";" && depth === 0) {
      out.push(css.slice(start, i + 1));
      start = i + 1;
    }
  }
  if (start < css.length) out.push(css.slice(start));
  return out;
}

/** Splits a selector list at top-level commas (`:is(a, b)` stays whole). */
function splitList(list: string): string[] {
  const out = [""];
  let depth = 0;
  for (const ch of list) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) out.push("");
    else out[out.length - 1] += ch;
  }
  return out;
}

const CONTAINERS = /^@(media|supports|layer|container|scope|document|starting-style)\b/;

/** `keep`: the style names to keep, or false for none. Returns the CSS without the other styles' rules. */
export function pruneStyles(css: string, keep: readonly string[] | false): string {
  const kept = new Set(keep === false ? [] : keep);
  kept.add("default");
  // Styles present in this stylesheet; a style's keyframes are named nb-<style>-… (e.g. nb-cyber-glitch).
  const present = new Set([...css.matchAll(new RegExp(STYLE.source, "g"))].map((m) => m[1] ?? ""));
  const dropped = [...present].filter((name) => !kept.has(name));
  const prune = (text: string): string =>
    statements(text)
      .map((st) => {
        if (typeof st === "string") return st;
        const prelude = st.prelude.trim();
        if (prelude.startsWith("@")) {
          const frames = KEYFRAMES.exec(prelude)?.[1] ?? "";
          if (frames && dropped.some((name) => frames.startsWith(`nb-${name}-`))) return "";
          if (!CONTAINERS.test(prelude)) return `${st.prelude}{${st.body}}`;
          const body = prune(st.body);
          return body.trim() ? `${st.prelude}{${body}}` : "";
        }
        // Comments in front of a rule are not its selector.
        const selector = st.prelude.replace(/\/\*[\s\S]*?\*\//g, "");
        if (!STYLE.test(selector)) return `${st.prelude}{${st.body}}`;
        // A style's group is `.neon, .nb-neon, [data-nb-style="neon"]`: a selector without the attribute belongs to
        // the next one that has it (or, at the end of the list, the previous one).
        const parts = splitList(selector);
        const explicit = parts.map((sel) => STYLE.exec(sel)?.[1]);
        const owners = explicit.map((own, i) => {
          if (own) return own;
          const next = explicit.slice(i + 1).find(Boolean);
          return next ?? explicit.slice(0, i).reverse().find(Boolean);
        });
        const selectors = parts.filter((_, i) => {
          const owner = owners[i];
          return !owner || kept.has(owner);
        });
        return selectors.length ? `${selectors.join(",")}{${st.body}}` : "";
      })
      .join("");
  return prune(css);
}
