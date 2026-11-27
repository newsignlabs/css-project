import { type ChildProcess, spawn } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BuildPageOutput } from "../../src/schemas/index.ts";

// specs/003 T031 — the built server with --transport http, driven by the MCP SDK's Streamable HTTP client.

const bin = new URL("../../dist/index.js", import.meta.url).pathname;
let child: ChildProcess;
let base: string;

beforeAll(async () => {
  child = spawn(process.execPath, [bin, "--transport", "http", "--port", "0"], {
    env: { ...process.env, NEWBRUSH_MCP_API_KEYS: "e2e-key" },
    stdio: ["ignore", "ignore", "pipe"],
  });
  base = await new Promise<string>((resolve, reject) => {
    let err = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      err += chunk.toString();
      const url = /listening on (http:\/\/\S+)\/mcp/.exec(err)?.[1];
      if (url) resolve(url);
    });
    child.once("exit", (code) => reject(new Error(`server exited (${code}): ${err}`)));
  });
});
afterAll(() => {
  child.kill("SIGTERM");
});

describe("newbrush-mcp over Streamable HTTP", () => {
  it("serves MCP to the SDK client with an API key", async () => {
    const client = new Client({ name: "newbrush-e2e-http", version: "0.0.0" });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`${base}/mcp`), {
        requestInit: { headers: { authorization: "Bearer e2e-key" } },
      }),
    );
    expect(client.getServerVersion()?.name).toBe("newbrush");
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(10);
    const r = await client.callTool({
      name: "build_page",
      arguments: { title: "HTTP", sections: [{ type: "hero", props: { title: "Over HTTP" } }] },
    });
    expect(BuildPageOutput.parse(r.structuredContent).html).toContain("Over HTTP");
    await client.close();
  });

  it("serves the REST mirror and the health check", async () => {
    expect(await (await fetch(`${base}/healthz`)).json()).toMatchObject({ ok: true });
    expect(
      (await fetch(`${base}/v1/tools/get_component`, { method: "POST", body: "{}" })).status,
    ).toBe(401);
    const res = await fetch(`${base}/v1/tools/get_component`, {
      method: "POST",
      headers: { "x-api-key": "e2e-key", "content-type": "application/json" },
      body: JSON.stringify({ name: "card" }),
    });
    expect((await res.json()).result.className).toBe("nb-card");
  });
});
