// specs/001 T083 — playground share links: `#code=` + base64url(deflate-raw(html)). Web Streams only, so the same code
// runs in the browser (the playground) and in Node during the build ("Open in playground" links on every example).

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const fromBase64Url = (text: string): Uint8Array<ArrayBuffer> => {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
};

async function through(
  bytes: Uint8Array<ArrayBuffer>,
  stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array<ArrayBuffer>> {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** HTML → the value of a playground `#code=` hash. */
export async function encode(html: string): Promise<string> {
  return toBase64Url(
    await through(new TextEncoder().encode(html), new CompressionStream("deflate-raw")),
  );
}

/** The value of a `#code=` hash → HTML. Throws on anything that is not a valid share code. */
export async function decode(code: string): Promise<string> {
  const bytes = await through(fromBase64Url(code), new DecompressionStream("deflate-raw"));
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

/** The `#code=` value of a URL hash, if any. */
export const codeFromHash = (hash: string): string | undefined =>
  new URLSearchParams(hash.replace(/^#/, "")).get("code") ?? undefined;
