import { describe, expect, it } from "vitest";
import { createEngine, generate } from "../src/index.ts";
import { cssFor, engine, normalize } from "./helpers.ts";

// T037 — golden output and determinism.
const SAMPLE = [
  "flex",
  "grid",
  "hidden",
  "md:grid-cols-3",
  "gap-6",
  "p-8",
  "px-4",
  "-mt-2",
  "mx-auto",
  "w-1/2",
  "max-w-prose",
  "rounded-xl",
  "bg-surface-raised",
  "text-muted",
  "text-lg",
  "font-semibold",
  "leading-tight",
  "shadow-md",
  "hover:shadow-lg",
  "transition",
  "duration-base",
  "border",
  "border-strong",
  "ring-2",
  "ring-accent",
  "dark:bg-neutral-900",
  "focus-visible:outline-2",
  "sr-only",
  "truncate",
  "animate-spin",
  "space-y-4",
  "divide-y",
  "bg-linear-to-b",
  "from-brand-500",
  "to-accent-500",
  "glass",
  "opacity-50",
  "translate-y-2",
  "z-modal",
  "@container",
  "@md:flex-row",
  "aspect-video",
  "line-clamp-2",
  "snap-x",
  "cursor-pointer",
];

describe("generate()", () => {
  it("recognises every class in the sample", () => {
    const r = engine.generate(SAMPLE);
    expect(r.classes.unknown).toEqual([]);
    expect(r.classes.rejected).toEqual([]);
    expect(r.classes.used).toHaveLength(new Set(SAMPLE).size);
  });

  it("matches the golden snapshot", async () => {
    await expect(engine.generate(SAMPLE).css).toMatchFileSnapshot("./__snapshots__/sample.css");
  });

  it("is deterministic regardless of input order or duplicates", () => {
    const a = engine.generate(SAMPLE).css;
    const shuffled = [...SAMPLE].reverse().concat(SAMPLE.slice(0, 5));
    expect(createEngine({ content: ["x"], themeVariants: "selector" }).generate(shuffled).css).toBe(
      a,
    );
  });

  it("reports used, unknown and rejected classes", () => {
    const r = engine.generate(["p-4", "nope-nope", "w-[;evil]", "bg-[url(x)]"]);
    expect(r.classes.used).toEqual(["p-4"]);
    expect(r.classes.unknown).toEqual(["nope-nope"]);
    expect(r.classes.rejected.map((d) => d.class)).toEqual(["bg-[url(x)]", "w-[;evil]"]);
    expect(r.classes.rejected.every((d) => d.code === "NB_ARBITRARY_REJECTED")).toBe(true);
  });

  it("emits keyframes once for animation utilities", () => {
    const css = cssFor(["animate-spin", "md:animate-spin"]);
    expect(css.match(/@keyframes nb-spin/g)).toHaveLength(1);
  });

  it("puts shorthand families before longhands so longhands win", () => {
    const css = cssFor(["px-2", "p-4"]);
    expect(css.indexOf(".p-4{")).toBeLessThan(css.indexOf(".px-2{"));
  });

  it("composes ring and shadow", () => {
    const css = cssFor(["ring-2", "shadow-md"]);
    expect(css).toContain(
      "box-shadow:var(--nb-ring-shadow,0 0 transparent),var(--nb-shadow,0 0 transparent)",
    );
  });

  it("uses only logical properties for direction-sensitive utilities", () => {
    const css = cssFor([
      "px-4",
      "ms-2",
      "me-2",
      "start-0",
      "end-0",
      "border-s",
      "rounded-s-lg",
      "text-start",
    ]);
    expect(css).not.toMatch(
      /(margin|padding)-(left|right)|[^-]left:|[^-]right:|border-(left|right)/,
    );
  });

  it("applies safelist and blocklist from config", () => {
    const e = createEngine({ content: ["x"], safelist: ["p-1"], blocklist: ["p-2"] });
    const r = e.generate(["p-2", "p-3"]);
    expect(r.classes.used).toEqual(["p-1", "p-3"]);
  });

  it("the async generate() accepts raw content and reports stats", async () => {
    const r = await generate({ content: ['<div class="p-4 md:flex">'] });
    expect(r.classes.used).toEqual(["md:flex", "p-4"]);
    expect(r.stats.rules).toBe(2);
    expect(r.stats.bytes).toBe(new TextEncoder().encode(r.css).length);
  });

  it("explains a class", () => {
    const x = engine.explain("md:px-6");
    expect(x).toMatchObject({ family: "padding-inline", parsed: { utility: "px", value: "6" } });
    if ("css" in x) expect(normalize(x.css)).toContain("padding-inline:var(--nb-space-6)");
  });

  it("describes families and variants for the manifest", () => {
    const families = engine.utilityFamilies();
    expect(families.length).toBeGreaterThanOrEqual(100);
    expect(new Set(families.map((f) => f.name)).size).toBe(families.length);
    expect(engine.variants().map((v) => v.name)).toEqual(
      expect.arrayContaining(["sm", "@md", "hover", "dark", "print"]),
    );
  });
});
