#!/usr/bin/env node
// specs/003 T008 — the newbrush-mcp command. stdout belongs to the MCP protocol; messages go to stderr.
import { SERVER_VERSION } from "./manifest.ts";
import { serveStdio } from "./transports/stdio.ts";

const HELP = `newbrush-mcp ${SERVER_VERSION} — the newBrush MCP server

Usage: newbrush-mcp [--transport stdio] [--version] [--help]

  --transport stdio   Serve over stdin/stdout (default). Streamable HTTP is planned.
  --version           Print the version.
  --help              Print this help.

Client config: { "mcpServers": { "newbrush": { "command": "npx", "args": ["-y", "@newbrush/mcp"] } } }
`;

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  process.stderr.write(HELP);
  process.exit(0);
}
if (args.includes("--version") || args.includes("-v")) {
  process.stdout.write(`${SERVER_VERSION}\n`);
  process.exit(0);
}
const at = args.indexOf("--transport");
const transport = at === -1 ? "stdio" : args[at + 1];
if (transport !== "stdio") {
  process.stderr.write(`newbrush-mcp: transport "${transport}" is not available yet; use stdio.\n`);
  process.exit(2);
}
await serveStdio();
