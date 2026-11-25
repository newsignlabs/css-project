import type { z } from "zod";
import { fail } from "./errors.ts";

/** Parses tool input with its schema; any problem becomes NB_SCHEMA_INVALID naming the field. */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    fail(
      "NB_SCHEMA_INVALID",
      parsed.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; "),
      {
        ...(issue?.path.length ? { path: issue.path.join(".") } : {}),
      },
    );
  }
  return (parsed as { data: z.infer<S> }).data;
}
