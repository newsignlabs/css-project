import { describe, expect, it } from "vitest";
import { ToolError } from "../src/lib/errors.ts";
import { getComponent } from "../src/lib/get-component.ts";
import { getTokens } from "../src/lib/get-tokens.ts";
import { manifest } from "../src/manifest.ts";

// specs/003 T012 — get_component and get_tokens.

const error = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    if (e instanceof ToolError) return e.diagnostic;
  }
  throw new Error("expected a ToolError");
};

describe("get_component", () => {
  it("returns the manifest entry (also for nb- names and any case)", () => {
    const button = manifest.components.find((c) => c.name === "button");
    expect(getComponent({ name: "button" })).toEqual(button);
    expect(getComponent({ name: "NB-Button" }).name).toBe("button");
  });

  it("suggests close names for unknown components", () => {
    const d = error(() => getComponent({ name: "buton" }));
    expect(d).toMatchObject({ code: "NB_UNKNOWN_COMPONENT", suggestion: "button" });
    expect(d.message).toContain("Components:");
  });
});

describe("get_tokens", () => {
  it("returns a group, with a theme's values", () => {
    const light = getTokens({ group: "color.text" }).tokens;
    const dark = getTokens({ group: "color.text", theme: "dark" }).tokens;
    expect(light.map((t) => t.cssVar)).toContain("--nb-color-text");
    const text = (list: typeof light) => list.find((t) => t.cssVar === "--nb-color-text")?.value;
    expect(text(dark)).not.toBe(text(light));
    expect(getTokens({}).tokens).toHaveLength(manifest.tokens.length);
  });

  it("writes CSS for the theme", () => {
    expect(getTokens({ group: "radius", format: "css" }).css).toMatch(
      /^:root \{\n {2}--nb-radius-/,
    );
    expect(getTokens({ group: "color.text", theme: "dark", format: "css" }).css).toMatch(
      /^\[data-nb-theme="dark"\] \{/,
    );
  });

  it("rejects unknown groups and themes, listing the valid ones", () => {
    expect(error(() => getTokens({ group: "colours" }))).toMatchObject({
      code: "NB_SCHEMA_INVALID",
      path: "group",
    });
    expect(error(() => getTokens({ theme: "sepia" })).message).toContain("light, dark, contrast");
  });
});
