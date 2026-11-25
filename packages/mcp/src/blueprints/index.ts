import type { Blueprint } from "./_core.ts";
import {
  callToAction,
  faq,
  featureGrid,
  footer,
  hero,
  navbar,
  pricing,
  testimonial,
} from "./sections.ts";

/** Every section blueprint, by name (BlueprintName in contracts/mcp-tools.md). */
export const BLUEPRINTS: ReadonlyMap<string, Blueprint> = new Map(
  ([navbar, hero, featureGrid, pricing, testimonial, faq, callToAction, footer] as Blueprint[]).map(
    (b) => [b.name, b],
  ),
);
export const BLUEPRINT_NAMES: readonly string[] = [...BLUEPRINTS.keys()];
export type { Blueprint } from "./_core.ts";
