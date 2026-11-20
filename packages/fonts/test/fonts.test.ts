import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

/** specs/001 T091, FR-022: opt-in variable fonts, subsetted WOFF2 with font-display: swap, wired to font tokens. */
const dist = (file: string) => new URL(`../dist/${file}`, import.meta.url);
const read = (file: string) => readFileSync(dist(file), "utf8");
const manifest = JSON.parse(read("manifest.json")) as {
  families: {
    id: string;
    name: string;
    token: string;
    fallback: string;
    files: { file: string; bytes: number }[];
    license: string;
    inBundle: boolean;
  }[];
};
const tokens = JSON.parse(
  readFileSync(createRequire(import.meta.url).resolve("@newbrush/tokens/tokens.json"), "utf8"),
) as { tokens: { name: string; value: string }[] };

describe.each(manifest.families)("$name", (family) => {
  const css = read(`${family.id}.css`);
  const webFaces = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)]
    .map((m) => m[1] ?? "")
    .filter((b) => b.includes(`"${family.name}"`));

  it("serves every face as a subsetted WOFF2 with font-display: swap", () => {
    expect(webFaces.length).toBeGreaterThan(1);
    for (const face of webFaces) {
      expect(face).toContain("font-display: swap;");
      expect(face).toMatch(/unicode-range: U\+/);
      expect(face).toMatch(/font-weight: \d+ \d+;/); // variable weight axis
      const file = /url\("\.\/files\/([^"]+)"\) format\("woff2"\)/.exec(face)?.[1] ?? "";
      expect(existsSync(dist(`files/${file}`)), file).toBe(true);
      expect(
        readFileSync(dist(`files/${file}`))
          .subarray(0, 4)
          .toString("latin1"),
      ).toBe("wOF2");
    }
    // Text faces ship upright and italic; the pixel display face (opt-in) is upright only.
    expect(new Set(webFaces.map((f) => /font-style: (\w+)/.exec(f)?.[1]))).toEqual(
      new Set(family.inBundle ? ["normal", "italic"] : ["normal"]),
    );
    expect(family.files).toHaveLength(webFaces.length);
  });

  it("adds a metric-matched local fallback so the swap does not shift layout", () => {
    expect(css).toMatch(new RegExp(`font-family: "${family.fallback}";\\s*src: local\\(`));
    expect(css).toMatch(/size-adjust: [\d.]+%;/);
    expect(css).toMatch(/ascent-override: [\d.]+%;/);
  });

  it(`fills --nb-${family.token.replaceAll(".", "-")} with the font, then the system stack`, () => {
    const system = tokens.tokens.find((t) => t.name === family.token)?.value ?? "";
    const prop = `--nb-${family.token.replaceAll(".", "-")}`;
    expect(css).toContain(
      `@layer nb.tokens {\n  :root:root,\n  :root ::backdrop {\n    ${prop}: "${family.name}", "${family.fallback}", ${system};`,
    );
  });

  it("ships the OFL licence", () => {
    expect(read(family.license)).toMatch(/SIL Open Font License, Version 1\.1/);
  });
});

describe("fonts.css", () => {
  it("bundles the three text families for the three text tokens; the pixel face is opt-in only", () => {
    const css = read("fonts.css");
    const bundled = manifest.families.filter((f) => f.inBundle);
    expect(bundled.map((f) => f.token)).toEqual([
      "font.family.sans",
      "font.family.serif",
      "font.family.mono",
    ]);
    for (const f of bundled) expect(css).toContain(`font-family: "${f.name}";`);
    expect(css.match(/@layer nb\.tokens/g)).toHaveLength(3);
    expect(css).not.toContain("Pixelify");
  });
});

describe("pixelify-sans.css (specs/004 T024)", () => {
  it("fills --nb-font-family-pixel, keeping the mono stack after it", () => {
    const pixel = manifest.families.find((f) => f.id === "pixelify-sans");
    expect(pixel?.token).toBe("font.family.pixel");
    expect(pixel?.inBundle).toBe(false);
    const css = read("pixelify-sans.css");
    expect(css).toMatch(
      /--nb-font-family-pixel: "Pixelify Sans Variable", "[^"]+ Fallback", ui-monospace/,
    );
  });
});
