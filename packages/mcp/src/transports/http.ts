// specs/003 T032 — the newBrush MCP server over HTTP: Streamable HTTP MCP at /mcp (one server and theme store per
// session), a REST mirror of every tool at /v1/tools/{name}, the manifest and a health check. Optional API keys, a
// per-key (or per-client) rate limit, CORS and a body limit. Built on web-standard Request/Response (hono and the
// SDK's WebStandardStreamableHTTPServerTransport), so the same app runs on Node, Workers or any fetch runtime.
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { type Context, Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { matchedRoutes } from "hono/route";
import { ToolError } from "../lib/errors.ts";
import { ThemeStore } from "../lib/theme-store.ts";
import { TOOLS } from "../lib/tools.ts";
import { manifest, SERVER_VERSION } from "../manifest.ts";
import type { Diagnostic } from "../schemas/index.ts";
import { createServer } from "../server.ts";

export interface LogEntry {
  method: string;
  /** The matched route pattern (/mcp, /v1/tools/:name…), never the raw URL. */
  route: string;
  status: number;
  ms: number;
  /** The REST tool called, when it exists. */
  tool?: string;
}

export interface HttpOptions {
  /** Accepted API keys (Authorization: Bearer <key> or X-API-Key). None: no authentication (local use). */
  apiKeys?: readonly string[];
  /** Requests per minute per API key, or per client without keys. Default 120; 0 turns the limit off. */
  rateLimit?: number;
  /** Allowed CORS origins. Default "*". */
  corsOrigins?: readonly string[] | "*";
  /** Concurrent MCP sessions kept; the least recently used is closed beyond this. Default 1000. */
  maxSessions?: number;
  /** An MCP session idle this long is closed. Default 30 minutes. */
  sessionTtlMs?: number;
  /** Largest request body. Default 1 MB. */
  maxBodyBytes?: number;
  /** Identifies the client for rate limiting when no API key is used (e.g. its IP address). */
  clientId?: (c: Context) => string;
  /** Receives one content-free entry per request. */
  log?: (entry: LogEntry) => void;
  /** Clock, for tests. */
  now?: () => number;
}

interface Session {
  transport: WebStandardStreamableHTTPServerTransport;
  close: () => Promise<void>;
  last: number;
}

const error = (code: string, message: string): { error: Diagnostic } => ({
  error: { code, severity: "error", message },
});
/** JSON-RPC error body for /mcp (the transport's own errors use the same shape). */
const rpcError = (code: number, message: string) => ({
  jsonrpc: "2.0",
  error: { code, message },
  id: null,
});

/** Compares secrets in time independent of where they differ. */
function sameSecret(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

const defaultClientId = (c: Context) =>
  c.req.header("cf-connecting-ip") ??
  c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
  "anonymous";

export function createHttpApp(options: HttpOptions = {}): Hono {
  const {
    apiKeys = [],
    rateLimit = 120,
    corsOrigins = "*",
    maxSessions = 1000,
    sessionTtlMs = 30 * 60_000,
    maxBodyBytes = 1024 * 1024,
    clientId = defaultClientId,
    log,
    now = Date.now,
  } = options;
  const app = new Hono();
  const sessions = new Map<string, Session>();
  /** REST is stateless, but themeIds are content hashes: one shared store lets create_theme → build_page work. */
  const restThemes = new ThemeStore();
  const windows = new Map<string, { start: number; count: number }>();

  // Content-free request log.
  app.use("*", async (c, next) => {
    const start = now();
    await next();
    if (!log) return;
    const name = /^\/v1\/tools\/([^/]+)$/.exec(c.req.path)?.[1];
    log({
      method: c.req.method,
      route:
        matchedRoutes(c)
          .map((r) => r.path)
          .filter((p) => p !== "*" && p !== "/*")
          .at(-1) ?? "(none)",
      status: c.res.status,
      ms: now() - start,
      ...(name && Object.hasOwn(TOOLS, name) ? { tool: name } : {}),
    });
  });

  app.use(
    "*",
    cors({
      origin: corsOrigins === "*" ? "*" : [...corsOrigins],
      allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
      allowHeaders: [
        "Content-Type",
        "Authorization",
        "X-API-Key",
        "Mcp-Session-Id",
        "Mcp-Protocol-Version",
        "Last-Event-ID",
      ],
      exposeHeaders: ["Mcp-Session-Id", "Retry-After"],
      maxAge: 600,
    }),
  );

  app.get("/healthz", (c) => c.json({ ok: true, version: SERVER_VERSION }));

  // API keys.
  app.use("*", async (c, next) => {
    if (!apiKeys.length || c.req.method === "OPTIONS") return next();
    const bearer = /^Bearer\s+(.+)$/i.exec(c.req.header("authorization") ?? "")?.[1]?.trim();
    const key = bearer ?? c.req.header("x-api-key");
    if (!key || !apiKeys.some((k) => sameSecret(k, key))) {
      c.header("WWW-Authenticate", 'Bearer realm="newbrush"');
      return c.json(
        error("NB_UNAUTHORIZED", "Send an API key: Authorization: Bearer <key> or X-API-Key."),
        401,
      );
    }
    c.set("apiKey" as never, key as never);
    return next();
  });

  // Rate limit: a fixed one-minute window per key (or per client without keys).
  app.use("*", async (c, next) => {
    if (!rateLimit || c.req.method === "OPTIONS") return next();
    const id = (c.get("apiKey" as never) as string | undefined) ?? clientId(c);
    const t = now();
    if (windows.size > 10_000)
      for (const [k, w] of windows) if (t - w.start >= 60_000) windows.delete(k);
    let w = windows.get(id);
    if (!w || t - w.start >= 60_000) {
      w = { start: t, count: 0 };
      windows.set(id, w);
    }
    if (++w.count > rateLimit) {
      c.header("Retry-After", String(Math.max(1, Math.ceil((w.start + 60_000 - t) / 1000))));
      return c.json(
        error("NB_RATE_LIMITED", `More than ${rateLimit} requests a minute; retry later.`),
        429,
      );
    }
    return next();
  });

  app.use(
    "*",
    bodyLimit({
      maxSize: maxBodyBytes,
      onError: (c) =>
        c.json(
          error(
            "NB_INPUT_TOO_LARGE",
            `Request bodies are limited to ${Math.round(maxBodyBytes / 1024)} KB.`,
          ),
          413,
        ),
    }),
  );

  // ── Streamable HTTP MCP ──────────────────────────────────────────────────────

  const closeSession = async (id: string) => {
    const s = sessions.get(id);
    sessions.delete(id);
    await s?.close();
  };
  const sweep = async () => {
    const t = now();
    for (const [id, s] of sessions) if (t - s.last > sessionTtlMs) await closeSession(id);
    while (sessions.size >= maxSessions) {
      const oldest = sessions.keys().next().value;
      if (oldest === undefined) break;
      await closeSession(oldest);
    }
  };

  app.all("/mcp", async (c) => {
    const id = c.req.header("mcp-session-id");
    if (id) {
      const session = sessions.get(id);
      if (!session || now() - session.last > sessionTtlMs) {
        if (session) await closeSession(id);
        return c.json(rpcError(-32001, "Session not found; initialize a new session."), 404);
      }
      // Most recently used last, so eviction takes the least recently used.
      sessions.delete(id);
      session.last = now();
      sessions.set(id, session);
      return session.transport.handleRequest(c.req.raw);
    }
    if (c.req.method !== "POST")
      return c.json(
        rpcError(-32000, "Mcp-Session-Id header required; POST an initialize request first."),
        400,
      );

    await sweep();
    const server = createServer();
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      enableJsonResponse: true,
      onsessioninitialized: (sid) => {
        sessions.set(sid, { transport, close: () => server.close(), last: now() });
      },
      onsessionclosed: (sid) => {
        sessions.delete(sid);
      },
    });
    await server.connect(transport);
    const response = await transport.handleRequest(c.req.raw);
    // Not an initialize request (the transport answered with an error): nothing to keep.
    if (!transport.sessionId) await server.close();
    return response;
  });

  // ── REST mirror ──────────────────────────────────────────────────────────────

  app.get("/v1/tools", (c) => c.json({ tools: Object.keys(TOOLS) }));

  app.post("/v1/tools/:name", async (c) => {
    const name = c.req.param("name");
    const tool = Object.hasOwn(TOOLS, name) ? TOOLS[name] : undefined;
    if (!tool)
      return c.json(
        error(
          "NB_UNKNOWN_TOOL",
          `Unknown tool "${name}". Tools: ${Object.keys(TOOLS).join(", ")}.`,
        ),
        404,
      );
    let args: unknown;
    try {
      args = await c.req.json();
    } catch {
      return c.json(
        error("NB_SCHEMA_INVALID", "The request body must be a JSON object of tool arguments."),
        400,
      );
    }
    try {
      return c.json({ result: tool(args, restThemes) });
    } catch (e) {
      if (e instanceof ToolError) return c.json({ error: e.diagnostic }, 400);
      return c.json(error("NB_INTERNAL", "The tool failed unexpectedly."), 500);
    }
  });

  app.get("/v1/manifest", (c) => c.json(manifest));

  app.notFound((c) =>
    c.json(
      error("NB_NOT_FOUND", "Endpoints: /mcp, /v1/tools/{name}, /v1/manifest, /healthz."),
      404,
    ),
  );

  return app;
}
