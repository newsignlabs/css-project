// specs/001 T083 — the playground page: an editor, a sandboxed preview and share links. The engine runs in a worker
// (worker.ts); the preview iframe has no `allow-scripts`, so pasted markup can never run code.
import cssHref from "newbrush/css?url";
import { codeFromHash, decode, encode } from "./share.ts";
import type { PlaygroundRequest, PlaygroundResponse } from "./worker.ts";

export const STARTER = `<div class="nb-stack p-6">
  <h1 class="text-2xl font-semibold">Hello newBrush</h1>
  <p class="text-muted">Edit this HTML: components, utilities and themes update as you type.</p>
  <div class="nb-cluster">
    <button class="nb-btn nb-btn--primary" type="button">Primary</button>
    <button class="nb-btn" type="button">Secondary</button>
  </div>
  <article class="nb-card max-w-sm">
    <div class="nb-card__body">A card, sized with the <code>max-w-sm</code> utility.</div>
  </article>
</div>
`;

const escapeAttr = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

export function startPlayground(root: HTMLElement): void {
  const $ = <T extends Element>(selector: string) => root.querySelector<T>(selector) as T;
  const editor = $<HTMLTextAreaElement>("[data-pg=editor]");
  const iframe = $<HTMLIFrameElement>("[data-pg=preview]");
  const frame = $<HTMLElement>("[data-pg=frame]");
  const status = $<HTMLElement>("[data-pg=status]");
  const output = $<HTMLElement>("[data-pg=css]");
  const issues = $<HTMLElement>("[data-pg=issues]");
  const stats = $<HTMLElement>("[data-pg=stats]");
  const control = <T extends HTMLElement>(name: string) => $<T>(`[data-control="${name}"]`);
  const theme = control<HTMLSelectElement>("theme");
  const style = control<HTMLSelectElement>("style");
  const width = control<HTMLSelectElement>("width");
  const dir = control<HTMLButtonElement>("dir");

  const stylesheet = new URL(cssHref, location.href).href;
  const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  let css = "";
  let requestId = 0;
  let statusTimer: ReturnType<typeof setTimeout> | undefined;

  const say = (message: string) => {
    status.textContent = message;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      status.textContent = "";
    }, 3000);
  };

  /** Rebuilds the preview from the editor, the last generated CSS and the toolbar. */
  const render = () => {
    const attrs = [
      // "Page" follows the site's theme picker (the iframe is a separate document, so pass it on).
      ` data-nb-theme="${escapeAttr(theme.value || document.documentElement.dataset.nbTheme || "light")}"`,
      style.value && ` data-nb-style="${escapeAttr(style.value)}"`,
      dir.getAttribute("aria-pressed") === "true" && ' dir="rtl"',
    ]
      .filter(Boolean)
      .join("");
    iframe.srcdoc =
      `<!doctype html><html lang="en"${attrs}><head><meta charset="utf-8">` +
      `<link rel="stylesheet" href="${escapeAttr(stylesheet)}">` +
      `<style>body{padding:1rem}</style><style>${css.replace(/<\/style/gi, "<\\/style")}</style>` +
      `</head><body>${editor.value}</body></html>`;
  };

  worker.onmessage = (event: MessageEvent<PlaygroundResponse>) => {
    const r = event.data;
    if (r.id !== requestId) return; // a newer edit is on its way
    if (!r.ok) {
      issues.replaceChildren(item(`Engine error: ${r.error}`));
      return;
    }
    css = r.css;
    render();
    output.textContent = r.used.length ? r.css : "/* No utility classes in this markup yet. */";
    stats.textContent = `(${r.used.length} utilities, ${r.ms.toFixed(1)} ms)`;
    issues.replaceChildren(
      ...r.rejected.map((d) => item(`${d.class}: ${d.message}`)),
      ...r.unknown.map((c) => item(`${c}: not a newBrush class`)),
    );
  };
  const item = (text: string) => {
    const li = document.createElement("li");
    li.textContent = text;
    return li;
  };

  let debounce: ReturnType<typeof setTimeout> | undefined;
  const update = () => {
    clearTimeout(debounce);
    debounce = setTimeout(async () => {
      requestId++;
      worker.postMessage({ id: requestId, html: editor.value } satisfies PlaygroundRequest);
      history.replaceState(null, "", `#code=${await encode(editor.value)}`);
    }, 150);
  };

  const load = async () => {
    const code = codeFromHash(location.hash);
    if (code) {
      try {
        editor.value = await decode(code);
      } catch {
        editor.value = STARTER;
        say("That link could not be read, so the starter example is shown.");
      }
    } else if (!editor.value) editor.value = STARTER;
    render();
    update();
  };

  editor.addEventListener("input", update);
  // Tab indents; Escape then Tab leaves the editor (no keyboard trap).
  let escaped = false;
  editor.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      escaped = true;
      return;
    }
    if (e.key === "Tab" && !e.shiftKey && !escaped) {
      e.preventDefault();
      editor.setRangeText("  ", editor.selectionStart, editor.selectionEnd, "end");
      update();
    }
    escaped = false;
  });
  theme.addEventListener("change", render);
  new MutationObserver(() => theme.value || render()).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-nb-theme"],
  });
  style.addEventListener("change", render);
  width.addEventListener("change", () => {
    frame.style.maxInlineSize = width.value ? `${width.value}px` : "";
  });
  dir.addEventListener("click", () => {
    dir.setAttribute("aria-pressed", String(dir.getAttribute("aria-pressed") !== "true"));
    render();
  });
  const copy = async (text: string, done: string) => {
    try {
      await navigator.clipboard.writeText(text);
      say(done);
    } catch {
      say("Copy failed");
    }
  };
  control("copy-link").addEventListener("click", () => copy(location.href, "Link copied"));
  control("copy-html").addEventListener("click", () => copy(editor.value, "HTML copied"));
  control("reset").addEventListener("click", () => {
    editor.value = STARTER;
    update();
    render();
  });
  addEventListener("hashchange", load);
  void load();
}
