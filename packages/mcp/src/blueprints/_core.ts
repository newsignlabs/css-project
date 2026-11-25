// specs/003 T018 — the blueprint framework. A blueprint turns validated props into one page section, built only
// from newBrush components and utilities. Every text is escaped, rich text goes through the inline sanitizer, and
// every URL through the allow-list, so a section can never carry script.
import { z } from "zod";
import { escapeHtml, html, SafeHtml, safeUrl, sanitizeInline } from "../html/index.ts";

export { escapeHtml, html };

import type { Diagnostic } from "../schemas/index.ts";

/** Typed slots: the building blocks of blueprint props. */
export const Text = (max = 200) => z.string().min(1).max(max);
export const Inline = (max = 1000) =>
  z.string().max(max).describe("Text; may use <strong> <em> <code> <a href> <br>");
export const Url = z
  .string()
  .max(2048)
  .describe("http(s), mailto:, tel:, a relative path or #fragment");
export const Cta = z.object({ text: Text(60), href: Url }).strict();
export const Link = z
  .object({ text: Text(60), href: Url, current: z.boolean().optional() })
  .strict();
export const Image = z
  .object({
    src: Url,
    alt: z.string().max(300).optional().describe('Describe the image; "" marks it decorative'),
  })
  .strict();

export interface RenderContext {
  /** The section's id, unique on the page; prefix other ids with it. */
  id: string;
  /** Heading level for the section title: 1 for the first titled section, otherwise 2. */
  level: 1 | 2;
  /** Path of this section in the PageSpec, for diagnostics ("sections[2].props"). */
  path: string;
  diagnostics: Diagnostic[];
}

export interface Blueprint<S extends z.ZodType = z.ZodType> {
  name: string;
  title: string;
  description: string;
  variants: readonly string[];
  /** Where the section goes in the page: the banner, the main content, or the content info. */
  region: "header" | "main" | "footer";
  /** Whether the section shows a heading with these props (the page's first titled section gets the h1). */
  titled: (props: z.output<S>) => boolean;
  props: S;
  /** Example props, used by the newbrush://sections resource, docs and the test matrix. */
  example: z.input<S>;
  render(props: z.output<S>, variant: string, ctx: RenderContext): SafeHtml;
}

export const defineBlueprint = <S extends z.ZodType>(b: Blueprint<S>): Blueprint<S> => b;

/** A URL that passed the allow-list, or "#" with an NB_UNSAFE_URL diagnostic. */
export function href(ctx: RenderContext, url: string, field: string): string {
  const safe = safeUrl(url);
  if (safe !== undefined) return safe;
  ctx.diagnostics.push({
    code: "NB_UNSAFE_URL",
    severity: "warning",
    message: `Unsafe URL replaced with "#": ${url.slice(0, 80)}`,
    path: `${ctx.path}.${field}`,
  });
  return "#";
}

export const rich = (text: string | undefined): SafeHtml => sanitizeInline(text ?? "");

export function heading(ctx: RenderContext, text: string, classes = "", sub = false): SafeHtml {
  const level = sub ? ctx.level + 1 : ctx.level;
  const tag = `h${level}`;
  const cls = classes ? ` class="${escapeHtml(classes)}"` : "";
  const id = sub ? "" : ` id="${escapeHtml(ctx.id)}-title"`;
  return html`${raw(`<${tag}${id}${cls}>`)}${text}${raw(`</${tag}>`)}`;
}

/** A heading one level below the section's, holding markup (e.g. a link), for items inside a section. */
export function subheading(ctx: RenderContext, content: SafeHtml, classes: string): SafeHtml {
  const tag = `h${ctx.level + 1}`;
  return html`${raw(`<${tag} class="${escapeHtml(classes)}">`)}${content}${raw(`</${tag}>`)}`;
}

export function cta(
  ctx: RenderContext,
  c: z.infer<typeof Cta>,
  field: string,
  kind: "primary" | "secondary" | "ghost" = "primary",
  size = "",
): SafeHtml {
  const variant =
    kind === "primary" ? " nb-btn--primary" : kind === "ghost" ? " nb-btn--ghost" : "";
  const sz = size ? ` nb-btn--${size}` : "";
  return html`<a class="nb-btn${raw(variant + sz)}" href="${href(ctx, c.href, field)}">${c.text}</a>`;
}

export function image(
  ctx: RenderContext,
  img: z.infer<typeof Image>,
  field: string,
  classes = "",
): SafeHtml {
  if (img.alt === undefined)
    ctx.diagnostics.push({
      code: "NB_MISSING_ALT",
      severity: "warning",
      message:
        'Image has no alt text; it is treated as decorative (alt=""). Describe it if it carries meaning.',
      path: `${ctx.path}.${field}.alt`,
    });
  const cls = classes ? html` class="${classes}"` : raw("");
  return html`<img src="${href(ctx, img.src, `${field}.src`)}" alt="${img.alt ?? ""}"${cls} loading="lazy">`;
}

/** Trusted markup written by a blueprint itself (tags and fixed class names, never user text). */
export const raw = (markup: string): SafeHtml => new SafeHtml(markup);
