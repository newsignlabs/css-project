// Bootstrap → newBrush (specs/003 T030). Components map to newBrush components and their parts and modifiers;
// utilities map to newBrush utilities on newBrush's scale (Bootstrap's spacing 1–5 is 0.25–3rem, newBrush's steps are
// 0.25rem each); the 12-column grid becomes CSS grid. Classes that need Bootstrap's JavaScript are reported.
import type { ConvertContext, ElementInfo, ElementResult, Unmapped } from "./types.ts";

const BREAKPOINT: Record<string, string> = { sm: "sm", md: "md", lg: "lg", xl: "xl", xxl: "2xl" };
const BP = "(?:(sm|md|lg|xl|xxl)-)?";
const bp = (b: string | undefined) => (b ? `${BREAKPOINT[b]}:` : "");
/** Bootstrap spacers 0–5 (0, .25, .5, 1, 1.5, 3rem) → newBrush spacing steps. */
const SPACE: Record<string, string> = {
  "0": "0",
  "1": "1",
  "2": "2",
  "3": "4",
  "4": "6",
  "5": "12",
};
const SIDE: Record<string, string> = { t: "t", b: "b", s: "s", e: "e", x: "x", y: "y" };

/** Theme colours → newBrush colour steps (text and backgrounds). */
const THEME: Record<string, string> = {
  primary: "brand-600",
  secondary: "neutral-600",
  success: "success-600",
  danger: "danger-600",
  warning: "warning-500",
  info: "info-500",
  light: "neutral-100",
  dark: "neutral-900",
};
export const SEMANTIC: Record<string, string[]> = {
  "bg-light": ["bg-surface-subtle"],
  "bg-white": ["bg-surface"],
  "bg-body": ["bg-surface"],
  "bg-body-tertiary": ["bg-surface-subtle"],
  "bg-body-secondary": ["bg-surface-subtle"],
  "bg-dark": ["bg-surface-inverse"],
  "bg-transparent": ["bg-transparent"],
  "text-dark": ["text-default"],
  "text-body": ["text-default"],
  "text-black": ["text-default"],
  "text-light": ["text-inverse"],
  "text-white": ["text-white"],
  "text-secondary": ["text-muted"],
  "text-body-secondary": ["text-muted"],
  "text-muted": ["text-muted"],
  "text-primary": ["text-link"],
};

const JS_STATE =
  "a Bootstrap JavaScript or state class: use the disabled attribute, aria-current or aria-expanded";
const NO_COMPONENT = (what: string) =>
  `no newBrush ${what}; build it from components and utilities (see search)`;

/** Plain renames: Bootstrap class → newBrush classes ("" drops it as mapped). */
export const TABLE: Record<string, string[] | string> = {
  // Layout
  container: ["nb-container"],
  "container-fluid": ["nb-container", "nb-container--full"],
  "container-sm": ["nb-container"],
  "container-md": ["nb-container"],
  "container-lg": ["nb-container"],
  "container-xl": ["nb-container"],
  "container-xxl": ["nb-container", "nb-container--wide"],
  // Typography
  small: ["text-sm"],
  lead: ["text-lg"],
  h1: ["text-4xl", "font-bold"],
  h2: ["text-3xl", "font-bold"],
  h3: ["text-2xl", "font-semibold"],
  h4: ["text-xl", "font-semibold"],
  h5: ["text-lg", "font-semibold"],
  h6: ["text-base", "font-semibold"],
  "display-1": ["text-6xl", "font-bold"],
  "display-2": ["text-6xl", "font-bold"],
  "display-3": ["text-5xl", "font-bold"],
  "display-4": ["text-5xl", "font-bold"],
  "display-5": ["text-4xl", "font-bold"],
  "display-6": ["text-3xl", "font-bold"],
  "fs-1": ["text-4xl"],
  "fs-2": ["text-3xl"],
  "fs-3": ["text-2xl"],
  "fs-4": ["text-xl"],
  "fs-5": ["text-lg"],
  "fs-6": ["text-base"],
  "fw-bold": ["font-bold"],
  "fw-bolder": ["font-bold"],
  "fw-semibold": ["font-semibold"],
  "fw-medium": ["font-medium"],
  "fw-normal": ["font-regular"],
  "fw-light": ["font-regular"],
  "fw-lighter": ["font-regular"],
  "fst-italic": ["italic"],
  "fst-normal": ["not-italic"],
  "font-monospace": ["font-mono"],
  "lh-1": ["leading-none"],
  "lh-sm": ["leading-snug"],
  "lh-base": ["leading-normal"],
  "lh-lg": ["leading-relaxed"],
  "text-uppercase": ["uppercase"],
  "text-lowercase": ["lowercase"],
  "text-capitalize": ["capitalize"],
  "text-truncate": ["truncate"],
  "text-nowrap": ["whitespace-nowrap"],
  "text-wrap": ["whitespace-normal"],
  "text-break": ["break-words"],
  "text-decoration-none": ["no-underline"],
  "text-decoration-underline": ["underline"],
  "text-decoration-line-through": ["line-through"],
  "list-unstyled": ["list-none", "ps-0"],
  "list-inline": ["flex", "flex-wrap", "gap-2", "list-none", "ps-0"],
  "list-inline-item": "",
  "visually-hidden": ["sr-only"],
  "visually-hidden-focusable": ["sr-only", "focus:not-sr-only"],
  "img-fluid": ["max-w-full", "h-auto"],
  "img-thumbnail": ["max-w-full", "h-auto", "rounded-md", "border", "p-1"],
  "ratio-1x1": ["aspect-square"],
  "ratio-16x9": ["aspect-video"],
  ratio: "",
  "user-select-none": ["select-none"],
  "pe-none": ["pointer-events-none"],
  "pe-auto": ["pointer-events-auto"],
  "translate-middle": ["-translate-x-1/2", "-translate-y-1/2"],
  // Borders, rounding, sizing
  "border-top": ["border-t"],
  "border-bottom": ["border-b"],
  "border-start": ["border-s"],
  "border-end": ["border-e"],
  "border-1": ["border"],
  "border-2": ["border-2"],
  "border-3": ["border-[3px]"],
  "border-4": ["border-4"],
  "border-5": ["border-[5px]"],
  "rounded-0": ["rounded-none"],
  "rounded-1": ["rounded-sm"],
  "rounded-2": ["rounded-md"],
  "rounded-3": ["rounded-lg"],
  "rounded-4": ["rounded-xl"],
  "rounded-5": ["rounded-2xl"],
  "rounded-circle": ["rounded-full"],
  "rounded-pill": ["rounded-full"],
  "rounded-top": ["rounded-t-md"],
  "rounded-bottom": ["rounded-b-md"],
  "rounded-start": ["rounded-s-md"],
  "rounded-end": ["rounded-e-md"],
  "mw-100": ["max-w-full"],
  "mh-100": ["max-h-full"],
  "vw-100": ["w-screen"],
  "vh-100": ["h-screen"],
  "min-vw-100": ["min-w-[100vw]"],
  "min-vh-100": ["min-h-screen"],
  "position-static": ["static"],
  "position-relative": ["relative"],
  "position-absolute": ["absolute"],
  "position-fixed": ["fixed"],
  "position-sticky": ["sticky"],
  "fixed-top": ["fixed", "top-0", "inset-x-0", "z-30"],
  "fixed-bottom": ["fixed", "bottom-0", "inset-x-0", "z-30"],
  "sticky-top": ["sticky", "top-0", "z-20"],
  // Components
  btn: ["nb-btn"],
  "btn-primary": ["nb-btn--primary"],
  "btn-danger": ["nb-btn--danger"],
  "btn-link": ["nb-btn--link"],
  "btn-sm": ["nb-btn--sm"],
  "btn-lg": ["nb-btn--lg"],
  "btn-block": ["nb-btn--block"],
  "btn-secondary": "",
  "btn-light": "",
  "btn-outline-primary": "",
  "btn-outline-secondary": "",
  "btn-outline-dark": "",
  "btn-outline-light": ["nb-btn--ghost"],
  "btn-outline-danger": ["nb-btn--danger"],
  "btn-group": ["nb-btn-group"],
  "btn-toolbar": ["nb-cluster"],
  card: ["nb-card"],
  "card-body": ["nb-card__body"],
  "card-header": ["nb-card__header"],
  "card-footer": ["nb-card__footer"],
  "card-title": ["nb-card__title"],
  "card-subtitle": ["nb-card__subtitle"],
  "card-link": ["nb-card__link"],
  "card-img-top": ["nb-card__media"],
  "card-img": ["nb-card__media"],
  "card-text": "",
  alert: ["nb-alert"],
  "alert-success": ["nb-alert--success"],
  "alert-warning": ["nb-alert--warning"],
  "alert-danger": ["nb-alert--danger"],
  "alert-info": "",
  "alert-primary": "",
  "alert-secondary": "",
  "alert-light": "",
  "alert-dark": "",
  "alert-heading": ["nb-alert__title"],
  "alert-link": "",
  "alert-dismissible": "",
  badge: ["nb-badge"],
  "form-control": ["nb-input"],
  "form-control-sm": ["nb-input--sm"],
  "form-control-lg": ["nb-input--lg"],
  "form-label": ["nb-field__label"],
  "form-text": ["nb-field__hint"],
  "invalid-feedback": ["nb-field__error"],
  "form-check": ["nb-check"],
  "form-check-input": "",
  "form-check-label": "",
  "form-check-inline": ["inline-flex"],
  "input-group": ["flex"],
  table: ["nb-table"],
  "table-striped": ["nb-table--striped"],
  "table-hover": ["nb-table--hover"],
  "table-sm": ["nb-table--compact"],
  "table-responsive": ["nb-table-wrap"],
  navbar: ["nb-navbar"],
  "navbar-brand": ["nb-navbar__brand"],
  "navbar-nav": ["nb-navbar__links"],
  "navbar-text": "",
  "nav-item": "",
  "navbar-light": "",
  "navbar-dark": "",
  "navbar-expand": "",
  "navbar-expand-sm": "",
  "navbar-expand-md": "",
  "navbar-expand-lg": "",
  "navbar-expand-xl": "",
  "navbar-expand-xxl": "",
};

/** Classes reported rather than converted, with the reason. */
const REPORT: Record<string, string> = {
  fade: JS_STATE,
  show: JS_STATE,
  active: JS_STATE,
  disabled: JS_STATE,
  collapse: JS_STATE,
  collapsing: JS_STATE,
  "navbar-collapse": JS_STATE,
  "navbar-toggler": JS_STATE,
  "navbar-toggler-icon": JS_STATE,
  "form-select": 'nb-select wraps the control: <span class="nb-select"><select>…</select></span>',
  "form-switch":
    'use <label class="nb-switch-label"><input type="checkbox" role="switch" class="nb-switch"> …</label>',
  "nav-tabs": "tabs need the nb-tabs structure (get_component tabs)",
  "nav-pills": "tabs need the nb-tabs structure (get_component tabs)",
  "tab-content": "tabs need the nb-tabs structure (get_component tabs)",
  "tab-pane": "tabs need the nb-tabs structure (get_component tabs)",
  modal: "nb-modal is a <dialog> (get_component modal)",
  "modal-dialog": "nb-modal is a <dialog> (get_component modal)",
  "modal-content": "nb-modal is a <dialog> (get_component modal)",
  "modal-header": "nb-modal is a <dialog> (get_component modal)",
  "modal-body": "nb-modal is a <dialog> (get_component modal)",
  "modal-footer": "nb-modal is a <dialog> (get_component modal)",
  "modal-title": "nb-modal is a <dialog> (get_component modal)",
  accordion: "nb-accordion is built on <details> (get_component accordion)",
  "accordion-item": "nb-accordion is built on <details> (get_component accordion)",
  "accordion-header": "nb-accordion is built on <details> (get_component accordion)",
  "accordion-button": "nb-accordion is built on <details> (get_component accordion)",
  "accordion-collapse": "nb-accordion is built on <details> (get_component accordion)",
  "accordion-body": "nb-accordion is built on <details> (get_component accordion)",
  dropdown: NO_COMPONENT("dropdown"),
  "dropdown-menu": NO_COMPONENT("dropdown"),
  "dropdown-item": NO_COMPONENT("dropdown"),
  "dropdown-toggle": NO_COMPONENT("dropdown"),
  "list-group": NO_COMPONENT("list group"),
  "list-group-item": NO_COMPONENT("list group"),
  breadcrumb: NO_COMPONENT("breadcrumb"),
  "breadcrumb-item": NO_COMPONENT("breadcrumb"),
  pagination: NO_COMPONENT("pagination"),
  "page-item": NO_COMPONENT("pagination"),
  "page-link": NO_COMPONENT("pagination"),
  progress: NO_COMPONENT("progress bar; use <progress>"),
  "progress-bar": NO_COMPONENT("progress bar; use <progress>"),
  "spinner-border": NO_COMPONENT("spinner"),
  "spinner-grow": NO_COMPONENT("spinner"),
  "float-start": "floats have no newBrush utility; use flex or grid",
  "float-end": "floats have no newBrush utility; use flex or grid",
  "float-none": "floats have no newBrush utility; use flex or grid",
  clearfix: "floats have no newBrush utility; use flex or grid",
  "table-bordered": "no bordered table modifier",
  "table-dark": 'no dark table modifier; use data-nb-theme="dark" on the table',
};

const SIZE: Record<string, string> = {
  "25": "1/4",
  "50": "1/2",
  "75": "3/4",
  "100": "full",
  auto: "auto",
};
const POSITION: Record<string, string> = { "0": "0", "50": "1/2", "100": "full" };
const DISPLAY: Record<string, string> = { none: "hidden" };
const FLEX: Record<string, string> = {
  row: "flex-row",
  column: "flex-col",
  "row-reverse": "flex-row-reverse",
  "column-reverse": "flex-col-reverse",
  wrap: "flex-wrap",
  nowrap: "flex-nowrap",
  "wrap-reverse": "flex-wrap-reverse",
  fill: "flex-1",
  "grow-1": "grow",
  "grow-0": "grow-0",
  "shrink-1": "shrink",
  "shrink-0": "shrink-0",
};
const Z: Record<string, string> = {
  "0": "z-0",
  "1": "z-10",
  "2": "z-20",
  "3": "z-30",
  n1: "-z-10",
};
const has = (el: ElementInfo | undefined, cls: string) => Boolean(el?.classes.includes(cls));

/** Converts one utility by pattern; undefined when no pattern applies. */
export function pattern(cls: string): string[] | undefined {
  let m = new RegExp(`^(m|p)([tbsexy])?-${BP}(n?[0-5]|auto)$`).exec(cls);
  if (m) {
    const [, kind, side, b, value = ""] = m;
    const neg = value.startsWith("n");
    const v = value === "auto" ? "auto" : SPACE[neg ? value.slice(1) : value];
    return [`${bp(b)}${neg ? "-" : ""}${kind}${side ? SIDE[side] : ""}-${v}`];
  }
  m = new RegExp(`^(g|gx|gy)-${BP}([0-5])$`).exec(cls);
  if (m) {
    const [, kind, b, value = ""] = m;
    return [`${bp(b)}${kind === "g" ? "gap" : kind === "gx" ? "gap-x" : "gap-y"}-${SPACE[value]}`];
  }
  m = new RegExp(`^gap-${BP}([0-5])$`).exec(cls);
  if (m) return [`${bp(m[1])}gap-${SPACE[m[2] ?? ""]}`];
  m = new RegExp(
    `^d-${BP}(none|inline|inline-block|block|grid|inline-grid|table|flex|inline-flex)$`,
  ).exec(cls);
  if (m) return [`${bp(m[1])}${DISPLAY[m[2] ?? ""] ?? m[2]}`];
  m = new RegExp(`^flex-${BP}(${Object.keys(FLEX).join("|")})$`).exec(cls);
  if (m) return [`${bp(m[1])}${FLEX[m[2] ?? ""]}`];
  m = new RegExp(`^justify-content-${BP}(start|end|center|between|around|evenly)$`).exec(cls);
  if (m) return [`${bp(m[1])}justify-${m[2]}`];
  m = new RegExp(`^align-items-${BP}(start|end|center|baseline|stretch)$`).exec(cls);
  if (m) return [`${bp(m[1])}items-${m[2]}`];
  m = new RegExp(`^align-self-${BP}(auto|start|end|center|baseline|stretch)$`).exec(cls);
  if (m) return [`${bp(m[1])}self-${m[2]}`];
  m = new RegExp(`^align-content-${BP}(start|end|center|between|around|stretch)$`).exec(cls);
  if (m) return [`${bp(m[1])}content-${m[2]}`];
  m = new RegExp(`^text-${BP}(start|end|center)$`).exec(cls);
  if (m) return [`${bp(m[1])}text-${m[2]}`];
  m = new RegExp(`^order-${BP}([0-5]|first|last)$`).exec(cls);
  if (m) return [`${bp(m[1])}order-${m[2]}`];
  m = new RegExp(`^offset-${BP}([0-9]|1[01])$`).exec(cls);
  if (m) return [`${bp(m[1])}col-start-${Number(m[2]) + 1}`];
  m = new RegExp(`^row-cols-${BP}([1-6]|auto)$`).exec(cls);
  if (m) return [`${bp(m[1])}grid-cols-${m[2] === "auto" ? "none" : m[2]}`];
  m = /^(w|h)-(25|50|75|100|auto)$/.exec(cls);
  if (m) return [`${m[1]}-${SIZE[m[2] ?? ""]}`];
  m = /^(top|bottom|start|end)-(0|50|100)$/.exec(cls);
  if (m) return [`${m[1]}-${POSITION[m[2] ?? ""]}`];
  m = /^z-(0|1|2|3|n1)$/.exec(cls);
  if (m) return [Z[m[1] ?? ""] ?? ""];
  m = /^opacity-(0|25|50|75|100)$/.exec(cls);
  if (m) return [cls];
  m =
    /^(text|bg|border|text-bg)-(primary|secondary|success|danger|warning|info|light|dark)(?:-subtle)?$/.exec(
      cls,
    );
  if (m) {
    const [, kind, tone = ""] = m;
    const step = THEME[tone] ?? "";
    if (kind === "text-bg")
      return [
        `bg-${step}`,
        ["warning", "info", "light"].includes(tone) ? "text-default" : "text-white",
      ];
    return [`${kind}-${step}`];
  }
  return undefined;
}

const TONE_MODIFIER: Record<string, Record<string, string>> = {
  "nb-badge": {
    primary: "nb-badge--solid",
    success: "nb-badge--success",
    warning: "nb-badge--warning",
    danger: "nb-badge--danger",
    info: "nb-badge--info",
  },
};

export function convertBootstrap(ctx: ConvertContext): ElementResult {
  const out: string[] = [];
  const unmapped: Unmapped[] = [];
  const parent: string[] = [];
  const near = (cls: string) => [...ctx.ancestors].reverse().find((a) => a.classes.includes(cls));
  const parentEl = ctx.ancestors[ctx.ancestors.length - 1];
  const inAlert = Boolean(near("alert"));
  const isBadge = ctx.classes.includes("badge");
  const isRow = ctx.classes.includes("row");
  const autoCols = ctx.children.some((c) =>
    c.classes.some((k) => /^col(-(sm|md|lg|xl|xxl))?$/.test(k)),
  );

  for (const cls of ctx.classes) {
    // Context first: tones on badges, the grid, nav links, close buttons, labels and hints in a field.
    const tone = /^(?:bg|text-bg)-(primary|secondary|success|danger|warning|info|light|dark)$/.exec(
      cls,
    )?.[1];
    if (isBadge && tone) {
      const mod = TONE_MODIFIER["nb-badge"]?.[tone];
      if (mod) out.push(mod);
      continue;
    }
    if (isRow && cls === "row") {
      out.push(
        ...(autoCols
          ? ["grid", "gap-6", "md:grid-flow-col", "md:auto-cols-fr"]
          : ["grid", "grid-cols-12", "gap-6"]),
      );
      continue;
    }
    const col = /^col(?:-(sm|md|lg|xl|xxl))?(?:-([1-9]|1[0-2]|auto))?$/.exec(cls);
    if (col) {
      const [, b, span] = col;
      if (!span) {
        // Equal-width columns: the row lays them out (grid-flow-col).
      } else if (span === "auto") out.push(`${bp(b)}col-auto`);
      else {
        if (b && !ctx.classes.some((k) => /^col-([1-9]|1[0-2])$/.test(k))) out.push("col-span-12");
        out.push(`${bp(b)}col-span-${span}`);
      }
      continue;
    }
    if (cls === "nav-link") {
      out.push(near("navbar") || near("navbar-nav") ? "nb-navbar__link" : "no-underline");
      continue;
    }
    if (cls === "nav" && !ctx.classes.includes("navbar-nav")) {
      out.push("flex", "flex-wrap", "gap-4", "list-none", "ps-0");
      continue;
    }
    if (cls === "btn-close") {
      out.push(
        ...(inAlert
          ? ["nb-alert__close"]
          : near("modal")
            ? ["nb-modal__close"]
            : ["nb-btn", "nb-btn--ghost", "nb-btn--icon"]),
      );
      continue;
    }
    if (
      (cls === "form-label" || cls === "form-text" || cls === "invalid-feedback") &&
      parentEl &&
      !has(parentEl, "nb-field")
    ) {
      parent.push("nb-field");
    }

    const report = REPORT[cls];
    if (report) {
      unmapped.push({ class: cls, reason: report });
      continue;
    }
    const row = TABLE[cls];
    if (row !== undefined) {
      if (Array.isArray(row)) out.push(...row);
      continue;
    }
    const semantic = SEMANTIC[cls] ?? pattern(cls);
    if (semantic) {
      out.push(...semantic);
      continue;
    }
    // Shared names with the same meaning (text-muted, rounded, shadow, border, overflow-hidden…) pass through; the
    // caller checks each against newBrush.
    out.push(cls);
  }
  if (ctx.classes.includes("btn-close") && !ctx.attrs["aria-label"])
    unmapped.push({ class: "btn-close", reason: 'add aria-label="Close": the button has no text' });
  return { classes: [...new Set(out)], unmapped, ...(parent.length ? { parent } : {}) };
}
