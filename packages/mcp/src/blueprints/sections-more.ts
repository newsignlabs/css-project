// specs/003 T019–T022 (second set) — more section blueprints: logos, split features, stats, blog posts, forms, empty
// and error states, and dashboards. Same rules as sections.ts: newBrush classes only, escaped text, safe URLs.
import { z } from "zod";
import { html, type SafeHtml } from "../html/index.ts";
import {
  Cta,
  cta,
  defineBlueprint,
  heading,
  href,
  Image,
  Inline,
  image,
  Link,
  raw,
  rich,
  subheading,
  Text,
} from "./_core.ts";

const none = raw("");
const when = (ok: unknown, content: () => SafeHtml): SafeHtml => (ok ? content() : none);
const labelled = (ctx: { id: string }, title: string | undefined, fallback: string) =>
  title ? html`aria-labelledby="${ctx.id}-title"` : html`aria-label="${fallback}"`;

export const logoCloud = defineBlueprint({
  name: "logo-cloud",
  title: "Logo cloud",
  description: "A row of customer or partner logos, optionally linked, with an optional heading.",
  variants: ["default"],
  region: "main",
  titled: (p) => Boolean((p as { title?: string }).title),
  props: z
    .object({
      title: Text(120).optional(),
      logos: z
        .array(
          z
            .object({
              src: z.string().max(2048),
              alt: Text(120),
              href: z.string().max(2048).optional(),
            })
            .strict(),
        )
        .min(1)
        .max(12),
    })
    .strict(),
  example: {
    title: "Roasters we work with",
    logos: [
      { src: "https://images.example.com/north.svg", alt: "North Roast" },
      {
        src: "https://images.example.com/hill.svg",
        alt: "Hillside Coffee",
        href: "https://hillside.example",
      },
      { src: "https://images.example.com/bean.svg", alt: "Bean & Co." },
    ],
  },
  render: (
    p,
    _v,
    ctx,
  ) => html`<section id="${ctx.id}" class="py-12" ${labelled(ctx, p.title, "Logos")}>
  <div class="nb-container nb-stack text-center">
    ${when(p.title, () => heading(ctx, p.title as string, "text-lg font-semibold text-muted"))}
    <ul class="nb-cluster nb-cluster--center">
      ${p.logos.map((l, i) => {
        const img = html`<img src="${href(ctx, l.src, `logos[${i}].src`)}" alt="${l.alt}" class="h-12" loading="lazy">`;
        return html`<li>${l.href ? html`<a href="${href(ctx, l.href, `logos[${i}].href`)}">${img}</a>` : img}</li>`;
      })}
    </ul>
  </div>
</section>`,
});

export const featureSplit = defineBlueprint({
  name: "feature-split",
  title: "Feature split",
  description:
    "One feature in depth: text, bullet points and an action beside an image, image first or last.",
  variants: ["image-end", "image-start"],
  region: "main",
  titled: () => true,
  props: z
    .object({
      title: Text(120),
      text: Inline(600).optional(),
      points: z.array(Text(160)).max(8).default([]),
      cta: Cta.optional(),
      image: Image,
    })
    .strict(),
  example: {
    title: "Tasting notes on every bag",
    text: "Each roast comes with notes from the roaster, so you know what to expect <em>before</em> the first cup.",
    points: [
      "Origin and altitude",
      "Process and roast date",
      "Brew recipes for filter and espresso",
    ],
    cta: { text: "See this month's roasts", href: "/roasts" },
    image: {
      src: "https://images.example.com/notes.jpg",
      alt: "A tasting card next to a bag of coffee",
    },
  },
  render: (
    p,
    variant,
    ctx,
  ) => html`<section id="${ctx.id}" class="py-16" aria-labelledby="${ctx.id}-title">
  <div class="nb-container grid gap-8 items-center md:grid-cols-2">
    <div class="nb-stack">
      ${heading(ctx, p.title, "text-3xl font-bold")}
      ${when(p.text, () => html`<p class="text-lg text-muted">${rich(p.text)}</p>`)}
      ${when(p.points.length, () => html`<ul class="nb-stack list-disc ps-6">${p.points.map((x) => html`<li>${x}</li>`)}</ul>`)}
      ${when(p.cta, () => html`<p>${cta(ctx, p.cta as z.infer<typeof Cta>, "cta")}</p>`)}
    </div>
    ${image(ctx, p.image, "image", `rounded-xl w-full${variant === "image-start" ? " md:order-first" : ""}`)}
  </div>
</section>`,
});

const Stat = z
  .object({ value: Text(30), label: Text(80), description: Text(200).optional() })
  .strict();

export const stats = defineBlueprint({
  name: "stats",
  title: "Stats",
  description: "Key numbers with labels, as a plain row or as cards.",
  variants: ["default", "cards"],
  region: "main",
  titled: (p) => Boolean((p as { title?: string }).title),
  props: z.object({ title: Text(120).optional(), stats: z.array(Stat).min(1).max(8) }).strict(),
  example: {
    title: "Brewly in numbers",
    stats: [
      { value: "12,400", label: "Subscribers" },
      { value: "38", label: "Roasters", description: "Across 9 countries" },
      { value: "4.9", label: "Average rating" },
    ],
  },
  render: (
    p,
    variant,
    ctx,
  ) => html`<section id="${ctx.id}" class="py-12" ${labelled(ctx, p.title, "Key figures")}>
  <div class="nb-container nb-stack">
    ${when(p.title, () => heading(ctx, p.title as string, "text-3xl font-bold"))}
    <dl class="nb-grid">
      ${p.stats.map((s) => {
        const body = html`<dt class="text-muted">${s.label}</dt>
        <dd class="text-3xl font-bold">${s.value}</dd>
        ${when(s.description, () => html`<dd class="text-sm text-muted">${s.description}</dd>`)}`;
        // <dt>/<dd> may only sit directly in the <dl> or one <div> deep, so the card div holds them itself.
        return variant === "cards"
          ? html`<div class="nb-card nb-stack p-6">${body}</div>`
          : html`<div class="nb-stack">${body}</div>`;
      })}
    </dl>
  </div>
</section>`,
});

export const blogList = defineBlueprint({
  name: "blog-list",
  title: "Blog list",
  description: "Recent posts with title, date, excerpt and author, as cards or as a list.",
  variants: ["cards", "list"],
  region: "main",
  titled: () => true,
  props: z
    .object({
      title: Text(120),
      posts: z
        .array(
          z
            .object({
              title: Text(160),
              href: z.string().max(2048),
              date: z
                .string()
                .regex(/^\d{4}-\d{2}-\d{2}$/)
                .describe("YYYY-MM-DD"),
              excerpt: Inline(400).optional(),
              author: Text(80).optional(),
              image: Image.optional(),
            })
            .strict(),
        )
        .min(1)
        .max(12),
    })
    .strict(),
  example: {
    title: "From the journal",
    posts: [
      {
        title: "How to dial in a new bag",
        href: "/journal/dial-in",
        date: "2026-11-02",
        excerpt: "Grind, ratio, time: a five-minute routine.",
        author: "Mara",
      },
      {
        title: "Meet Hillside Coffee",
        href: "/journal/hillside",
        date: "2026-10-18",
        excerpt: "A family farm at 1,800 m.",
      },
    ],
  },
  render: (p, variant, ctx) => {
    const post = (x: (typeof p.posts)[number], i: number) => {
      const meta = html`<p class="text-sm text-muted"><time datetime="${x.date}">${x.date}</time>${when(x.author, () => html` · ${x.author}`)}</p>`;
      const title = html`<a href="${href(ctx, x.href, `posts[${i}].href`)}">${x.title}</a>`;
      if (variant === "list")
        return html`<li class="nb-stack">${subheading(ctx, title, "text-lg font-semibold")}${meta}${when(x.excerpt, () => html`<p>${rich(x.excerpt)}</p>`)}</li>`;
      return html`<article class="nb-card">
        ${when(x.image, () => image(ctx, x.image as z.infer<typeof Image>, `posts[${i}].image`, "nb-card__media"))}
        <div class="nb-card__body nb-stack">
          ${subheading(ctx, title, "nb-card__title")}
          ${meta}
          ${when(x.excerpt, () => html`<p class="text-muted">${rich(x.excerpt)}</p>`)}
        </div>
      </article>`;
    };
    return html`<section id="${ctx.id}" class="py-16" aria-labelledby="${ctx.id}-title">
  <div class="nb-container nb-stack">
    ${heading(ctx, p.title, "text-3xl font-bold")}
    ${variant === "list" ? html`<ul class="nb-stack">${p.posts.map(post)}</ul>` : html`<div class="nb-grid">${p.posts.map(post)}</div>`}
  </div>
</section>`;
  },
});

/** A labelled form field (nb-field) with an input or textarea. */
function field(
  ctx: { id: string },
  name: string,
  label: string,
  type: string,
  autocomplete: string,
  required: boolean,
  hint?: string,
): SafeHtml {
  const id = `${ctx.id}-${name}`;
  const req = raw(required ? " required" : "");
  const describedBy = hint ? html` aria-describedby="${id}-hint"` : raw("");
  const control =
    type === "textarea"
      ? html`<textarea class="nb-input" id="${id}" name="${name}" rows="5"${req}${describedBy}></textarea>`
      : html`<input class="nb-input" id="${id}" name="${name}" type="${type}" autocomplete="${autocomplete}"${req}${describedBy}>`;
  return html`<div class="nb-field">
        <label class="nb-field__label" for="${id}">${label}${when(required, () => html` <span class="nb-field__required" aria-hidden="true">*</span>`)}</label>
        ${control}
        ${when(hint, () => html`<p class="nb-field__hint" id="${id}-hint">${hint}</p>`)}
      </div>`;
}

export const contactForm = defineBlueprint({
  name: "contact-form",
  title: "Contact form",
  description:
    "A contact form (name, email, optional subject, message) that posts to your endpoint.",
  variants: ["default"],
  region: "main",
  titled: () => true,
  props: z
    .object({
      title: Text(120),
      intro: Inline(400).optional(),
      action: z
        .string()
        .max(2048)
        .describe("Where the form posts, e.g. /contact or https://forms.example/abc"),
      subject: z.boolean().optional().describe("Add a subject field"),
      submit: Text(40).default("Send message"),
    })
    .strict(),
  example: {
    title: "Talk to us",
    intro: "Questions about an order or wholesale? We reply within a day.",
    action: "/contact",
    subject: true,
  },
  render: (
    p,
    _v,
    ctx,
  ) => html`<section id="${ctx.id}" class="py-16" aria-labelledby="${ctx.id}-title">
  <div class="nb-container nb-container--narrow nb-stack">
    ${heading(ctx, p.title, "text-3xl font-bold")}
    ${when(p.intro, () => html`<p class="text-lg text-muted">${rich(p.intro)}</p>`)}
    <form class="nb-stack" action="${href(ctx, p.action, "action")}" method="post">
      ${field(ctx, "name", "Name", "text", "name", true)}
      ${field(ctx, "email", "Email", "email", "email", true, "We only use it to reply.")}
      ${when(p.subject, () => field(ctx, "subject", "Subject", "text", "off", false))}
      ${field(ctx, "message", "Message", "textarea", "off", true)}
      <p><button class="nb-btn nb-btn--primary" type="submit">${p.submit}</button></p>
    </form>
    <p class="text-sm text-muted"><span aria-hidden="true">*</span> Required</p>
  </div>
</section>`,
});

export const authForm = defineBlueprint({
  name: "auth-form",
  title: "Sign-in / sign-up form",
  description:
    "An account form in a card: sign in (email, password, forgot link) or sign up (name, email, new password).",
  variants: ["sign-in", "sign-up"],
  region: "main",
  titled: () => true,
  props: z
    .object({
      title: Text(120),
      action: z.string().max(2048),
      submit: Text(40).optional(),
      forgotHref: z.string().max(2048).optional(),
      switchLink: Link.optional().describe('E.g. { text: "Create an account", href: "/sign-up" }'),
    })
    .strict(),
  example: {
    title: "Welcome back",
    action: "/session",
    forgotHref: "/password/reset",
    switchLink: { text: "Create an account", href: "/sign-up" },
  },
  render: (p, variant, ctx) => {
    const signUp = variant === "sign-up";
    return html`<section id="${ctx.id}" class="py-16" aria-labelledby="${ctx.id}-title">
  <div class="nb-container nb-container--narrow">
    <div class="nb-card nb-card--elevated max-w-md mx-auto">
      <div class="nb-card__body nb-stack">
        ${heading(ctx, p.title, "text-2xl font-bold")}
        <form class="nb-stack" action="${href(ctx, p.action, "action")}" method="post">
          ${when(signUp, () => field(ctx, "name", "Name", "text", "name", true))}
          ${field(ctx, "email", "Email", "email", signUp ? "email" : "username", true)}
          ${field(ctx, "password", "Password", "password", signUp ? "new-password" : "current-password", true, signUp ? "At least 12 characters." : undefined)}
          <button class="nb-btn nb-btn--primary nb-btn--block" type="submit">${p.submit ?? (signUp ? "Create account" : "Sign in")}</button>
        </form>
        ${when(!signUp && p.forgotHref, () => html`<p class="text-sm"><a href="${href(ctx, p.forgotHref as string, "forgotHref")}">Forgot your password?</a></p>`)}
        ${when(p.switchLink, () => html`<p class="text-sm"><a href="${href(ctx, (p.switchLink as z.infer<typeof Link>).href, "switchLink.href")}">${(p.switchLink as z.infer<typeof Link>).text}</a></p>`)}
      </div>
    </div>
  </div>
</section>`;
  },
});

export const emptyState = defineBlueprint({
  name: "empty-state",
  title: "Empty state",
  description:
    "What to show when there is nothing yet: a short message, a decorative symbol and the next step.",
  variants: ["default"],
  region: "main",
  titled: () => true,
  props: z
    .object({
      title: Text(120),
      text: Inline(400).optional(),
      icon: z.string().max(8).optional(),
      cta: Cta.optional(),
    })
    .strict(),
  example: {
    title: "No deliveries yet",
    text: "Your first bag ships within two days of subscribing.",
    icon: "📦",
    cta: { text: "Choose a plan", href: "/plans" },
  },
  render: (
    p,
    _v,
    ctx,
  ) => html`<section id="${ctx.id}" class="py-16" aria-labelledby="${ctx.id}-title">
  <div class="nb-container nb-container--narrow nb-stack text-center">
    ${when(p.icon, () => html`<p class="text-5xl" aria-hidden="true">${p.icon}</p>`)}
    ${heading(ctx, p.title, "text-2xl font-bold")}
    ${when(p.text, () => html`<p class="text-muted">${rich(p.text)}</p>`)}
    ${when(p.cta, () => html`<p>${cta(ctx, p.cta as z.infer<typeof Cta>, "cta")}</p>`)}
  </div>
</section>`,
});

export const notFound = defineBlueprint({
  name: "not-found",
  title: "Not found (404)",
  description: "A friendly 404 page section with a way home.",
  variants: ["default"],
  region: "main",
  titled: () => true,
  props: z
    .object({
      title: Text(120).default("Page not found"),
      text: Inline(400).optional(),
      home: Cta.default({ text: "Go to the home page", href: "/" }),
      secondary: Cta.optional(),
    })
    .strict(),
  example: {
    title: "This page took a coffee break",
    text: "The link may be old, or the page has moved.",
    home: { text: "Back to the home page", href: "/" },
    secondary: { text: "Contact us", href: "/contact" },
  },
  render: (
    p,
    _v,
    ctx,
  ) => html`<section id="${ctx.id}" class="py-16" aria-labelledby="${ctx.id}-title">
  <div class="nb-container nb-container--narrow nb-stack text-center">
    <p class="text-5xl font-bold text-accent">404</p>
    ${heading(ctx, p.title, "text-3xl font-bold")}
    ${when(p.text, () => html`<p class="text-lg text-muted">${rich(p.text)}</p>`)}
    <div class="nb-cluster nb-cluster--center">
      ${cta(ctx, p.home, "home")}
      ${when(p.secondary, () => cta(ctx, p.secondary as z.infer<typeof Cta>, "secondary", "secondary"))}
    </div>
  </div>
</section>`,
});

export const dashboardShell = defineBlueprint({
  name: "dashboard-shell",
  title: "Dashboard header",
  description: "The top bar of an app or dashboard: product name, sections and the signed-in user.",
  variants: ["default"],
  region: "header",
  titled: () => false,
  props: z
    .object({
      brand: Text(60),
      links: z.array(Link).max(8).default([]),
      user: Text(80).optional(),
      signOutHref: z.string().max(2048).optional(),
    })
    .strict(),
  example: {
    brand: "Brewly Admin",
    links: [
      { text: "Overview", href: "/admin", current: true },
      { text: "Orders", href: "/admin/orders" },
      { text: "Roasters", href: "/admin/roasters" },
    ],
    user: "Mara K.",
    signOutHref: "/sign-out",
  },
  render: (p, _v, ctx) => html`<header class="nb-navbar" id="${ctx.id}">
  <a class="nb-navbar__brand" href="/">${p.brand}</a>
  ${when(
    p.links.length,
    () => html`<nav class="nb-navbar__nav" aria-label="App">
    <ul class="nb-navbar__links">
      ${p.links.map((l, i) => html`<li><a class="nb-navbar__link" href="${href(ctx, l.href, `links[${i}].href`)}"${raw(l.current ? ' aria-current="page"' : "")}>${l.text}</a></li>`)}
    </ul>
  </nav>`,
  )}
  ${when(
    p.user || p.signOutHref,
    () => html`<div class="nb-navbar__actions">
    ${when(p.user, () => html`<span class="text-sm">${p.user}</span>`)}
    ${when(p.signOutHref, () => html`<a class="nb-btn nb-btn--ghost nb-btn--sm" href="${href(ctx, p.signOutHref as string, "signOutHref")}">Sign out</a>`)}
  </div>`,
  )}
</header>`,
});

export const sidebarLayout = defineBlueprint({
  name: "sidebar-layout",
  title: "Sidebar layout",
  description:
    "A side navigation next to the main content: a heading, optional stats and content cards.",
  variants: ["default"],
  region: "main",
  titled: () => true,
  props: z
    .object({
      title: Text(120),
      nav: z.array(Link).min(1).max(12),
      stats: z.array(Stat).max(6).default([]),
      cards: z
        .array(z.object({ title: Text(120), text: Inline(600) }).strict())
        .max(9)
        .default([]),
    })
    .strict(),
  example: {
    title: "Overview",
    nav: [
      { text: "Today", href: "#today", current: true },
      { text: "This week", href: "#week" },
      { text: "Settings", href: "/admin/settings" },
    ],
    stats: [
      { value: "214", label: "Orders today" },
      { value: "$4,810", label: "Revenue today" },
    ],
    cards: [
      {
        title: "Next shipment",
        text: "Hillside Coffee, 120 bags, leaves <strong>Thursday</strong>.",
      },
    ],
  },
  render: (
    p,
    _v,
    ctx,
  ) => html`<section id="${ctx.id}" class="py-8" aria-labelledby="${ctx.id}-title">
  <div class="nb-container nb-sidebar">
    <nav aria-label="Sections">
      <ul class="nb-stack">
        ${p.nav.map((l, i) => html`<li><a href="${href(ctx, l.href, `nav[${i}].href`)}"${raw(l.current ? ' aria-current="page"' : "")}>${l.text}</a></li>`)}
      </ul>
    </nav>
    <div class="nb-stack">
      ${heading(ctx, p.title, "text-2xl font-bold")}
      ${when(
        p.stats.length,
        () =>
          html`<dl class="nb-grid">${p.stats.map((s) => html`<div class="nb-card nb-stack p-6"><dt class="text-muted">${s.label}</dt><dd class="text-2xl font-bold">${s.value}</dd></div>`)}</dl>`,
      )}
      ${p.cards.map(
        (c) =>
          html`<article class="nb-card"><div class="nb-card__body nb-stack">${heading(ctx, c.title, "nb-card__title", true)}<p>${rich(c.text)}</p></div></article>`,
      )}
    </div>
  </div>
</section>`,
});

export const tableView = defineBlueprint({
  name: "table-view",
  title: "Table view",
  description:
    "A data table with a caption, column headers and numeric alignment, scrollable on small screens.",
  variants: ["default", "striped"],
  region: "main",
  titled: () => true,
  props: z
    .object({
      title: Text(120),
      caption: Text(200).optional(),
      columns: z
        .array(
          z.object({ key: Text(40), label: Text(80), numeric: z.boolean().optional() }).strict(),
        )
        .min(1)
        .max(12),
      rows: z.array(z.record(z.string(), z.string().max(200))).max(200),
    })
    .strict(),
  example: {
    title: "Recent orders",
    caption: "The last five orders",
    columns: [
      { key: "id", label: "Order" },
      { key: "customer", label: "Customer" },
      { key: "plan", label: "Plan" },
      { key: "total", label: "Total", numeric: true },
    ],
    rows: [
      { id: "#1042", customer: "Amira K.", plan: "Regular", total: "$22.00" },
      { id: "#1041", customer: "Jonas P.", plan: "Office", total: "$59.00" },
      { id: "#1040", customer: "Lena W.", plan: "Taster", total: "$12.00" },
    ],
  },
  render: (
    p,
    variant,
    ctx,
  ) => html`<section id="${ctx.id}" class="py-8" aria-labelledby="${ctx.id}-title">
  <div class="nb-container nb-stack">
    ${heading(ctx, p.title, "text-2xl font-bold")}
    <section class="nb-table-wrap" tabindex="0" ${p.caption ? html`aria-labelledby="${ctx.id}-caption"` : html`aria-label="${p.title} (table)"`}>
      <table class="nb-table${raw(variant === "striped" ? " nb-table--striped" : "")}">
        ${when(p.caption, () => html`<caption id="${ctx.id}-caption">${p.caption}</caption>`)}
        <thead><tr>${p.columns.map((c) => html`<th scope="col"${raw(c.numeric ? ' class="nb-table__num"' : "")}>${c.label}</th>`)}</tr></thead>
        <tbody>
          ${p.rows.map((r) => html`<tr>${p.columns.map((c) => html`<td${raw(c.numeric ? ' class="nb-table__num"' : "")}>${r[c.key] ?? ""}</td>`)}</tr>`)}
        </tbody>
      </table>
    </section>
  </div>
</section>`,
});
