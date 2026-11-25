// specs/003 T012 — get_component: one component's full manifest entry.
import { manifest } from "../manifest.ts";
import { GetComponentInput, type GetComponentOutput } from "../schemas/index.ts";
import { fail } from "./errors.ts";
import { nearest } from "./suggest.ts";
import { parseInput } from "./validate.ts";

export const COMPONENT_NAMES: readonly string[] = manifest.components.map((c) => c.name);

export function getComponent(input: GetComponentInput): GetComponentOutput {
  const { name } = parseInput(GetComponentInput, input);
  const key = name.trim().toLowerCase().replace(/^nb-/, "");
  const component = manifest.components.find((c) => c.name === key);
  if (!component) {
    const close = nearest(key, COMPONENT_NAMES);
    fail(
      "NB_UNKNOWN_COMPONENT",
      `No component "${name}".${close.length ? ` Did you mean ${close.join(", ")}?` : ""} Components: ${COMPONENT_NAMES.join(", ")}.`,
      close[0] ? { suggestion: close[0] } : {},
    );
  }
  return structuredClone(component) as GetComponentOutput;
}
