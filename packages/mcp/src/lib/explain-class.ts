// specs/003 T007 — explain_class: how newBrush reads a class and the CSS it produces, or why it is rejected.
import { createEngine } from "@newbrush/engine";
import { DOCS_URL, manifest } from "../manifest.ts";
import {
  type ExplainClassInput,
  type ExplainClassOutput,
  ExplainClassInput as InputSchema,
  LIMITS,
} from "../schemas/index.ts";
import { fail } from "./errors.ts";

const engine = createEngine({ content: ["mcp"] });
const categoryOf = new Map(manifest.utilities.map((u) => [u.name, u.category]));

export function explainClass(input: ExplainClassInput): ExplainClassOutput {
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success)
    fail("NB_SCHEMA_INVALID", parsed.error.issues.map((i) => i.message).join("; "));
  const { classes } = parsed.data as ExplainClassInput;
  if (classes.length > LIMITS.explain)
    fail("NB_INPUT_TOO_LARGE", `More than ${LIMITS.explain} classes.`, { path: "classes" });
  return {
    results: classes.map((cls) => {
      const e = engine.explain(cls);
      if ("code" in e) return { ...e };
      const category = categoryOf.get(e.family);
      return {
        class: cls,
        parsed: e.parsed,
        family: e.family,
        css: e.css,
        docs: `${DOCS_URL}/reference/utilities/index.html${category ? `#${category}` : ""}`,
      };
    }),
  };
}
