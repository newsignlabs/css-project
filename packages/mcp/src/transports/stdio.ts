import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "../server.ts";

/** Serves the newBrush tools over stdio (the default for local MCP clients). Logs go to stderr only. */
export async function serveStdio(): Promise<void> {
  const server = createServer();
  await server.connect(new StdioServerTransport());
}
