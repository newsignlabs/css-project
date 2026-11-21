/**
 * @newbrush/js — optional behaviours (constitution §III: enhance, never required).
 *
 * Design styles at runtime (specs/004 T031, contract style-api.md §JavaScript): `setStyle("neon")` swaps the style
 * class on an element (the whole page when it is <body>), optionally with a View Transition and remembered across
 * visits. Styles work without this package: it only changes a class.
 */

declare const __NB_STYLES__: readonly StyleInfo[];

export interface StyleInfo {
  name: string;
  aliases?: readonly string[];
}

export interface SetStyleOptions {
  /** Element that carries the style; default <body>. */
  target?: Element;
  /** Animate the switch with the View Transitions API (skipped with prefers-reduced-motion or without the API). */
  transition?: boolean;
  /** Remember the choice in localStorage for restoreStyle(). */
  persist?: boolean;
  /** Custom styles (config customStyles) to recognise besides the built-ins. */
  styles?: readonly StyleInfo[];
  /** config prefix.styles, if the project sets one. */
  prefix?: string;
}

/** The built-in design styles. */
export const BUILT_IN_STYLES: readonly StyleInfo[] = __NB_STYLES__;
/** localStorage key for persisted choices. */
export const STORAGE_KEY = "nb-style";
/** Name for the default style inside a styled page (class `style-default`). */
export const DEFAULT_STYLE = "default";

const known = (options: SetStyleOptions) => [...BUILT_IN_STYLES, ...(options.styles ?? [])];

/** The canonical name for a style or alias, or null when unknown. */
function canonical(name: string, options: SetStyleOptions): string | null {
  if (name === DEFAULT_STYLE) return DEFAULT_STYLE;
  const found = known(options).find((s) => s.name === name || s.aliases?.includes(name));
  return found ? found.name : null;
}

/** Every class that applies a style: bare (with the prefix), nb-, aliases, and the default reset. */
function styleClasses(options: SetStyleOptions): Map<string, string> {
  const prefix = options.prefix ?? "";
  const map = new Map<string, string>();
  for (const s of known(options))
    for (const cls of [
      `${prefix}${s.name}`,
      `nb-${s.name}`,
      ...(s.aliases ?? []).map((a) => `${prefix}${a}`),
    ])
      map.set(cls, s.name);
  map.set(`${prefix}style-${DEFAULT_STYLE}`, DEFAULT_STYLE);
  map.set(`nb-style-${DEFAULT_STYLE}`, DEFAULT_STYLE);
  return map;
}

const defaultTarget = (): Element => document.body ?? document.documentElement;

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // storage disabled (privacy mode, sandboxed frames)
  }
}

/**
 * Applies a style to `target` (default <body>): removes any style class or data-nb-style it has, then adds the new
 * style's class. `null` removes the style (the element inherits its ancestors' style, or the default);
 * `"default"` sets the default style explicitly (`style-default`). Aliases are accepted. Resolves once applied.
 */
export async function setStyle(name: string | null, options: SetStyleOptions = {}): Promise<void> {
  const style = name === null ? null : canonical(name, options);
  if (name !== null && !style)
    throw new Error(
      `Unknown newBrush style "${name}" (known: ${known(options)
        .map((s) => s.name)
        .join(", ")}, ${DEFAULT_STYLE}); pass custom styles in options.styles`,
    );
  const target = options.target ?? defaultTarget();
  const classes = styleClasses(options);
  const prefix = options.prefix ?? "";
  const apply = () => {
    for (const cls of [...target.classList]) if (classes.has(cls)) target.classList.remove(cls);
    target.removeAttribute("data-nb-style");
    if (style)
      target.classList.add(
        style === DEFAULT_STYLE ? `${prefix}style-${DEFAULT_STYLE}` : `${prefix}${style}`,
      );
  };

  if (options.persist) {
    const store = storage();
    try {
      if (style) store?.setItem(STORAGE_KEY, style);
      else store?.removeItem(STORAGE_KEY);
    } catch {
      // quota or privacy errors: the style still applies, it is just not remembered
    }
  }

  const doc = target.ownerDocument as Document & {
    startViewTransition?: (update: () => void) => { updateCallbackDone: Promise<void> };
  };
  const reduced =
    doc.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  if (options.transition && typeof doc.startViewTransition === "function" && !reduced) {
    await doc.startViewTransition(apply).updateCallbackDone;
    return;
  }
  apply();
}

/**
 * The style in effect at `target` (default <body>): the nearest style, `"default"` under a `.style-default`, or null
 * when no style applies. Reads the --nb-style marker the stylesheet sets, falling back to the markup.
 */
export function getStyle(
  target: Element = defaultTarget(),
  options: Pick<SetStyleOptions, "styles" | "prefix"> = {},
): string | null {
  const view = target.ownerDocument.defaultView;
  const marker = view?.getComputedStyle(target).getPropertyValue("--nb-style").trim();
  if (marker) return marker;
  const classes = styleClasses(options);
  for (let el: Element | null = target; el; el = el.parentElement) {
    const attr = el.getAttribute("data-nb-style");
    if (attr) return attr;
    for (const cls of [...el.classList].reverse()) {
      const style = classes.get(cls);
      if (style) return style;
    }
  }
  return null;
}

/** Applies the style remembered by `setStyle(name, { persist: true })`, if any; returns it. */
export function restoreStyle(
  options: Omit<SetStyleOptions, "persist" | "transition"> = {},
): string | null {
  let saved: string | null = null;
  try {
    saved = storage()?.getItem(STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
  if (!saved || !canonical(saved, options)) return null;
  void setStyle(saved, { ...options, transition: false, persist: false });
  return saved;
}
