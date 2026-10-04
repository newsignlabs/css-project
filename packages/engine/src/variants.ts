import type { ResolvedConfig } from "@newbrush/schema";
import type { Theme } from "./theme.ts";
import type { Decl } from "./types.ts";

/** Accumulated selector/at-rule state while applying a class's variants (left to right). */
export interface RuleState {
  /** Pseudo-classes and attribute selectors appended to the utility's own compound selector. */
  self: string[];
  pseudoElement: string;
  /** Selector templates with `&`, outermost first. */
  wrappers: string[];
  /** At-rule preludes, outermost first, e.g. "@media (width >= 48rem)". */
  atRules: string[];
  extraDecls: Decl[];
}

export interface VariantDef {
  name: string;
  kind: "media" | "container" | "selector" | "at-rule" | "parent-selector";
  /** Representative template for the manifest. */
  template: string;
  /** Sort bit: variants registered later sort later, so responsive overrides come last. */
  order: number;
  apply: (state: RuleState, arg?: string) => RuleState[];
}

const clone = (s: RuleState): RuleState => ({
  self: [...s.self],
  pseudoElement: s.pseudoElement,
  wrappers: [...s.wrappers],
  atRules: [...s.atRules],
  extraDecls: [...s.extraDecls],
});

const HOVER = "@media (hover: hover)";
const STATES: [name: string, selector: string][] = [
  ["first", ":first-child"],
  ["last", ":last-child"],
  ["only", ":only-child"],
  ["odd", ":nth-child(odd)"],
  ["even", ":nth-child(even)"],
  ["first-of-type", ":first-of-type"],
  ["last-of-type", ":last-of-type"],
  ["empty", ":empty"],
  ["visited", ":visited"],
  ["target", ":target"],
  ["open", ":is([open], :popover-open)"],
  ["default", ":default"],
  ["checked", ":checked"],
  ["indeterminate", ":indeterminate"],
  ["placeholder-shown", ":placeholder-shown"],
  ["autofill", ":autofill"],
  ["optional", ":optional"],
  ["required", ":required"],
  ["valid", ":valid"],
  ["invalid", ":invalid"],
  ["user-valid", ":user-valid"],
  ["user-invalid", ":user-invalid"],
  ["in-range", ":in-range"],
  ["out-of-range", ":out-of-range"],
  ["read-only", ":read-only"],
  ["focus-within", ":focus-within"],
  ["hover", ":hover"],
  ["focus", ":focus"],
  ["focus-visible", ":focus-visible"],
  ["active", ":active"],
  ["enabled", ":enabled"],
  ["disabled", ":disabled"],
];
const STATE_MAP = new Map(STATES);
const PSEUDO_ELEMENTS: [string, string][] = [
  ["before", "::before"],
  ["after", "::after"],
  ["placeholder", "::placeholder"],
  ["selection", "::selection"],
  ["marker", "::marker"],
  ["file", "::file-selector-button"],
  ["backdrop", "::backdrop"],
  ["first-line", "::first-line"],
  ["first-letter", "::first-letter"],
];
const ARIA_BOOLEANS = [
  "busy",
  "checked",
  "disabled",
  "expanded",
  "hidden",
  "pressed",
  "readonly",
  "required",
  "selected",
  "invalid",
  "current",
];

/** Arbitrary selector/condition text inside variants: underscores are spaces; nothing that could break out of a selector. */
export function safeArbitrary(raw: string): string | null {
  const text = raw.replace(/_/g, " ").trim();
  if (!text || text.length > 120 || /[{};@\\<]|\/\*|url\(|expression\(/i.test(text)) return null;
  return text;
}

type ThemeStrategy = "style-query" | "selector";

function themeVariant(
  name: "dark" | "light" | "contrast",
  strategy: ThemeStrategy,
): VariantDef["apply"] {
  const other = name === "dark" ? "light" : "dark";
  const attr = `[data-nb-theme=${name}]`;
  if (strategy === "style-query") {
    const query =
      name === "contrast"
        ? "@container style(--nb-contrast: more)"
        : `@container style(--nb-scheme: ${name})`;
    return (s) => [
      { ...clone(s), atRules: [...s.atRules, query] },
      { ...clone(s), wrappers: [...s.wrappers, `${attr}&`] },
    ];
  }
  const nested = name === "contrast" ? "" : `:not(:where(${attr} [data-nb-theme=${other}]) *)`;
  const list = [
    `:where(${attr}) &${nested}`,
    ...(name === "contrast" ? [] : [`:where([data-nb-theme=${other}] ${attr}) &`]),
    `${attr}&`,
  ].join(", ");
  const media =
    name === "contrast"
      ? "@media (prefers-contrast: more) and (prefers-color-scheme: light)"
      : `@media (prefers-color-scheme: ${name})`;
  return (s) => [
    { ...clone(s), wrappers: [...s.wrappers, list] },
    {
      ...clone(s),
      atRules: [...s.atRules, media],
      wrappers: [...s.wrappers, `:root:not([data-nb-theme]) &:not(:where([data-nb-theme]) *)`],
    },
  ];
}

export interface VariantRegistry {
  defs: VariantDef[];
  resolve: (name: string) => { def: VariantDef; arg?: string } | null;
}

export function createVariants(theme: Theme, config: ResolvedConfig): VariantRegistry {
  const defs: VariantDef[] = [];
  const add = (
    name: string,
    kind: VariantDef["kind"],
    template: string,
    apply: VariantDef["apply"],
  ) => defs.push({ name, kind, template, order: defs.length, apply });
  const self =
    (sel: string, atRule?: string): VariantDef["apply"] =>
    (s) => [
      {
        ...clone(s),
        self: [...s.self, sel],
        atRules: atRule ? [...s.atRules, atRule] : [...s.atRules],
      },
    ];
  const media =
    (query: string): VariantDef["apply"] =>
    (s) => [{ ...clone(s), atRules: [...s.atRules, `@media ${query}`] }];

  for (const [name, sel] of PSEUDO_ELEMENTS) {
    add(name, "selector", `&${sel}`, (s) => [
      {
        ...clone(s),
        pseudoElement: sel,
        extraDecls:
          name === "before" || name === "after"
            ? [...s.extraDecls, ["content", 'var(--nb-content, "")']]
            : [...s.extraDecls],
      },
    ]);
  }
  for (const [name, sel] of STATES)
    add(name, "selector", `&${sel}`, self(sel, name === "hover" ? HOVER : undefined));

  // Functional relational variants: group-<state>, peer-<state>, aria-*, data-[…], has-[…], not-[…], [arbitrary].
  const stateArg = (arg: string | undefined) => (arg ? STATE_MAP.get(arg) : undefined);
  add("group", "parent-selector", ":where(.group):hover &", (s, arg) => {
    const sel = stateArg(arg);
    return sel
      ? [
          {
            ...clone(s),
            wrappers: [...s.wrappers, `:where(.group)${sel} &`],
            atRules: arg === "hover" ? [...s.atRules, HOVER] : [...s.atRules],
          },
        ]
      : [];
  });
  add("peer", "parent-selector", ":where(.peer):checked~&", (s, arg) => {
    const sel = stateArg(arg);
    return sel
      ? [
          {
            ...clone(s),
            wrappers: [...s.wrappers, `:where(.peer)${sel}~&`],
            atRules: arg === "hover" ? [...s.atRules, HOVER] : [...s.atRules],
          },
        ]
      : [];
  });
  add("aria", "selector", '&[aria-expanded="true"]', (s, arg) => {
    if (!arg) return [];
    if (arg.startsWith("[")) {
      const text = safeArbitrary(arg.slice(1, -1));
      return text && /^[a-z-]+(=[\w-]+)?$/.test(text) ? self(`[aria-${text}]`)(s) : [];
    }
    return ARIA_BOOLEANS.includes(arg) ? self(`[aria-${arg}="true"]`)(s) : [];
  });
  add("data", "selector", "&[data-state=open]", (s, arg) => {
    const text = arg?.startsWith("[")
      ? safeArbitrary(arg.slice(1, -1))
      : arg && /^[a-z][a-z0-9-]*$/.test(arg)
        ? arg
        : null;
    return text && /^[a-z][a-z0-9-]*(=[\w-]+)?$/.test(text) ? self(`[data-${text}]`)(s) : [];
  });
  add("has", "selector", "&:has(:checked)", (s, arg) => {
    const text = arg?.startsWith("[") ? safeArbitrary(arg.slice(1, -1)) : null;
    return text ? self(`:has(${text})`)(s) : [];
  });
  add("not", "selector", "&:not(:last-child)", (s, arg) => {
    const text = arg?.startsWith("[")
      ? safeArbitrary(arg.slice(1, -1))
      : arg
        ? (STATE_MAP.get(arg) ?? null)
        : null;
    return text ? self(`:not(${text})`)(s) : [];
  });
  add("[arbitrary]", "selector", "[&>*]", (s, arg) => {
    const text = arg ? safeArbitrary(arg) : null;
    if (!text) return [];
    if (text.startsWith("@")) return [];
    return text.includes("&") ? [{ ...clone(s), wrappers: [...s.wrappers, text] }] : [];
  });

  add("ltr", "selector", "&:dir(ltr)", self(":dir(ltr)"));
  add("rtl", "selector", "&:dir(rtl)", self(":dir(rtl)"));
  add(
    "motion-safe",
    "media",
    "@media (prefers-reduced-motion: no-preference)",
    media("(prefers-reduced-motion: no-preference)"),
  );
  add(
    "motion-reduce",
    "media",
    "@media (prefers-reduced-motion: reduce)",
    media("(prefers-reduced-motion: reduce)"),
  );
  add(
    "contrast-more",
    "media",
    "@media (prefers-contrast: more)",
    media("(prefers-contrast: more)"),
  );
  add("forced-colors", "media", "@media (forced-colors: active)", media("(forced-colors: active)"));
  add("portrait", "media", "@media (orientation: portrait)", media("(orientation: portrait)"));
  add("landscape", "media", "@media (orientation: landscape)", media("(orientation: landscape)"));
  add("print", "media", "@media print", media("print"));

  const strategy: ThemeStrategy =
    config.themeVariants === "style-query" ? "style-query" : "selector";
  add(
    "light",
    "parent-selector",
    "[data-nb-theme=light] / prefers-color-scheme",
    themeVariant("light", strategy),
  );
  add(
    "dark",
    "parent-selector",
    "[data-nb-theme=dark] / prefers-color-scheme",
    themeVariant("dark", strategy),
  );
  add(
    "contrast",
    "parent-selector",
    "[data-nb-theme=contrast] / prefers-contrast",
    themeVariant("contrast", strategy),
  );
  add("starting", "at-rule", "@starting-style", (s) => [
    { ...clone(s), atRules: [...s.atRules, "@starting-style"] },
  ]);

  const breakpoints = [...theme.breakpoints];
  for (const [bp, value] of [...breakpoints].reverse())
    add(`max-${bp}`, "media", `@media (width < ${value})`, media(`(width < ${value})`));
  for (const [bp, value] of breakpoints)
    add(bp, "media", `@media (width >= ${value})`, media(`(width >= ${value})`));
  for (const [bp, value] of breakpoints) {
    add(`@${bp}`, "container", `@container (width >= ${value})`, (s) => [
      { ...clone(s), atRules: [...s.atRules, `@container (width >= ${value})`] },
    ]);
  }
  add("supports", "at-rule", "@supports (display: grid)", (s, arg) => {
    const text = arg?.startsWith("[") ? safeArbitrary(arg.slice(1, -1)) : null;
    if (!text) return [];
    const condition =
      /^(selector|not|font-)/.test(text) || text.startsWith("(") ? text : `(${text})`;
    return [{ ...clone(s), atRules: [...s.atRules, `@supports ${condition}`] }];
  });

  const byName = new Map(defs.map((d) => [d.name, d]));
  const functional = ["group", "peer", "aria", "data", "has", "not", "supports"];
  return {
    defs,
    resolve(name) {
      const exact = byName.get(name);
      if (exact && !functional.includes(name) && name !== "[arbitrary]") return { def: exact };
      if (name.startsWith("[") && name.endsWith("]"))
        return { def: byName.get("[arbitrary]") as VariantDef, arg: name.slice(1, -1) };
      for (const prefix of functional) {
        if (name.startsWith(`${prefix}-`))
          return { def: byName.get(prefix) as VariantDef, arg: name.slice(prefix.length + 1) };
      }
      return null;
    },
  };
}
