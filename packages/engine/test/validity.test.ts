import { transform } from "lightningcss";
import { describe, expect, it } from "vitest";
import { createEngine } from "../src/index.ts";

// Every concrete utility and every variant produces CSS that a real parser accepts without recovery.
describe("output validity", () => {
  for (const strategy of ["selector", "style-query"] as const) {
    it(`all known classes × variants parse cleanly (${strategy})`, () => {
      const engine = createEngine({ content: ["x"], themeVariants: strategy });
      const known = engine.knownClasses();
      expect(known.length).toBeGreaterThan(1500);
      const variants = engine.variants().map((v) => v.name);
      const withVariants = variants.flatMap((v) => {
        if (v === "[arbitrary]") return ["[&>*]:p-2"];
        if (["group", "peer"].includes(v)) return [`${v}-hover:p-2`, `${v}-focus-visible:p-2`];
        if (v === "aria") return ["aria-expanded:p-2", "aria-[sort=ascending]:p-2"];
        if (v === "data") return ["data-[state=open]:p-2", "data-active:p-2"];
        if (v === "has") return ["has-[:checked]:p-2"];
        if (v === "not") return ["not-[:last-child]:p-2", "not-hover:p-2"];
        if (v === "supports") return ["supports-[display:grid]:grid"];
        return [`${v}:p-2`, `md:${v}:p-2`];
      });
      const result = engine.generate([...known, ...withVariants]);
      expect(result.classes.unknown).toEqual([]);
      expect(() =>
        transform({
          filename: "utilities.css",
          code: Buffer.from(result.css),
          errorRecovery: false,
        }),
      ).not.toThrow();
      const { warnings } = transform({
        filename: "utilities.css",
        code: Buffer.from(result.css),
        errorRecovery: true,
      });
      expect(warnings.map((w) => w.message)).toEqual([]);
    });
  }
});
