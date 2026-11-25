import type { Diagnostic } from "../schemas/index.ts";

/** A tool failure with a structured diagnostic (NB_* code); transports turn it into an MCP error result. */
export class ToolError extends Error {
  constructor(readonly diagnostic: Diagnostic) {
    super(diagnostic.message);
    this.name = "ToolError";
  }
}

export const fail = (code: string, message: string, extra: Partial<Diagnostic> = {}): never => {
  throw new ToolError({ code, severity: "error", message, ...extra });
};
