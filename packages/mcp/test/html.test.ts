import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { escapeHtml, html, SafeHtml, safeUrl, sanitizeInline } from "../src/html/index.ts";

// specs/003 T003 — escaping, URL allow-list and inline sanitizer, with fuzzing (10k cases each).

/** Markup that could run script if it reached a page. */
const dangerous = (out: string) =>
  /<\s*script/i.test(out) ||
  /<[^>]*\son[a-z]+\s*=/i.test(out) ||
  /(href|src)\s*=\s*["']?\s*(javascript|data|vbscript):/i.test(out) ||
  /<\s*(iframe|object|embed|svg|math|img|style|link|meta|form|input)/i.test(out);

describe("html helpers", () => {
  it("escapes interpolations, keeps SafeHtml, joins arrays", () => {
    const out = html`<p title="${'"x"'}">${"<b>&</b>"}${new SafeHtml("<em>ok</em>")}${["<1>", "2"]}</p>`;
    expect(out.value).toBe(
      '<p title="&quot;x&quot;">&lt;b&gt;&amp;&lt;/b&gt;<em>ok</em>&lt;1&gt;2</p>',
    );
    expect(escapeHtml(`'`)).toBe("&#39;");
  });

  it("allows only safe URL schemes", () => {
    for (const ok of [
      "https://x.dev",
      "http://x",
      "mailto:a@b.c",
      "tel:+1",
      "/path",
      "#id",
      "page.html",
      "?q=1",
    ])
      expect(safeUrl(ok), ok).toBe(ok);
    for (const bad of [
      "javascript:alert(1)",
      " JaVaScRiPt:x",
      "java\nscript:x",
      "data:text/html,x",
      "vbscript:x",
      "\u0001javascript:x",
    ])
      expect(safeUrl(bad), JSON.stringify(bad)).toBeUndefined();
  });

  it("keeps simple inline markup and strips everything else", () => {
    expect(
      sanitizeInline('<strong onclick="x">Hi</strong> <a href="/a" title="t">a</a> <em>x').value,
    ).toBe('<strong>Hi</strong> <a href="/a">a</a> <em>x</em>');
    expect(sanitizeInline('<a href="javascript:alert(1)">x</a><script>bad()</script>').value).toBe(
      "<a>x</a>&lt;script&gt;bad()&lt;/script&gt;",
    );
    expect(sanitizeInline("a <br> b </em> c").value).toBe("a <br> b  c");
  });

  it("fuzz: escaped text and sanitized inline markup never contain active content", () => {
    const pieces = fc.constantFrom(
      "<script>",
      "</script>",
      "<img src=x onerror=alert(1)>",
      '<a href="javascript:alert(1)">',
      "<a href=' data:text/html,x'>",
      "<svg onload=x>",
      "<strong onclick=x>",
      "<em>",
      "</em>",
      "<br>",
      '"',
      "'",
      "<",
      ">",
      "&",
      "javascript:",
      " onmouseover=",
      "<iframe>",
      "text",
    );
    const input = fc.oneof(
      fc.string(),
      fc.array(pieces).map((a) => a.join("")),
    );
    fc.assert(
      fc.property(input, (s) => {
        // Escaped text can never open a tag or leave a quoted attribute.
        expect(escapeHtml(s)).not.toMatch(/[<>"']/);
        expect(html`<p title="${s}">${s}</p>`.value.slice(3)).not.toMatch(/<(?!\/p>$)/);
        // Sanitized inline markup only ever contains the allowed tags, with no handlers or unsafe URLs.
        expect(dangerous(sanitizeInline(s).value)).toBe(false);
        for (const tag of sanitizeInline(s).value.match(/<[^>]*>/g) ?? [])
          expect(tag).toMatch(/^<\/?(strong|em|code|b|i|a)>$|^<br>$|^<a href="[^"<>]*">$/);
        // A URL that passes the allow-list never carries a dangerous scheme.
        const url = safeUrl(s);
        if (url !== undefined)
          // biome-ignore lint/suspicious/noControlCharactersInRegex: browsers drop these before reading the scheme
          expect(url.replace(/[\u0000-\u0020\u007f]/g, "")).not.toMatch(
            /^(javascript|data|vbscript):/i,
          );
      }),
      { numRuns: 10_000 },
    );
  });
});
