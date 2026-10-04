import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { validateArbitrary } from "../src/index.ts";
import { engine } from "./helpers.ts";

// T036 (fuzz) — arbitrary values can never smuggle CSS out of their declaration (constitution §IX).
describe("validateArbitrary()", () => {
  it.each([
    ["37ch", "length"],
    ["calc(100% - 2rem)", "length"],
    ["clamp(1rem, 2vi, 3rem)", "length"],
    ["var(--x)", "length"],
    ["#ff0", "color"],
    ["oklch(60% 0.2 250)", "color"],
    ["color-mix(in oklch, red 40%, blue)", "color"],
    ["linear-gradient(to bottom, #fff, #000)", "image-safe"],
    ["repeat(2, minmax(0, 1fr))", "grid-template"],
    ["150ms", "time"],
    ["1.5", "number"],
    ["50%", "percentage"],
  ] as const)("accepts %s as %s", (value, grammar) => {
    expect(validateArbitrary(value, grammar)).toEqual({ ok: true });
  });

  it.each([
    ["red;color:blue", "color"],
    ["1rem}body{color:red", "length"],
    ["url(https://evil)", "image-safe"],
    ["expression(alert(1))", "color"],
    ["javascript:alert(1)", "length"],
    ["@import 'x'", "length"],
    ["10px\\3b", "length"],
    ["</style>", "length"],
    ["12parsecs", "length"],
    ["banana", "length"],
    ["image-set(url(a.png) 1x)", "image-safe"],
    ["a".repeat(201), "length"],
  ] as const)("rejects %s as %s", (value, grammar) => {
    expect(validateArbitrary(value, grammar).ok).toBe(false);
  });

  it("never emits a declaration that escapes its block (fuzz)", () => {
    const chars = fc.constantFrom(
      ..."abcdefghijklmnopqrstuvwxyz0123456789%#.,()-_ ;:{}<>@\\/'\"!*".split(""),
    );
    fc.assert(
      fc.property(
        fc.array(chars, { maxLength: 40 }).map((a) => a.join("")),
        (value) => {
          for (const root of ["w", "bg", "text", "grid-cols", "p"]) {
            const css = engine.generate([`${root}-[${value}]`]).css;
            const body = css
              .replace(/^@layer [^;]+;\n@layer nb\.utilities \{\n?/, "")
              .replace(/\}\s*$/, "");
            // Exactly one rule at most, and no characters that could open a new block or statement.
            expect((body.match(/\{/g) ?? []).length).toBeLessThanOrEqual(1);
            expect(body).not.toMatch(/;\s*[a-z-]+\s*:[^}]*;[^}]*;|@import|url\(|<\//i);
          }
        },
      ),
      { numRuns: 1000 },
    );
  });
});
