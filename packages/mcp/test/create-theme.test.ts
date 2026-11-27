import { describe, expect, it } from "vitest";
import { buildPage } from "../src/lib/build-page.ts";
import { createTheme } from "../src/lib/create-theme.ts";
import { ToolError } from "../src/lib/errors.ts";
import { generateCss } from "../src/lib/generate-css.ts";
import { ThemeStore } from "../src/lib/theme-store.ts";
import { CreateThemeOutput } from "../src/schemas/index.ts";

// specs/003 T026 and US4 acceptance — create_theme, and themeId reuse in generate_css and build_page.

const error = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    if (e instanceof ToolError) return e.diagnostic;
  }
  throw new Error("expected a ToolError");
};

describe("create_theme", () => {
  it("returns light and dark token CSS, the tokens and a contrast report (US4-1)", () => {
    const r = createTheme(
      { name: "acme", seeds: { brand: "#2563eb", accent: "#e11d48" }, colorScheme: "both" },
      new ThemeStore(),
    );
    expect(CreateThemeOutput.parse(r)).toEqual(r);
    expect(r.themeId).toMatch(/^nbt_acme_[0-9a-f]{16}$/);
    expect(r.css).toMatch(/^\/\* newBrush theme "acme"/);
    expect(r.css).toContain("@layer nb.tokens");
    expect(r.css).toContain("[data-nb-theme][data-nb-theme]"); // applies to dark and contrast islands too
    expect(r.tokens["--nb-color-brand-500"]).toMatch(/^oklch\(/);
    expect(r.tokens["--nb-color-accent-500"]).toMatch(/^oklch\(/);
    const themes = new Set(r.contrast.map((c) => c.pair.split(":")[0]));
    expect([...themes].sort()).toEqual(["contrast", "dark", "light"]);
    expect(r.contrast.every((c) => c.pass)).toBe(true);
    expect(
      r.contrast.find((c) => c.pair === "light: color.text on color.surface")?.ratio,
    ).toBeGreaterThan(4.5);
  });

  it("checks only the schemes asked for", () => {
    const r = createTheme(
      { name: "acme", seeds: { brand: "#2563eb" }, colorScheme: "dark" },
      new ThemeStore(),
    );
    expect(new Set(r.contrast.map((c) => c.pair.split(":")[0]))).toEqual(new Set(["dark"]));
  });

  it("is deterministic: the same spec gives the same id and CSS, another spec another id", () => {
    const spec = { name: "acme", seeds: { brand: "#2563eb" } };
    const a = createTheme(spec, new ThemeStore());
    const b = createTheme({ ...spec }, new ThemeStore());
    expect(b.themeId).toBe(a.themeId);
    expect(b.css).toBe(a.css);
    expect(createTheme({ ...spec, radius: "round" }, new ThemeStore()).themeId).not.toBe(a.themeId);
    expect(
      createTheme({ ...spec, seeds: { brand: "#2563ec" } }, new ThemeStore()).themeId,
    ).not.toBe(a.themeId);
  });

  it("adjusts colours that miss the level, and strict fails instead (US4-2)", () => {
    const spec = { name: "sun", seeds: { brand: "#facc15" }, level: "AAA" as const };
    const r = createTheme(spec, new ThemeStore());
    const adjusted = r.contrast.filter((c) => c.adjusted);
    expect(adjusted.length).toBeGreaterThan(0);
    expect(adjusted.every((c) => c.pass)).toBe(true);
    expect(r.css).toContain("newBrush contrast fixes");
    const d = error(() => createTheme({ ...spec, strict: true }, new ThemeStore()));
    expect(d.code).toBe("NB_CONTRAST_FAIL");
    expect(d.message).toMatch(
      /miss WCAG AAA: \w+ color\.[a-z.-]+ on color\.[a-z.-]+ [\d.]+:1 \(needs 7:1\)/,
    );
    // At AA the derived palettes pass as they are.
    expect(
      createTheme({ ...spec, level: "AA", strict: true }, new ThemeStore()).contrast.every(
        (c) => c.pass,
      ),
    ).toBe(true);
  }, 30_000);

  it("sets radius, density and font tokens", () => {
    const r = createTheme(
      {
        name: "acme",
        seeds: { brand: "#2563eb" },
        radius: "sharp",
        density: "compact",
        font: "serif",
      },
      new ThemeStore(),
    );
    expect(r.tokens).toMatchObject({
      "--nb-radius-md": "0rem",
      "--nb-radius-2xl": "0rem",
      "--nb-control-height-md": "2.25rem",
      "--nb-font-family-sans": "var(--nb-font-family-serif)",
    });
    expect(r.tokens["--nb-radius-full"]).toBeUndefined(); // pills and avatars stay round
    const plain = createTheme({ name: "acme", seeds: { brand: "#2563eb" } }, new ThemeStore());
    expect(plain.tokens["--nb-radius-md"]).toBeUndefined();
  });

  it("rejects bad names and seeds", () => {
    const store = new ThemeStore();
    expect(
      error(() => createTheme({ name: "Acme!", seeds: { brand: "#2563eb" } }, store)),
    ).toMatchObject({
      code: "NB_SCHEMA_INVALID",
      path: "name",
    });
    expect(
      error(() => createTheme({ name: "dark", seeds: { brand: "#2563eb" } }, store)).message,
    ).toContain("built-in theme");
    expect(
      error(() => createTheme({ name: "acme", seeds: { brand: "not-a-colour" } }, store)),
    ).toMatchObject({
      code: "NB_SCHEMA_INVALID",
      path: "seeds",
    });
    expect(store.size).toBe(0);
  });

  it("is reused by themeId in generate_css and build_page", () => {
    const store = new ThemeStore();
    const t = createTheme(
      { name: "acme", seeds: { brand: "#7c4a2d" }, colorScheme: "dark", radius: "round" },
      store,
    );
    const css = generateCss({ classes: ["p-4"], theme: { themeId: t.themeId } }, store);
    expect(css.css).toContain(t.css.trim());
    expect(css.css).toContain(".p-4");
    const page = buildPage(
      {
        title: "Acme",
        theme: { themeId: t.themeId },
        sections: [{ type: "hero", props: { title: "Hello" } }],
      },
      store,
    );
    expect(page.css).toContain("--nb-radius-md: 0.75rem");
    expect(page.html).toContain('<html lang="en" dir="ltr" data-nb-theme="dark">'); // the theme's scheme
  });

  it("explains an unknown themeId, unless seeds are given too", () => {
    const store = new ThemeStore();
    const themeId = "nbt_acme_0123456789abcdef";
    const d = error(() => generateCss({ classes: ["p-4"], theme: { themeId } }, store));
    expect(d).toMatchObject({ code: "NB_SCHEMA_INVALID", path: "theme.themeId" });
    expect(d.message).toContain("create_theme");
    const r = generateCss(
      { classes: ["p-4"], theme: { themeId, seeds: { brand: "#2563eb" } } },
      store,
    );
    expect(r.css).toContain("--nb-color-brand-500");
  });

  it("keeps only the most recently used themes", () => {
    const store = new ThemeStore(2);
    store.set("a", { name: "a", css: "", colorScheme: "both" });
    store.set("b", { name: "b", css: "", colorScheme: "both" });
    store.get("a");
    store.set("c", { name: "c", css: "", colorScheme: "both" });
    expect([store.get("a")?.name, store.get("b"), store.get("c")?.name]).toEqual([
      "a",
      undefined,
      "c",
    ]);
    expect(new ThemeStore().size).toBe(0);
  });
});
