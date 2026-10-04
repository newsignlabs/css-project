/**
 * Permissive candidate extraction for any template language (html, jsx, vue, svelte, template literals).
 * Splits on delimiters outside brackets/parentheses; the engine filters out everything that is not a utility.
 */
const DELIMITERS = new Set([
  " ",
  "\n",
  "\r",
  "\t",
  '"',
  "'",
  "`",
  "<",
  ">",
  "=",
  "{",
  "}",
  ";",
  ",",
  "\\",
]);

export function extractCandidates(source: string): Set<string> {
  const out = new Set<string>();
  let depth = 0;
  let cur = "";
  const flush = () => {
    let token = cur.replace(/^[(:.]+|[?.:]+$/g, "");
    // Drop closing parentheses that belong to the surrounding code, e.g. clsx("p-4") → p-4.
    while (
      token.endsWith(")") &&
      (token.match(/\)/g) ?? []).length > (token.match(/\(/g) ?? []).length
    )
      token = token.slice(0, -1);
    if (token && token.length < 200 && /[a-z]/i.test(token)) out.add(token);
    cur = "";
  };
  for (const ch of source) {
    if (ch === "[") depth++;
    else if (ch === "]" && depth > 0) depth--;
    if (depth === 0 && (DELIMITERS.has(ch) || (ch === "(" && /^[a-zA-Z]+$/.test(cur)))) {
      flush();
      continue;
    }
    if (depth > 0 && (ch === "\n" || ch === '"' || ch === "'" || ch === "`")) {
      depth = 0;
      flush();
      continue;
    }
    cur += ch;
  }
  flush();
  return out;
}
