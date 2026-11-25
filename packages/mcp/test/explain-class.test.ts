import { describe, expect, it } from "vitest";
import { ToolError } from "../src/lib/errors.ts";
import { explainClass } from "../src/lib/explain-class.ts";

// specs/003 T007 — explain_class.

describe("explain_class", () => {
  it("explains variants, family, CSS and links the docs", () => {
    const [r] = explainClass({ classes: ["md:hover:p-4"] }).results;
    expect(r).toMatchObject({
      class: "md:hover:p-4",
      family: "padding",
      parsed: { variants: ["md", "hover"], utility: "p", value: "4" },
    });
    if (!r || "code" in r) throw new Error("expected an explanation");
    expect(r.css).toContain("padding");
    expect(r.docs).toMatch(/\/site\/reference\/utilities\/index\.html#spacing$/);
  });

  it("returns diagnostics for invalid classes, in order", () => {
    const results = explainClass({ classes: ["p-[;x]", "p-4", "nope-1"] }).results;
    expect(results.map((r) => ("code" in r ? r.code : "ok"))).toEqual([
      "NB_ARBITRARY_REJECTED",
      "ok",
      "NB_UNKNOWN_CLASS",
    ]);
  });

  it("allows at most 50 classes", () => {
    try {
      explainClass({ classes: Array.from({ length: 51 }, () => "p-4") });
      throw new Error("no error");
    } catch (e) {
      expect(e instanceof ToolError && e.diagnostic.code).toBe("NB_INPUT_TOO_LARGE");
    }
  });
});
