import { createEngine } from "../src/index.ts";

export const engine = createEngine({ content: ["**/*"], themeVariants: "selector" });

/** Generated CSS for the given classes, with whitespace collapsed for robust comparison. */
export function cssFor(classes: string[], e = engine): string {
  return normalize(e.generate(classes).css);
}

export function normalize(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([{};:,>])\s*/g, "$1")
    .replace(/;}/g, "}")
    .trim();
}
