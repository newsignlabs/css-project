import stylelint from "stylelint";
import { describe, expect, it } from "vitest";
import config from "../index.js";

async function lint(code, codeFilename = "src/base/typography.css") {
  const { results } = await stylelint.lint({ code, codeFilename, config });
  return results[0].warnings.filter(
    (w) => w.rule.startsWith("nb/") || w.rule === "declaration-no-important",
  );
}

describe("nb/require-layer", () => {
  it("accepts rules inside an nb.* layer", async () => {
    expect(await lint("@layer nb.base { .nb-x { color: var(--nb-color-text); } }\n")).toEqual([]);
  });

  it("accepts layer order statements and nested at-rules", async () => {
    const css =
      "@layer nb.reset, nb.base;\n\n@layer nb.base {\n  @media (width >= 48rem) { .nb-x { display: grid; } }\n}\n";
    expect(await lint(css)).toEqual([]);
  });

  it("rejects unlayered rules", async () => {
    const [w] = await lint(".nb-x { display: grid; }\n");
    expect(w?.rule).toBe("nb/require-layer");
  });

  it("rejects layers outside the nb namespace", async () => {
    const [w] = await lint("@layer app { .nb-x { display: grid; } }\n");
    expect(w?.text).toMatch(/must be named "nb\.\*"/);
  });

  it("allows keyframes and @property at the top level", async () => {
    const css =
      "@property --nb-angle { syntax: '<angle>'; inherits: false; initial-value: 0deg; }\n\n@keyframes nb-spin { to { rotate: 1turn; } }\n";
    expect(await lint(css)).toEqual([]);
  });
});

describe("nb/use-logical", () => {
  it.each([
    ["margin-left: 0", "margin-inline-start"],
    ["padding-top: 0", "padding-block-start"],
    ["border-right-width: 1px", "border-inline-end-width"],
    ["top: 0", "inset-block-start"],
    ["border-top-left-radius: 0", "border-start-start-radius"],
  ])("rejects %s", async (decl, alt) => {
    const [w] = await lint(`@layer nb.base { .nb-x { ${decl}; } }\n`);
    expect(w?.text).toContain(alt);
  });

  it("rejects text-align: left", async () => {
    const [w] = await lint("@layer nb.base { .nb-x { text-align: left; } }\n");
    expect(w?.text).toContain("text-align: start");
  });

  it("accepts logical properties", async () => {
    expect(
      await lint(
        "@layer nb.base { .nb-x { margin-inline-start: 0; inset-block-start: 0; text-align: start; } }\n",
      ),
    ).toEqual([]);
  });
});

describe("nb/no-raw-values", () => {
  it.each(["#fff", "rgb(0 0 0)", "oklch(50% 0.1 200)", "red"])(
    "rejects raw color %s",
    async (color) => {
      const [w] = await lint(`@layer nb.base { .nb-x { color: ${color}; } }\n`);
      expect(w?.rule).toBe("nb/no-raw-values");
    },
  );

  it("accepts tokens, color-mix and relative colors from tokens", async () => {
    const css =
      "@layer nb.base {\n  .nb-x {\n    color: var(--nb-color-text);\n    background: color-mix(in oklch, var(--nb-color-accent) 20%, transparent);\n    border-color: oklch(from var(--nb-color-accent) l c h / 50%);\n  }\n}\n";
    expect(await lint(css)).toEqual([]);
  });

  it("allows token definitions to use raw values", async () => {
    expect(await lint("@layer nb.tokens { :root { --nb-color-x: #fff; } }\n")).toEqual([]);
  });

  it("rejects raw lengths only in components", async () => {
    const css =
      "@layer nb.components { .nb-x { padding: 12px; gap: 1rem; border-width: 1px; margin: 0; } }\n";
    expect(await lint(css, "src/base/x.css")).toEqual([]);
    const warnings = await lint(css, "src/components/x/x.css");
    expect(warnings.map((w) => w.text)).toEqual([
      expect.stringContaining('"12px"'),
      expect.stringContaining('"1rem"'),
    ]);
  });
});

describe("declaration-no-important", () => {
  it("is enforced for components", async () => {
    const [w] = await lint(
      "@layer nb.components { .nb-x { display: grid !important; } }\n",
      "src/components/x/x.css",
    );
    expect(w?.rule).toBe("declaration-no-important");
  });
});
