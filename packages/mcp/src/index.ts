#!/usr/bin/env node
// specs/003 T008, T032 — the newbrush-mcp command. Over stdio, stdout belongs to the MCP protocol; messages go to stderr.
import { SERVER_VERSION } from "./manifest.ts";
import { serveStdio } from "./transports/stdio.ts";

const HELP = `newbrush-mcp ${SERVER_VERSION} — the newBrush MCP server

Usage: newbrush-mcp [--transport stdio|http] [--port N] [--host H] [--version] [--help]

  --transport stdio   Serve over stdin/stdout (default).
  --transport http    Serve Streamable HTTP at /mcp, a REST mirror at /v1/tools/{name},
                      /v1/manifest and /healthz.
  --port N            HTTP port (default $PORT or 3333; 0 picks a free one).
  --host H            HTTP interface (default 127.0.0.1; 0.0.0.0 for every interface).
  --version           Print the version.
  --help              Print this help.

HTTP environment:
  NEWBRUSH_MCP_API_KEYS      Comma-separated API keys; clients send Authorization: Bearer <key>.
  NEWBRUSH_MCP_RATE_LIMIT    Requests per minute per key or client (default 120, 0 = off).
  NEWBRUSH_MCP_CORS_ORIGINS  Comma-separated allowed origins (default *).

Client config: { "mcpServers": { "newbrush": { "command": "npx", "args": ["-y", "@newbrush/mcp"] } } }
`;

const args = process.argv.slice(2);
const flag = (name: string) => {
  const at = args.indexOf(name);
  return at === -1 ? undefined : args[at + 1];
};
if (args.includes("--help") || args.includes("-h")) {
  process.stderr.write(HELP);
  process.exit(0);
}
if (args.includes("--version") || args.includes("-v")) {
  process.stdout.write(`${SERVER_VERSION}\n`);
  process.exit(0);
}
const transport = flag("--transport") ?? "stdio";
if (transport === "stdio") await serveStdio();
else if (transport === "http") {
  const { serveHttp } = await import("./transports/node-http.ts");
  const port = Number(flag("--port") ?? process.env.PORT ?? 3333);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    process.stderr.write(`newbrush-mcp: --port must be 0–65535.\n`);
    process.exit(2);
  }
  await serveHttp({ port, host: flag("--host") ?? "127.0.0.1", env: process.env });
} else {
  process.stderr.write(`newbrush-mcp: unknown transport "${transport}"; use stdio or http.\n`);
  process.exit(2);
}
