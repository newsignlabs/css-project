import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BUILT_IN_STYLES, getStyle, restoreStyle, STORAGE_KEY, setStyle } from "../src/index.ts";

// specs/004 T031 — setStyle()/getStyle(): class swaps, aliases, custom styles, persistence, View Transitions.

beforeEach(() => {
  document.body.className = "page";
  document.body.removeAttribute("data-nb-style");
  document.body.innerHTML = '<section id="s"><p id="p">x</p></section>';
  localStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

describe("setStyle", () => {
  it("knows the six built-in styles", () => {
    expect(BUILT_IN_STYLES.map((s) => s.name).sort()).toEqual([
      "cyber",
      "g-morph",
      "minimal",
      "n-morph",
      "neon",
      "pixelate",
    ]);
  });

  it("swaps the style class on <body>, keeping other classes, and accepts aliases", async () => {
    await setStyle("neon");
    expect([...document.body.classList]).toEqual(["page", "neon"]);
    await setStyle("neumorph");
    expect([...document.body.classList]).toEqual(["page", "n-morph"]);
  });

  it("removes nb- forms, aliases and data-nb-style; null removes the style, default sets the reset", async () => {
    document.body.classList.add("nb-cyber", "pixel");
    document.body.setAttribute("data-nb-style", "minimal");
    await setStyle(null);
    expect([...document.body.classList]).toEqual(["page"]);
    expect(document.body.hasAttribute("data-nb-style")).toBe(false);
    const section = document.getElementById("s") as Element;
    await setStyle("default", { target: section });
    expect(section.className).toBe("style-default");
  });

  it("supports custom styles and prefix.styles; rejects unknown names", async () => {
    await setStyle("brand", { styles: [{ name: "brand", aliases: ["acme"] }] });
    expect(document.body.classList.contains("brand")).toBe(true);
    await setStyle("acme", { styles: [{ name: "brand", aliases: ["acme"] }] });
    expect([...document.body.classList]).toEqual(["page", "brand"]);
    // With prefix.styles, bare classes are the prefixed ones (the nb- form is always a style class).
    document.body.className = "page nb-cyber";
    await setStyle("neon", { prefix: "s-" });
    expect([...document.body.classList]).toEqual(["page", "s-neon"]);
    await expect(setStyle("vaporwave")).rejects.toThrow(/Unknown newBrush style "vaporwave"/);
  });

  it("persists the choice and restores it", async () => {
    await setStyle("cyber", { persist: true });
    expect(localStorage.getItem(STORAGE_KEY)).toBe("cyber");
    document.body.className = "page";
    expect(restoreStyle()).toBe("cyber");
    expect(document.body.classList.contains("cyber")).toBe(true);
    await setStyle(null, { persist: true });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(restoreStyle()).toBeNull();
    localStorage.setItem(STORAGE_KEY, "not-a-style");
    expect(restoreStyle()).toBeNull();
  });

  it("uses a View Transition when asked, unless reduced motion is preferred or the API is missing", async () => {
    const start = vi.fn((update: () => void) => {
      update();
      return { updateCallbackDone: Promise.resolve() };
    });
    Object.assign(document, { startViewTransition: start });
    const motion = (reduce: boolean) =>
      vi
        .spyOn(window, "matchMedia")
        .mockImplementation(
          (q) => ({ matches: reduce && q.includes("reduce"), media: q }) as MediaQueryList,
        );
    motion(false);
    await setStyle("neon", { transition: true });
    expect(start).toHaveBeenCalledTimes(1);
    expect(document.body.classList.contains("neon")).toBe(true);
    motion(true);
    await setStyle("minimal", { transition: true });
    expect(start).toHaveBeenCalledTimes(1); // skipped: applied directly
    expect(document.body.classList.contains("minimal")).toBe(true);
    Object.assign(document, { startViewTransition: undefined });
    motion(false);
    await setStyle("cyber", { transition: true });
    expect(document.body.classList.contains("cyber")).toBe(true);
  });
});

describe("getStyle", () => {
  it("finds the nearest style from the markup, the reset, or null", () => {
    const p = document.getElementById("p") as Element;
    expect(getStyle(p)).toBeNull();
    document.body.classList.add("pixel");
    expect(getStyle(p)).toBe("pixelate");
    (document.getElementById("s") as Element).setAttribute("data-nb-style", "neon");
    expect(getStyle(p)).toBe("neon");
    (document.getElementById("s") as Element).removeAttribute("data-nb-style");
    (document.getElementById("s") as Element).className = "style-default";
    expect(getStyle(p)).toBe("default");
  });

  it("prefers the --nb-style marker the stylesheet computes", () => {
    document.body.style.setProperty("--nb-style", "pixelate");
    expect(getStyle()).toBe("pixelate");
  });
});
