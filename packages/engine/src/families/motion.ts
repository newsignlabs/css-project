import type { Family, Resolved } from "../types.ts";
import { keywords, scaleFamily, staticFamily } from "./helpers.ts";

const timing = "var(--nb-ease, var(--nb-motion-easing-standard))";
const duration = "var(--nb-duration, var(--nb-motion-duration-base))";
const transition = (property: string): [string, string][] => [
  ["transition-property", property],
  ["transition-timing-function", timing],
  ["transition-duration", duration],
];
const ms = Object.fromEntries(
  ["0", "75", "100", "150", "200", "300", "500", "700", "1000"].map((n) => [n, `${n}ms`]),
);

const KEYFRAMES: Record<string, string> = {
  "nb-spin": "to { rotate: 1turn; }",
  "nb-ping": "75%, 100% { scale: 2; opacity: 0; }",
  "nb-pulse": "50% { opacity: 0.5; }",
  "nb-bounce":
    "0%, 100% { translate: 0 -25%; animation-timing-function: cubic-bezier(0.8, 0, 1, 1); } 50% { translate: 0 0; animation-timing-function: cubic-bezier(0, 0, 0.2, 1); }",
  "nb-fade-in": "from { opacity: 0; }",
};
const animate = (name: string, value: string): Resolved => ({
  decls: [["animation", value]],
  keyframes: { [name]: KEYFRAMES[name] as string },
});

// T051 — motion, transforms, interactivity and accessibility.
export const motion: Family[] = [
  staticFamily("transition", "motion", "Transition presets using motion tokens", {
    transition: transition(
      "color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, translate, scale, rotate, filter, backdrop-filter",
    ),
    "transition-all": transition("all"),
    "transition-colors": transition(
      "color, background-color, border-color, text-decoration-color, fill, stroke",
    ),
    "transition-opacity": transition("opacity"),
    "transition-shadow": transition("box-shadow"),
    "transition-transform": transition("translate, scale, rotate"),
    "transition-none": [["transition-property", "none"]],
  }),
  scaleFamily({
    name: "transition-duration",
    category: "motion",
    description: "Duration tokens (fast, base, slow…) or milliseconds",
    roots: ["duration"],
    properties: ["--nb-duration", "transition-duration"],
    scale: (t) => t.duration,
    tokenGroup: "motion.duration",
    extra: ms,
    arbitrary: "time",
  }),
  scaleFamily({
    name: "transition-timing",
    category: "motion",
    description: "Easing tokens",
    roots: ["ease"],
    properties: ["--nb-ease", "transition-timing-function"],
    scale: (t) => t.easing,
    tokenGroup: "motion.easing",
    extra: {
      linear: "linear",
      in: "cubic-bezier(0.4, 0, 1, 1)",
      out: "cubic-bezier(0, 0, 0.2, 1)",
      "in-out": "cubic-bezier(0.4, 0, 0.2, 1)",
    },
    arbitrary: "ident",
  }),
  scaleFamily({
    name: "transition-delay",
    category: "motion",
    description: "Transition delay",
    roots: ["delay"],
    properties: ["transition-delay"],
    extra: ms,
    arbitrary: "time",
  }),
  staticFamily(
    "animation",
    "motion",
    "Animation presets (reduced motion is honoured by the reset)",
    {
      "animate-none": [["animation", "none"]],
      "animate-spin": animate("nb-spin", "nb-spin 1s linear infinite"),
      "animate-ping": animate("nb-ping", "nb-ping 1s cubic-bezier(0, 0, 0.2, 1) infinite"),
      "animate-pulse": animate("nb-pulse", "nb-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"),
      "animate-bounce": animate("nb-bounce", "nb-bounce 1s infinite"),
      "animate-fade-in": animate("nb-fade-in", `nb-fade-in ${duration} ${timing} both`),
    },
  ),
  scaleFamily({
    name: "view-transition-name",
    category: "motion",
    description: "View transition name",
    roots: ["vt"],
    properties: ["view-transition-name"],
    extra: { none: "none" },
    arbitrary: "ident",
  }),
  scaleFamily({
    name: "translate-x",
    category: "motion",
    description: "Translate on the x axis",
    roots: ["translate-x"],
    properties: ["translate"],
    scale: (t) => t.space,
    tokenGroup: "space",
    extra: { full: "100%", px: "1px" },
    negative: true,
    fractions: true,
    build: (v) => [
      ["--nb-translate-x", v],
      ["translate", "var(--nb-translate-x, 0) var(--nb-translate-y, 0)"],
    ],
  }),
  scaleFamily({
    name: "translate-y",
    category: "motion",
    description: "Translate on the y axis",
    roots: ["translate-y"],
    properties: ["translate"],
    scale: (t) => t.space,
    tokenGroup: "space",
    extra: { full: "100%", px: "1px" },
    negative: true,
    fractions: true,
    build: (v) => [
      ["--nb-translate-y", v],
      ["translate", "var(--nb-translate-x, 0) var(--nb-translate-y, 0)"],
    ],
  }),
  scaleFamily({
    name: "scale",
    category: "motion",
    description: "Scale",
    roots: ["scale"],
    properties: ["scale"],
    extra: Object.fromEntries(
      ["0", "50", "75", "90", "95", "100", "105", "110", "125", "150"].map((n) => [
        n,
        String(Number(n) / 100),
      ]),
    ),
    arbitrary: "number",
    negative: true,
  }),
  scaleFamily({
    name: "rotate",
    category: "motion",
    description: "Rotate (degrees)",
    roots: ["rotate"],
    properties: ["rotate"],
    extra: Object.fromEntries(
      ["0", "1", "2", "3", "6", "12", "45", "90", "180"].map((n) => [n, `${n}deg`]),
    ),
    arbitrary: "length",
    negative: true,
  }),
  staticFamily(
    "interactivity",
    "interactivity",
    "Cursor, selection, pointer events, scrolling and touch",
    {
      ...keywords("cursor", "cursor", {
        auto: "auto",
        default: "default",
        pointer: "pointer",
        wait: "wait",
        text: "text",
        move: "move",
        help: "help",
        progress: "progress",
        "not-allowed": "not-allowed",
        grab: "grab",
        grabbing: "grabbing",
        none: "none",
      }),
      ...keywords("select", "user-select", {
        none: "none",
        text: "text",
        all: "all",
        auto: "auto",
      }),
      ...keywords("pointer-events", "pointer-events", { none: "none", auto: "auto" }),
      ...keywords("scroll", "scroll-behavior", { smooth: "smooth", auto: "auto" }),
      ...keywords("snap", "scroll-snap-type", {
        none: "none",
        x: "x var(--nb-snap-strictness, proximity)",
        y: "y var(--nb-snap-strictness, proximity)",
        both: "both var(--nb-snap-strictness, proximity)",
      }),
      ...keywords("snap", "--nb-snap-strictness", {
        mandatory: "mandatory",
        proximity: "proximity",
      }),
      ...keywords("snap", "scroll-snap-align", {
        start: "start",
        end: "end",
        center: "center",
        "align-none": "none",
      }),
      ...keywords("touch", "touch-action", {
        auto: "auto",
        none: "none",
        "pan-x": "pan-x",
        "pan-y": "pan-y",
        manipulation: "manipulation",
      }),
      ...keywords("resize", "resize", { none: "none", x: "horizontal", y: "vertical" }),
      resize: [["resize", "both"]],
      "appearance-none": [["appearance", "none"]],
      ...keywords("will-change", "will-change", {
        auto: "auto",
        scroll: "scroll-position",
        contents: "contents",
        transform: "transform",
      }),
    },
  ),
  staticFamily("a11y", "a11y", "Screen-reader-only content and forced-colors behaviour", {
    "sr-only": [
      ["position", "absolute"],
      ["inline-size", "1px"],
      ["block-size", "1px"],
      ["padding", "0"],
      ["margin", "-1px"],
      ["overflow", "hidden"],
      ["clip-path", "inset(50%)"],
      ["white-space", "nowrap"],
      ["border-width", "0"],
    ],
    "not-sr-only": [
      ["position", "static"],
      ["inline-size", "auto"],
      ["block-size", "auto"],
      ["padding", "0"],
      ["margin", "0"],
      ["overflow", "visible"],
      ["clip-path", "none"],
      ["white-space", "normal"],
    ],
    ...keywords("forced-color-adjust", "forced-color-adjust", { auto: "auto", none: "none" }),
  }),
];
