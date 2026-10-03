import { describe, expect, it } from "vitest";
import { defineConfig } from "../config/index.js";

describe("newbrush/config", () => {
  it("defineConfig returns its argument", () => {
    const config = { content: ["src/**/*.html"] };
    expect(defineConfig(config)).toBe(config);
  });
});
