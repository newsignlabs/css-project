import { describe, expect, it } from "vitest";
import { ToolError } from "../src/lib/errors.ts";
import { search } from "../src/lib/search.ts";

// specs/003 T010 — search ranking fixtures: what people type → what newBrush calls it.

const top = (query: string, n = 5, kinds?: string[]) =>
  search({ query, limit: n, ...(kinds ? { kinds: kinds as never } : {}) }).results.map(
    (r) => `${r.kind}:${r.name}`,
  );

describe("search", () => {
  it.each([
    ["modal", "component:modal", 1],
    ["dialog", "component:modal", 3],
    ["dropdown", "component:select", 3],
    ["toggle", "component:switch", 1],
    ["checkbox", "component:check", 3],
    ["pricing table", "component:table", 5],
    ["pricing table", "component:card", 5],
    ["navigation bar", "component:navbar", 3],
    ["padding", "utility:padding", 1],
    ["text color", "utility:text-color", 3],
    ["text color", "token:--nb-color-text", 5],
    ["cyberpunk", "style:cyber", 1],
    ["glassmorphism", "style:g-morph", 1],
    ["notification", "component:alert", 3],
  ])('"%s" finds %s in the top %i', (query, expected, n) => {
    expect(top(query, n)).toContain(expected);
  });

  it("filters by kind, links resources, and gives examples", () => {
    const results = search({ query: "button", kinds: ["component"] }).results;
    expect(results.every((r) => r.kind === "component")).toBe(true);
    expect(results[0]).toMatchObject({ name: "button", uri: "newbrush://components/button" });
    expect(results[0]?.example).toContain("nb-btn");
    expect(search({ query: "x", kinds: ["section", "doc"] }).results).toEqual([]);
  });

  it("is deterministic and limited", () => {
    expect(search({ query: "card shadow" })).toEqual(search({ query: "card shadow" }));
    expect(search({ query: "color", limit: 25 }).results.length).toBe(25);
    expect(search({ query: "color" }).results.length).toBe(10);
    expect(() => search({ query: "color", limit: 26 })).toThrow(ToolError);
    expect(() => search({ query: "" })).toThrow(ToolError);
  });
});
