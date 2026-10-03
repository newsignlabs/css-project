import { describe, expect, it } from "vitest";
import { extractCandidates } from "../src/index.ts";

// T038 — candidate extraction across template languages. Extraction is permissive; the engine filters.
const has = (src: string, ...classes: string[]) => {
  const found = extractCandidates(src);
  for (const c of classes) expect(found, `${c} in ${src}`).toContain(c);
};

describe("extractCandidates()", () => {
  it("html", () =>
    has(
      '<div class="p-4 md:flex hover:bg-brand-600/80">',
      "p-4",
      "md:flex",
      "hover:bg-brand-600/80",
    ));
  it("jsx className and clsx calls", () =>
    has(
      '<a className={clsx("px-2", ok && "text-muted", { "ring-2": x })}/>',
      "px-2",
      "text-muted",
      "ring-2",
    ));
  it("vue :class bindings", () =>
    has(`<div :class="{ 'opacity-50': off, 'font-bold': on }">`, "opacity-50", "font-bold"));
  it("svelte class: directives", () =>
    has("<div class:hidden={x} class=\"grid {y ? 'gap-4' : ''}\">", "grid", "gap-4"));
  it("template literals", () =>
    has(
      "const c = `w-[37ch] ${a ? 'grid-cols-[1fr_auto]' : ''}`;",
      "w-[37ch]",
      "grid-cols-[1fr_auto]",
    ));
  it("keeps commas and spaces-as-underscores inside brackets", () =>
    has(
      'class="grid-cols-[repeat(2,minmax(0,1fr))] bg-(--brand)"',
      "grid-cols-[repeat(2,minmax(0,1fr))]",
      "bg-(--brand)",
    ));
  it("arbitrary selector variants", () =>
    has('class="[&>*]:p-2 data-[state=open]:block"', "[&>*]:p-2", "data-[state=open]:block"));
  it("returns a Set without empty strings", () => {
    const set = extractCandidates("  \n\t ");
    expect(set.size).toBe(0);
  });
});
