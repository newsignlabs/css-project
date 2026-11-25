// specs/003 T003 — HTML safety for everything the server writes (blueprints, compose_component, build_page):
// escaping by default, a URL allow-list, and a tiny inline-markup sanitizer for rich text slots.

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escapes text for use in HTML content or a quoted attribute. */
export const escapeHtml = (value: unknown): string =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);

/** Markup that is already safe (output of `html`, `sanitizeInline`), passed through `html` unescaped. */
export class SafeHtml {
  constructor(readonly value: string) {}
  toString(): string {
    return this.value;
  }
}

/** Tagged template that escapes every interpolation unless it is SafeHtml; arrays are joined. */
export function html(strings: TemplateStringsArray, ...values: unknown[]): SafeHtml {
  let out = strings[0] ?? "";
  values.forEach((value, i) => {
    const parts = Array.isArray(value) ? value : [value];
    for (const part of parts) out += part instanceof SafeHtml ? part.value : escapeHtml(part);
    out += strings[i + 1] ?? "";
  });
  return new SafeHtml(out);
}

/**
 * Returns the URL if it is safe to put in href/src, otherwise undefined: http(s), mailto and tel, plus relative URLs
 * and fragments. Anything with another scheme (javascript:, data:, vbscript:, …) is refused, including scheme names
 * hidden by whitespace or control characters.
 */
export function safeUrl(url: string): string | undefined {
  const trimmed = url.trim();
  // Browsers ignore tabs and newlines inside URLs and strip leading control characters and spaces.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: matching control characters is the point
  const normalised = trimmed.replace(/[\u0000- \u007f]/g, "");
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(normalised)?.[1]?.toLowerCase();
  if (scheme === undefined) return trimmed; // relative URL, path or fragment
  return ["http", "https", "mailto", "tel"].includes(scheme) ? trimmed : undefined;
}

const INLINE_TAGS = new Set(["strong", "em", "code", "b", "i", "br", "a"]);

/**
 * Keeps only simple inline markup in rich-text slots: <strong> <em> <b> <i> <code> <br> and <a href> with a safe URL.
 * Every other tag is escaped (shown as text); all attributes except a safe href are dropped.
 */
export function sanitizeInline(input: string): SafeHtml {
  const parts = input.split(/(<[^<>]*>)/g);
  let out = "";
  const open: string[] = [];
  for (const part of parts) {
    const tag = /^<\s*(\/?)\s*([a-z0-9]+)\b([^<>]*)>$/i.exec(part);
    if (!tag) {
      out += escapeHtml(part);
      continue;
    }
    const [, closing, rawName = "", attrs = ""] = tag;
    const name = rawName.toLowerCase();
    if (!INLINE_TAGS.has(name)) {
      out += escapeHtml(part);
      continue;
    }
    if (name === "br") {
      out += "<br>";
      continue;
    }
    if (closing) {
      const at = open.lastIndexOf(name);
      if (at === -1) continue;
      while (open.length > at) out += `</${open.pop()}>`;
      continue;
    }
    if (name === "a") {
      const href = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i.exec(attrs);
      const url = safeUrl(href?.[1] ?? href?.[2] ?? href?.[3] ?? "");
      out += url ? `<a href="${escapeHtml(url)}">` : "<a>";
    } else out += `<${name}>`;
    open.push(name);
  }
  while (open.length) out += `</${open.pop()}>`;
  return new SafeHtml(out);
}
