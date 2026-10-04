// Type-level drift check (run by `pnpm typecheck`): newbrush/config and @newbrush/schema must describe the same config.
import type { Config } from "@newbrush/schema";
import type { NewBrushConfig } from "../config/index.js";

type Equals<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;

// Same top-level keys (catches fields missing on either side)…
export type SameKeys = Assert<Equals<keyof NewBrushConfig, keyof Config>>;
// …and values assignable in both directions (catches type changes).
export const schemaAcceptsPublic = (c: NewBrushConfig): Config => c;
export const publicAcceptsSchema = (c: Config): NewBrushConfig => c;
