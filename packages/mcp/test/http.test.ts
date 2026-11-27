import { describe, expect, it } from "vitest";
import { TOOLS } from "../src/lib/tools.ts";
import { createHttpApp, type HttpOptions, type LogEntry } from "../src/transports/http.ts";

// specs/003 T031 — the HTTP transport: Streamable HTTP sessions, REST mirror parity, auth, rate limit, CORS, limits.

const ACCEPT = "application/json, text/event-stream";
type App = ReturnType<typeof createHttpApp>;
let rpcId = 0;

async function rpc(
  app: App,
  method: string,
  params: unknown,
  sid?: string,
  headers: Record<string, string> = {},
) {
  const res = await app.request("/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: ACCEPT,
      ...(sid ? { "mcp-session-id": sid, "mcp-protocol-version": "2025-06-18" } : {}),
      ...headers,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
  });
  return { res, body: res.status === 202 ? undefined : await res.json() };
}

async function open(app: App, headers: Record<string, string> = {}) {
  const { res } = await rpc(
    app,
    "initialize",
    { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } },
    undefined,
    headers,
  );
  expect(res.status).toBe(200);
  const sid = res.headers.get("mcp-session-id") ?? "";
  expect(sid).toMatch(/^[0-9a-f-]{36}$/);
  await app.request("/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: ACCEPT,
      "mcp-session-id": sid,
      ...headers,
    },
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
  });
  return sid;
}

const call = async (app: App, sid: string, name: string, args: unknown) =>
  (await rpc(app, "tools/call", { name, arguments: args }, sid)).body.result;
const rest = (app: App, name: string, body: unknown, headers: Record<string, string> = {}) =>
  app.request(`/v1/tools/${name}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

/** One valid call per tool. */
const SAMPLES: Record<string, unknown> = {
  generate_css: { classes: ["p-4", "md:grid-cols-2"] },
  explain_class: { classes: ["p-4"] },
  search: { query: "pricing table", limit: 3 },
  get_component: { name: "card" },
  get_tokens: { group: "space" },
  build_page: { title: "T", sections: [{ type: "hero", props: { title: "Hi" } }] },
  compose_component: { name: "button", slots: { content: "Go" } },
  create_theme: { name: "acme", seeds: { brand: "#2563eb" } },
  validate_markup: { html: '<img src="x.png">' },
  convert_markup: { html: '<p class="p-4 text-gray-600">x</p>', from: "tailwind" },
};

describe("Streamable HTTP", () => {
  it("runs a session: initialize, list, call, delete", async () => {
    const app = createHttpApp();
    const sid = await open(app);
    const list = await rpc(app, "tools/list", {}, sid);
    expect(list.body.result.tools.map((t: { name: string }) => t.name).sort()).toEqual(
      Object.keys(TOOLS).sort(),
    );
    const page = await call(app, sid, "build_page", SAMPLES.build_page);
    expect(page.structuredContent.html).toMatch(/^<!DOCTYPE html>/);
    const del = await app.request("/mcp", { method: "DELETE", headers: { "mcp-session-id": sid } });
    expect(del.status).toBe(200);
    const after = await rpc(app, "tools/list", {}, sid);
    expect(after.res.status).toBe(404);
  });

  it("keeps themes per session", async () => {
    const app = createHttpApp();
    const a = await open(app);
    const b = await open(app);
    expect(a).not.toBe(b);
    const theme = await call(app, a, "create_theme", SAMPLES.create_theme);
    const themeId = theme.structuredContent.themeId;
    expect(
      (await call(app, a, "generate_css", { classes: ["p-4"], theme: { themeId } })).isError,
    ).toBeFalsy();
    const other = await call(app, b, "generate_css", { classes: ["p-4"], theme: { themeId } });
    expect(other.isError).toBe(true);
    expect(other._meta["newbrush/error"].code).toBe("NB_SCHEMA_INVALID");
  });

  it("asks for a session: unknown ids are 404, requests without one 400", async () => {
    const app = createHttpApp();
    expect(
      (await rpc(app, "tools/list", {}, "00000000-0000-0000-0000-000000000000")).res.status,
    ).toBe(404);
    expect(
      (await app.request("/mcp", { method: "GET", headers: { accept: "text/event-stream" } }))
        .status,
    ).toBe(400);
    const notInit = await rpc(app, "tools/list", {});
    expect(notInit.res.status).toBe(400);
  });

  it("closes the least recently used session beyond the cap, and idle sessions", async () => {
    let t = 0;
    const app = createHttpApp({ maxSessions: 2, sessionTtlMs: 1000, now: () => t });
    const a = await open(app);
    const b = await open(app);
    await rpc(app, "tools/list", {}, a); // a is now the most recent
    await open(app); // evicts b
    expect((await rpc(app, "tools/list", {}, b)).res.status).toBe(404);
    expect((await rpc(app, "tools/list", {}, a)).res.status).toBe(200);
    t = 5000;
    expect((await rpc(app, "tools/list", {}, a)).res.status).toBe(404);
  });
});

describe("REST mirror", () => {
  it("covers every tool", () => {
    expect(Object.keys(SAMPLES).sort()).toEqual(Object.keys(TOOLS).sort());
  });

  it("returns exactly what the MCP tool returns, for every tool", async () => {
    const app = createHttpApp();
    const sid = await open(app);
    for (const [name, args] of Object.entries(SAMPLES)) {
      const mcp = await call(app, sid, name, args);
      expect(mcp.isError, name).toBeFalsy();
      const res = await rest(app, name, args);
      expect(res.status, name).toBe(200);
      expect((await res.json()).result, name).toEqual(mcp.structuredContent);
    }
  });

  it("returns the same diagnostic as MCP for tool errors; 404 for unknown tools", async () => {
    const app = createHttpApp();
    const sid = await open(app);
    const mcp = await call(app, sid, "get_component", { name: "modl" });
    const res = await rest(app, "get_component", { name: "modl" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toEqual(mcp._meta["newbrush/error"]);
    expect((await rest(app, "get_component", "not json")).status).toBe(400);
    const unknown = await rest(app, "toString", {});
    expect(unknown.status).toBe(404);
    expect((await unknown.json()).error.code).toBe("NB_UNKNOWN_TOOL");
  });

  it("resolves themeIds across calls", async () => {
    const app = createHttpApp();
    const { result } = await (await rest(app, "create_theme", SAMPLES.create_theme)).json();
    const page = await rest(app, "build_page", {
      ...(SAMPLES.build_page as object),
      theme: { themeId: result.themeId },
    });
    expect(page.status).toBe(200);
  });

  it("serves the manifest, the tool list and a health check", async () => {
    const app = createHttpApp();
    const manifest = await (await app.request("/v1/manifest")).json();
    expect(manifest.components.length).toBeGreaterThan(10);
    expect((await (await app.request("/v1/tools")).json()).tools).toContain("build_page");
    expect(await (await app.request("/healthz")).json()).toMatchObject({ ok: true });
    expect((await app.request("/nope")).status).toBe(404);
  });
});

describe("HTTP middleware", () => {
  it("requires an API key when keys are set, except for the health check", async () => {
    const app = createHttpApp({ apiKeys: ["k1", "k2"] });
    const denied = await rest(app, "get_component", { name: "card" });
    expect(denied.status).toBe(401);
    expect(denied.headers.get("www-authenticate")).toContain("Bearer");
    expect(
      (await rest(app, "get_component", { name: "card" }, { authorization: "Bearer k2" })).status,
    ).toBe(200);
    expect((await rest(app, "get_component", { name: "card" }, { "x-api-key": "k1" })).status).toBe(
      200,
    );
    expect((await rest(app, "get_component", { name: "card" }, { "x-api-key": "k3" })).status).toBe(
      401,
    );
    expect((await app.request("/healthz")).status).toBe(200);
    // MCP sessions too.
    expect((await rpc(app, "initialize", {})).res.status).toBe(401);
    const sid = await open(app, { authorization: "Bearer k1" });
    expect(sid).toBeTruthy();
  });

  it("rate-limits per key or client, with Retry-After", async () => {
    let t = 0;
    const app = createHttpApp({ rateLimit: 3, now: () => t });
    const ip = (n: string) => ({ "x-forwarded-for": n });
    for (let i = 0; i < 3; i++)
      expect((await rest(app, "get_component", { name: "card" }, ip("1.1.1.1"))).status).toBe(200);
    const limited = await rest(app, "get_component", { name: "card" }, ip("1.1.1.1"));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");
    expect((await limited.json()).error.code).toBe("NB_RATE_LIMITED");
    expect((await rest(app, "get_component", { name: "card" }, ip("2.2.2.2"))).status).toBe(200);
    t = 60_000;
    expect((await rest(app, "get_component", { name: "card" }, ip("1.1.1.1"))).status).toBe(200);
  });

  it("answers CORS preflights and exposes the session header", async () => {
    const app = createHttpApp({ corsOrigins: ["https://app.example"] });
    const pre = await app.request("/mcp", {
      method: "OPTIONS",
      headers: {
        origin: "https://app.example",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type, mcp-session-id",
      },
    });
    expect(pre.status).toBe(204);
    expect(pre.headers.get("access-control-allow-origin")).toBe("https://app.example");
    expect(pre.headers.get("access-control-allow-headers")?.toLowerCase()).toContain(
      "mcp-session-id",
    );
    const res = await app.request("/healthz", { headers: { origin: "https://app.example" } });
    expect(res.headers.get("access-control-expose-headers")).toContain("Mcp-Session-Id");
    const other = await app.request("/healthz", { headers: { origin: "https://evil.example" } });
    expect(other.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("limits body size", async () => {
    const app = createHttpApp({ maxBodyBytes: 1024 });
    const res = await rest(app, "validate_markup", { html: "x".repeat(4096) });
    expect(res.status).toBe(413);
    expect((await res.json()).error.code).toBe("NB_INPUT_TOO_LARGE");
  });

  it("logs routes and status only: no bodies, keys or addresses", async () => {
    const entries: LogEntry[] = [];
    const options: HttpOptions = { apiKeys: ["secret-key"], log: (e) => entries.push(e) };
    const app = createHttpApp(options);
    await rest(
      app,
      "validate_markup",
      { html: "<p>private text</p>" },
      { "x-api-key": "secret-key", "x-forwarded-for": "9.9.9.9" },
    );
    await app.request("/healthz");
    expect(entries).toEqual([
      {
        method: "POST",
        route: "/v1/tools/:name",
        status: 200,
        ms: expect.any(Number),
        tool: "validate_markup",
      },
      { method: "GET", route: "/healthz", status: 200, ms: expect.any(Number) },
    ]);
    const text = JSON.stringify(entries);
    for (const secret of ["private", "secret-key", "9.9.9.9"]) expect(text).not.toContain(secret);
  });
});
