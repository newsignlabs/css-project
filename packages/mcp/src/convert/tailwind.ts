// Tailwind CSS → newBrush (specs/003 T030). newBrush utilities share most of Tailwind's syntax and scale, so a class
// the engine accepts is kept as is; colour names move to newBrush palettes (blue → brand, gray → neutral…), a few
// renames cover the rest, and buttons and text inputs built from utilities become nb-btn and nb-input.
import { type ConvertContext, type ElementResult, splitVariants, type Unmapped } from "./types.ts";

/** Tailwind colour → newBrush palette. Steps (50–950) are the same. */
export const PALETTE: Record<string, string> = {
  blue: "brand",
  indigo: "brand",
  sky: "brand",
  violet: "accent",
  purple: "accent",
  fuchsia: "accent",
  pink: "accent",
  gray: "neutral",
  slate: "neutral",
  zinc: "neutral",
  neutral: "neutral",
  stone: "neutral",
  red: "danger",
  rose: "danger",
  green: "success",
  emerald: "success",
  lime: "success",
  teal: "success",
  amber: "warning",
  yellow: "warning",
  orange: "warning",
  cyan: "info",
};
const COLOUR = new RegExp(
  `^(-?[a-z-]*?-)(${Object.keys(PALETTE).join("|")})-(50|[1-9]00|950)(/\\d+)?$`,
);

/** Container widths newBrush has no named step for, as the same lengths. */
const RENAME: Record<string, string[]> = {
  "text-left": ["text-start"],
  "text-right": ["text-end"],
  "max-w-xs": ["max-w-[20rem]"],
  "max-w-3xl": ["max-w-[48rem]"],
  "max-w-4xl": ["max-w-[56rem]"],
  "max-w-5xl": ["max-w-[64rem]"],
  "max-w-6xl": ["max-w-[72rem]"],
  "max-w-7xl": ["max-w-[80rem]"],
  "max-w-screen-sm": ["max-w-[40rem]"],
  "max-w-screen-md": ["max-w-[48rem]"],
  "max-w-screen-lg": ["max-w-[64rem]"],
  "max-w-screen-xl": ["max-w-[80rem]"],
  "max-w-screen-2xl": ["max-w-[96rem]"],
  "font-normal": ["font-regular"],
  "leading-loose": ["leading-relaxed"],
  "font-thin": ["font-regular"],
  "font-extralight": ["font-regular"],
  "font-light": ["font-regular"],
  "font-extrabold": ["font-bold"],
  "font-black": ["font-bold"],
  container: ["nb-container"],
};
const LEADING: Record<number, string> = {
  3: "leading-none",
  4: "leading-tight",
  5: "leading-snug",
  6: "leading-normal",
  7: "leading-relaxed",
  8: "leading-relaxed",
  9: "leading-relaxed",
  10: "leading-relaxed",
};

/** Physical sides → logical ones (newBrush is direction-aware). */
const LOGICAL: [RegExp, string][] = [
  [/^(-?)pl-/, "$1ps-"],
  [/^(-?)pr-/, "$1pe-"],
  [/^(-?)ml-/, "$1ms-"],
  [/^(-?)mr-/, "$1me-"],
  [/^rounded-l(-|$)/, "rounded-s$1"],
  [/^rounded-r(-|$)/, "rounded-e$1"],
  [/^border-l(-|$)/, "border-s$1"],
  [/^border-r(-|$)/, "border-e$1"],
  [/^left-/, "start-"],
  [/^right-/, "end-"],
];

/** newBrush candidates for one Tailwind class, best first. */
function candidates(cls: string): string[] {
  const important = cls.endsWith("!") ? "!" : "";
  const { prefix, base: raw } = splitVariants(important ? cls.slice(0, -1) : cls);
  const lead = raw.startsWith("!") ? "!" : "";
  const base = lead ? raw.slice(1) : raw;
  const bases = [base];
  const colour = COLOUR.exec(base);
  if (colour) bases.push(`${colour[1]}${PALETTE[colour[2] ?? ""]}-${colour[3]}${colour[4] ?? ""}`);
  bases.push(...(RENAME[base] ?? []));
  for (const [from, to] of LOGICAL) if (from.test(base)) bases.push(base.replace(from, to));
  // Fixed line heights (leading-7 = 1.75rem) → the nearest named, unitless one.
  const leading = /^leading-(\d+)$/.exec(base)?.[1];
  if (leading) bases.push(LEADING[Math.min(10, Math.max(3, Number(leading)))] ?? "leading-normal");
  // newBrush marks !important with a trailing "!" (Tailwind also allows a leading one).
  const bang = important || lead;
  return [...new Set(bases)].map((b) => `${prefix}${b}${bang}`);
}

const TEXT_INPUTS = new Set([
  "text",
  "email",
  "password",
  "search",
  "tel",
  "url",
  "number",
  "date",
  "time",
]);
const BUTTON_UTILITY =
  /^(bg-|text-(white|black|[a-z]+-\d{2,3})$|px-|py-|p-|rounded|font-|shadow|transition|duration-|ease-|inline-flex$|inline-block$|items-center$|justify-center$|gap-|text-(xs|sm|base)$|border|ring|outline|cursor-|select-none$)/;
const INPUT_UTILITY =
  /^(border|rounded|px-|py-|p-|shadow|ring|outline|bg-white$|text-(xs|sm|base)$|placeholder|transition|duration-)/;

/**
 * A button or link styled as one from utilities (a background or border, padding and rounding) becomes nb-btn, with
 * --primary for a brand or accent background and --danger for a red one; the utilities that drew it are dropped.
 */
function asComponent(
  ctx: ConvertContext,
): { add: string[]; absorbs: (c: string) => boolean } | undefined {
  const bases = ctx.classes.map((c) => ({ c, ...splitVariants(c) }));
  const has = (re: RegExp) => bases.some((b) => !b.prefix && re.test(b.base));
  const isButton =
    ctx.tag === "button" ||
    (ctx.tag === "a" && ctx.attrs.href !== undefined) ||
    (ctx.tag === "input" && ["submit", "button", "reset"].includes(ctx.attrs.type ?? ""));
  if (isButton && has(/^(px-|py-|p-)/) && has(/^rounded/) && (has(/^bg-/) || has(/^border/))) {
    const bg = bases.find((b) => !b.prefix && /^bg-/.test(b.base))?.base ?? "";
    const tone = COLOUR.exec(bg)?.[2];
    const palette = tone ? PALETTE[tone] : undefined;
    const modifier =
      palette === "brand" || palette === "accent" || bg === "bg-black"
        ? ["nb-btn--primary"]
        : palette === "danger"
          ? ["nb-btn--danger"]
          : [];
    return {
      add: ["nb-btn", ...modifier],
      absorbs: (c) => {
        const { base } = splitVariants(c);
        return BUTTON_UTILITY.test(base);
      },
    };
  }
  const textInput =
    (ctx.tag === "input" && TEXT_INPUTS.has(ctx.attrs.type ?? "text")) || ctx.tag === "textarea";
  if (textInput && has(/^border/) && has(/^rounded/))
    return {
      add: ["nb-input"],
      absorbs: (c) => INPUT_UTILITY.test(splitVariants(c).base),
    };
  return undefined;
}

export function convertTailwind(
  ctx: ConvertContext,
  known: (cls: string) => boolean,
): ElementResult {
  const out: string[] = [];
  const unmapped: Unmapped[] = [];
  const component = asComponent(ctx);
  if (component) out.push(...component.add);
  for (const cls of ctx.classes) {
    if (component?.absorbs(cls)) continue;
    const hit = candidates(cls).find(known);
    if (hit) out.push(hit);
    else
      unmapped.push({
        class: cls,
        reason: /^(from|via|to)-|^bg-gradient/.test(splitVariants(cls).base)
          ? "gradients have no newBrush utility; use a design style (g-morph, neon) or custom CSS"
          : /^(float|clear)-/.test(splitVariants(cls).base)
            ? "floats have no newBrush utility; use flex or grid"
            : "no newBrush equivalent",
      });
  }
  return { classes: [...new Set(out)], unmapped };
}
