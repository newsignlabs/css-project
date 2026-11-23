// specs/001 T083 — the playground's engine, off the main thread: HTML in, utility CSS and diagnostics out.
import { BUILT_IN_STYLES, createEngine, type Diagnostic } from "@newbrush/engine";

export interface PlaygroundRequest {
  id: number;
  html: string;
}
export type PlaygroundResponse =
  | {
      id: number;
      ok: true;
      css: string;
      used: string[];
      rejected: Diagnostic[];
      unknown: string[];
      ms: number;
    }
  | { id: number; ok: false; error: string };

const engine = createEngine({ content: ["playground"] });
/** Classes that are newBrush, just not utilities: components (nb-*), design styles and their aliases. */
const notUtilities = new Set([
  "style-default",
  ...BUILT_IN_STYLES.flatMap((s) => [s.name, ...s.aliases]),
]);
// Only class attributes: scanning text would turn ordinary words ("hidden", "table") into utilities.
const classAttr = /\sclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi;

self.onmessage = (event: MessageEvent<PlaygroundRequest>) => {
  const { id, html } = event.data;
  let response: PlaygroundResponse;
  try {
    const classes = new Set<string>();
    for (const m of html.matchAll(classAttr))
      for (const c of (m[1] ?? m[2] ?? m[3] ?? "").split(/\s+/)) if (c) classes.add(c);
    const start = performance.now();
    const result = engine.generate(classes, { reportUnknown: true });
    response = {
      id,
      ok: true,
      css: result.css,
      used: result.classes.used,
      rejected: result.classes.rejected,
      unknown: result.classes.unknown.filter((c) => !c.startsWith("nb-") && !notUtilities.has(c)),
      ms: performance.now() - start,
    };
  } catch (error) {
    response = { id, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  self.postMessage(response);
};
