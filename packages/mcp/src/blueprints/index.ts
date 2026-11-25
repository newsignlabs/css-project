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
import {
  authForm,
  blogList,
  contactForm,
  dashboardShell,
  emptyState,
  featureSplit,
  logoCloud,
  notFound,
  sidebarLayout,
  stats,
  tableView,
} from "./sections-more.ts";

/** Every section blueprint, by name (BlueprintName in contracts/mcp-tools.md), in a sensible page order. */
export const BLUEPRINTS: ReadonlyMap<string, Blueprint> = new Map(
  (
    [
      navbar,
      dashboardShell,
      hero,
      logoCloud,
      featureGrid,
      featureSplit,
      stats,
      pricing,
      testimonial,
      faq,
      blogList,
      contactForm,
      authForm,
      sidebarLayout,
      tableView,
      emptyState,
      notFound,
      callToAction,
      footer,
    ] as Blueprint[]
  ).map((b) => [b.name, b]),
);
export const BLUEPRINT_NAMES: readonly string[] = [...BLUEPRINTS.keys()];
export type { Blueprint } from "./_core.ts";
