import type { UtilityFamily } from "@newbrush/schema";
import type { Theme } from "./theme.ts";
import type { Grammar } from "./validate.ts";

export type Decl = [property: string, value: string];
export type Category = UtilityFamily["category"];

export interface Resolved {
  decls: Decl[];
  /** Selector template where `&` is the utility selector, e.g. `:where(& > :not(:last-child))`. */
  selector?: string;
  /** Keyframes emitted once per build, keyed by name. */
  keyframes?: Record<string, string>;
}

export interface ValueInput {
  value?: string;
  arbitrary?: string;
  negative: boolean;
  modifier?: string;
}

export interface Family {
  name: string;
  category: Category;
  description: string;
  /** Functional roots, e.g. ["p"] for p-4. */
  roots: string[];
  /** Value-less classes, e.g. { flex: [["display", "flex"]] }. */
  statics?: Record<string, Decl[] | Resolved>;
  resolve?: (input: ValueInput, theme: Theme) => Resolved | null;
  arbitrary?: Grammar;
  negative?: boolean;
  opacityModifier?: boolean;
  properties: string[];
  /** Known values for docs, editor types and presets. */
  values: (theme: Theme) => string[];
  valueSource: UtilityFamily["values"];
}
