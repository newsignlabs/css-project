import tokensJson from "@newbrush/tokens/tokens.json" with { type: "json" };

interface TokenLike {
  path: string[];
  cssVar: string;
  value: string;
}

/** Token-backed value scales the utility families draw from. Values are `var(--nb-…)` references. */
export interface Theme {
  space: Map<string, string>;
  colors: Map<string, string>;
  radius: Map<string, string>;
  shadow: Map<string, string>;
  fontSize: Map<string, string>;
  fontWeight: Map<string, string>;
  fontFamily: Map<string, string>;
  leading: Map<string, string>;
  tracking: Map<string, string>;
  z: Map<string, string>;
  duration: Map<string, string>;
  easing: Map<string, string>;
  blur: Map<string, string>;
  opacity: Map<string, string>;
  container: Map<string, string>;
  /** Raw values: media and container queries cannot read custom properties. */
  breakpoints: Map<string, string>;
}

const v = (t: TokenLike) => `var(${t.cssVar})`;
const dropDefault = (path: string[]) => (path.at(-1) === "default" ? path.slice(0, -1) : path);

export function createTheme(
  tokens: TokenLike[] = (tokensJson as { tokens: TokenLike[] }).tokens,
): Theme {
  const theme: Theme = {
    space: new Map(),
    colors: new Map(),
    radius: new Map(),
    shadow: new Map(),
    fontSize: new Map(),
    fontWeight: new Map(),
    fontFamily: new Map(),
    leading: new Map(),
    tracking: new Map(),
    z: new Map(),
    duration: new Map(),
    easing: new Map(),
    blur: new Map(),
    opacity: new Map(),
    container: new Map(),
    breakpoints: new Map(),
  };
  const elevation = new Map<string, string>();

  for (const t of tokens) {
    const [group, a, b] = t.path;
    if (group === "space") {
      if (a === "fluid" && b) theme.space.set(`fluid-${b}`, v(t));
      else if (a) theme.space.set(a.replace("-", "."), v(t));
    } else if (group === "color") theme.colors.set(dropDefault(t.path.slice(1)).join("-"), v(t));
    else if (group === "radius" && a) theme.radius.set(a, v(t));
    else if (group === "elevation" && a) elevation.set(a, v(t));
    else if (group === "font" && a && b) {
      const map = {
        size: theme.fontSize,
        weight: theme.fontWeight,
        family: theme.fontFamily,
        leading: theme.leading,
        tracking: theme.tracking,
      }[a];
      map?.set(b, v(t));
    } else if (group === "z" && a) theme.z.set(a, v(t));
    else if (group === "motion" && a === "duration" && b) theme.duration.set(b, v(t));
    else if (group === "motion" && a === "easing" && b) theme.easing.set(b, v(t));
    else if (group === "blur" && a) theme.blur.set(a, v(t));
    else if (group === "opacity" && a) theme.opacity.set(a, v(t));
    else if (group === "size" && a === "container" && b) theme.container.set(b, v(t));
    else if (group === "size" && a === "prose") theme.container.set("prose", v(t));
    else if (group === "breakpoint" && a) theme.breakpoints.set(a, t.value);
  }

  // Named shadows map onto the elevation scale; numeric elevations are available too.
  const named: Record<string, string> = {
    none: "0",
    sm: "1",
    md: "2",
    lg: "3",
    xl: "4",
    "2xl": "5",
  };
  for (const [name, level] of Object.entries(named)) {
    const value = elevation.get(level);
    if (value) theme.shadow.set(name, value);
  }
  for (const [level, value] of elevation) theme.shadow.set(level, value);
  theme.radius.set("DEFAULT", theme.radius.get("md") ?? "0");

  for (const [k, val] of [
    ["transparent", "transparent"],
    ["current", "currentcolor"],
    ["inherit", "inherit"],
  ] as const) {
    theme.colors.set(k, val);
  }
  return theme;
}
