import { describe, expect, it } from "vitest";
import { codeFromHash, decode, encode } from "../src/playground/share.ts";

// specs/001 T083 — playground share codes round-trip and reject garbage.

describe("playground share codes", () => {
  it("round-trips HTML, unicode and large input, using URL-safe characters only", async () => {
    for (const html of [
      '<button class="nb-btn nb-btn--primary" type="button">Save</button>',
      '<p dir="rtl">مرحبا · ✓ — 日本語 😀</p>',
      '<div class="p-4">x</div>\n'.repeat(2000),
      "",
    ]) {
      const code = await encode(html);
      expect(code).toMatch(/^[A-Za-z0-9_-]*$/);
      expect(await decode(code)).toBe(html);
    }
  });

  it("compresses repetitive markup", async () => {
    const html = '<div class="nb-card"><div class="nb-card__body">x</div></div>\n'.repeat(100);
    expect((await encode(html)).length).toBeLessThan(html.length / 10);
  });

  it("rejects codes that are not valid", async () => {
    await expect(decode("not-a-valid-code")).rejects.toThrow();
  });

  it("reads the code from a URL hash", () => {
    expect(codeFromHash("#code=abc_-1")).toBe("abc_-1");
    expect(codeFromHash("")).toBeUndefined();
  });
});
