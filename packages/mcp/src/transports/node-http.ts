// Runs the HTTP app (transports/http.ts) on Node with @hono/node-server, configured from flags and environment.
import { serve } from "@hono/node-server";
import { getConnInfo } from "@hono/node-server/conninfo";
import { createHttpApp } from "./http.ts";

const list = (value: string | undefined) =>
  value
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export async function serveHttp({
  port,
  host,
  env,
}: {
  port: number;
  host: string;
  env: Record<string, string | undefined>;
}): Promise<void> {
  const origins = list(env.NEWBRUSH_MCP_CORS_ORIGINS);
  const limit = env.NEWBRUSH_MCP_RATE_LIMIT;
  const app = createHttpApp({
    ...(list(env.NEWBRUSH_MCP_API_KEYS)?.length
      ? { apiKeys: list(env.NEWBRUSH_MCP_API_KEYS) }
      : {}),
    ...(limit !== undefined && limit !== "" ? { rateLimit: Number(limit) } : {}),
    ...(origins?.length && !origins.includes("*") ? { corsOrigins: origins } : {}),
    clientId: (c) => getConnInfo(c).remote.address ?? "anonymous",
    log: (e) =>
      process.stderr.write(
        `${e.method} ${e.route} ${e.status} ${e.ms}ms${e.tool ? ` ${e.tool}` : ""}\n`,
      ),
  });
  await new Promise<void>((resolve) => {
    const server = serve({ fetch: app.fetch, port, hostname: host }, (info) => {
      const shown = host.includes(":") ? `[${host}]` : host;
      process.stderr.write(`newbrush-mcp: listening on http://${shown}:${info.port}/mcp\n`);
      resolve();
    });
    const stop = () => server.close(() => process.exit(0));
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
}
