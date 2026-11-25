import { HtmlValidate } from "html-validate";
import { describe, expect, it } from "vitest";
import { BLUEPRINTS } from "../src/blueprints/index.ts";
import { buildPage } from "../src/lib/build-page.ts";

// specs/003 T015 (HTML half; the axe half runs in apps/visual-tests/specs/mcp-pages.spec.ts) — every blueprint ×
// variant builds valid HTML from its example, uses only known newBrush classes and raises no warnings.

const validator = new HtmlValidate({ extends: ["html-validate:recommended"] });
const cases = [...BLUEPRINTS.values()].flatMap((b) => b.variants.map((v) => [b.name, v] as const));

describe("blueprints", () => {
  it.each(cases)("%s (%s) builds a valid page with no warnings", async (type, variant) => {
    const blueprint = BLUEPRINTS.get(type);
    const r = buildPage({
      title: "Blueprint test",
      sections: [{ type, variant, props: blueprint?.example as Record<string, unknown> }],
    });
    const problems = r.diagnostics.filter((d) => d.severity !== "info");
    expect(problems).toEqual([]);
    const report = await validator.validateString(r.html);
    expect(
      report.results.flatMap((x) => x.messages.map((m) => `${m.ruleId}: ${m.message}`)),
    ).toEqual([]);
    expect((r.html.match(/<h1[\s>]/g) ?? []).length).toBeLessThanOrEqual(1);
  });

  it("every blueprint documents its variants, region and a valid example", () => {
    for (const b of BLUEPRINTS.values()) {
      expect(b.variants.length, b.name).toBeGreaterThan(0);
      expect(b.props.safeParse(b.example).success, b.name).toBe(true);
    }
  });
});
