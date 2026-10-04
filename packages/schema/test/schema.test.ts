import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { Component, Config, defineConfig, LAYERS, Manifest } from "../src/index.ts";

const fixture = async (name: string) =>
  JSON.parse(await readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));

describe("Config", () => {
  it("applies documented defaults", () => {
    const resolved = Config.parse({ content: ["src/**/*.html"] });
    expect(resolved.darkMode).toBe("both");
    expect(resolved.themeVariants).toBe("auto");
    expect(resolved.components).toBe("all");
    expect(resolved.utilities).toBe("all");
  });

  it("requires at least one content glob", () => {
    expect(() => Config.parse({ content: [] })).toThrow();
  });

  it("rejects unknown keys", () => {
    expect(() => Config.parse({ content: ["x"], colour: "red" })).toThrow();
  });

  it("validates the utility prefix pattern", () => {
    expect(() => Config.parse({ content: ["x"], prefix: { utilities: "Bad_" } })).toThrow();
    expect(Config.parse({ content: ["x"], prefix: { utilities: "nb-" } }).prefix?.utilities).toBe(
      "nb-",
    );
  });

  it("defineConfig is an identity helper", () => {
    const cfg = { content: ["a"] };
    expect(defineConfig(cfg)).toBe(cfg);
  });

  it("stays in sync with the config contract in specs/ (drift check)", async () => {
    const contract = JSON.parse(
      await readFile(
        new URL("../../../specs/001-core-framework/contracts/config.schema.json", import.meta.url),
        "utf8",
      ),
    );
    const generated = z.toJSONSchema(Config, { target: "draft-2020-12", io: "input" }) as {
      properties: Record<string, { enum?: string[]; default?: unknown }>;
      required: string[];
    };
    expect(Object.keys(generated.properties).sort()).toEqual(
      Object.keys(contract.properties).sort(),
    );
    expect(generated.required).toEqual(contract.required);
    for (const key of ["darkMode", "themeVariants"]) {
      expect(generated.properties[key]?.enum).toEqual(contract.properties[key].enum);
      expect(generated.properties[key]?.default).toEqual(contract.properties[key].default);
    }
  });
});

describe("Component", () => {
  it("accepts a valid component meta", async () => {
    const button = await fixture("button.component.json");
    expect(() => Component.parse(button)).not.toThrow();
  });

  it("requires at least one example and one a11y requirement", async () => {
    const button = await fixture("button.component.json");
    expect(() => Component.parse({ ...button, examples: [] })).toThrow();
    expect(() => Component.parse({ ...button, a11y: { requirements: [] } })).toThrow();
  });

  it("enforces the nb- class prefix", async () => {
    const button = await fixture("button.component.json");
    expect(() => Component.parse({ ...button, className: "btn" })).toThrow();
  });
});

describe("Manifest", () => {
  it("accepts an empty manifest skeleton", () => {
    const manifest = {
      name: "newbrush",
      version: "0.0.0",
      schemaVersion: 1,
      layers: [...LAYERS],
      tokens: [],
      themes: [],
      variants: [],
      utilities: [],
      components: [],
    };
    expect(Manifest.parse(manifest).layers).toEqual(LAYERS);
  });
});
