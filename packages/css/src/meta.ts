import type { Component } from "@newbrush/schema";

/** Typed helper for `*.meta.ts` files; validated again by the build (T023). */
export function defineComponent(meta: Component): Component {
  return meta;
}

export const SINCE = "0.1.0";
