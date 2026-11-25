import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { BLUEPRINTS } from "../src/blueprints/index.ts";
import { buildPage } from "../src/lib/build-page.ts";

// specs/003 T016 / SC-005 — fuzz every text, rich-text and URL slot of every blueprint (10k pages in total): the page
// never contains a tag outside the blueprints' own vocabulary, an event handler, or a script URL.

const ALLOWED_TAGS = new Set([
  "a",
  "article",
  "blockquote",
  "br",
  "code",
  "details",
  "div",
  "em",
  "figcaption",
  "figure",
  "footer",
  "h1",
  "h2",
  "h3",
  "header",
  "img",
  "li",
  "main",
  "nav",
  "p",
  "section",
  "span",
  "strong",
  "summary",
  "ul",
  "b",
  "i",
]);

const nasty = fc.constantFrom(
  "<script>alert(1)</script>",
  '"><img src=x onerror=alert(1)>',
  "javascript:alert(1)",
  " JaVaScRiPt:alert(1)",
  "data:text/html,<script>x</script>",
  '<a href="javascript:x">a</a>',
  "<svg onload=x>",
  "<strong onclick=x>bold</strong>",
  "</section></main><script>",
  "' onmouseover='x",
  "<iframe src=//evil>",
  "<!-- --><style>*{}</style>",
);
const value = fc.oneof(
  fc.string({ maxLength: 40 }),
  nasty,
  fc.array(nasty, { maxLength: 3 }).map((a) => a.join("")),
);

/** Replaces every string leaf of an example with a generated value (array lengths and keys stay as in the example). */
function poison(example: unknown, gen: () => string): unknown {
  if (typeof example === "string") return gen() || "x";
  if (Array.isArray(example)) return example.map((v) => poison(v, gen));
  if (example && typeof example === "object")
    return Object.fromEntries(Object.entries(example).map(([k, v]) => [k, poison(v, gen)]));
  return example;
}

/** Every attribute of a tag as [name, value]; values are double-quoted by the blueprints, so a value cannot hide one. */
const attributesOf = (attrs: string) =>
  [...attrs.matchAll(/\s([^\s=/>"']+)(?:="([^"]*)")?/g)].map(
    (m) => [m[1] ?? "", m[2] ?? ""] as const,
  );

function assertSafe(html: string): void {
  const body = html.slice(html.indexOf("<body"));
  for (const [, name = "", attrs = ""] of body.matchAll(/<\/?([a-zA-Z0-9]+)([^>]*)>/g)) {
    expect(
      ALLOWED_TAGS.has(name.toLowerCase()) || ["body", "html"].includes(name.toLowerCase()),
      `tag <${name}>`,
    ).toBe(true);
    // Whatever is left after removing the parsed attributes must be blank: no stray quote broke out of a value.
    expect(attrs.replace(/\s([^\s=/>"']+)(?:="[^"]*")?/g, "").trim(), `<${name}${attrs}>`).toBe("");
    for (const [attr, value] of attributesOf(attrs)) {
      expect(attr.toLowerCase().startsWith("on"), `event handler ${attr} on <${name}>`).toBe(false);
      if (attr === "href" || attr === "src")
        expect(value.replace(/&#?\w+;/g, "").replace(/\s/g, "")).not.toMatch(
          /^(javascript|data|vbscript):/i,
        );
    }
  }
}

describe("slot fuzzing (XSS)", () => {
  const blueprints = [...BLUEPRINTS.values()];
  it.each(blueprints.map((b) => [b.name, b] as const))(
    "%s never emits active content",
    (_name, blueprint) => {
      fc.assert(
        fc.property(fc.array(value, { minLength: 60, maxLength: 60 }), (values) => {
          let i = 0;
          const props = poison(
            blueprint.example,
            () => values[i++ % values.length] ?? "x",
          ) as Record<string, unknown>;
          let page: ReturnType<typeof buildPage>;
          try {
            page = buildPage({
              title: "fuzz",
              sections: [{ type: blueprint.name, variant: blueprint.variants.at(-1), props }],
            });
          } catch {
            return; // a value the schema rejects (too long, empty) is not rendered at all
          }
          assertSafe(page.html);
        }),
        { numRuns: Math.ceil(10_000 / blueprints.length) },
      );
    },
    60_000,
  );
});
