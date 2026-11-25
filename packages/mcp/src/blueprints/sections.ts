// specs/003 T019–T020 (first set) — section blueprints. Markup uses newBrush components (nb-*) and utilities only;
// every section is a labelled landmark or sits inside one.
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
  Text,
} from "./_core.ts";

const none = raw("");
const when = (ok: unknown, content: () => SafeHtml): SafeHtml => (ok ? content() : none);

export const navbar = defineBlueprint({
  name: "navbar",
  title: "Navigation bar",
  description: "Site header with the brand, main navigation links and an optional call to action.",
  variants: ["default", "sticky"],
  region: "header",
  titled: () => false,
  props: z
    .object({
      brand: Text(60),
      brandHref: z.string().max(2048).optional(),
      links: z.array(Link).max(8).default([]),
      cta: Cta.optional(),
    })
    .strict(),
  example: {
    brand: "Brewly",
    links: [
      { text: "Features", href: "#features" },
      { text: "Pricing", href: "#pricing" },
      { text: "FAQ", href: "#faq" },
    ],
    cta: { text: "Start free", href: "/signup" },
  },
  render: (
    p,
    variant,
    ctx,
  ) => html`<header class="nb-navbar${raw(variant === "sticky" ? " nb-navbar--sticky" : "")}" id="${ctx.id}">
  <a class="nb-navbar__brand" href="${href(ctx, p.brandHref ?? "/", "brandHref")}">${p.brand}</a>
  ${when(
    p.links.length,
    () => html`<nav class="nb-navbar__nav" aria-label="Main">
    <ul class="nb-navbar__links">
      ${p.links.map(
        (l, i) =>
          html`<li><a class="nb-navbar__link" href="${href(ctx, l.href, `links[${i}].href`)}"${raw(l.current ? ' aria-current="page"' : "")}>${l.text}</a></li>`,
      )}
    </ul>
  </nav>`,
  )}
  ${when(p.cta, () => html`<div class="nb-navbar__actions">${cta(ctx, p.cta as z.infer<typeof Cta>, "cta", "primary", "sm")}</div>`)}
</header>`,
});

const heroProps = z
  .object({
    eyebrow: Text(60).optional(),
    title: Text(120),
    subtitle: Inline(400).optional(),
    primary: Cta.optional(),
    secondary: Cta.optional(),
    image: Image.optional(),
    benefits: z
      .array(Text(120))
      .max(8)
      .optional()
      .describe("Bullet points for the product variant"),
  })
  .strict();

export const hero = defineBlueprint({
  name: "hero",
  title: "Hero",
  description:
    "The opening section: headline, supporting text and calls to action; centered, split with an image, text over a background image, a product pitch with benefits, or minimal.",
  variants: ["centered", "split", "image-bg", "product", "minimal"],
  region: "main",
  titled: () => true,
  props: heroProps,
  example: {
    eyebrow: "Fresh every month",
    title: "Coffee from small roasters, at your door",
    subtitle: "Pick a roast, set a rhythm, pause <strong>any time</strong>.",
    primary: { text: "Start your subscription", href: "/signup" },
    secondary: { text: "See the roasters", href: "#roasters" },
    image: {
      src: "https://images.example.com/beans.jpg",
      alt: "Freshly roasted coffee beans in a paper bag",
    },
    benefits: ["Roasted within 48 hours", "Free shipping", "Skip or pause any month"],
  },
  render: (p, variant, ctx) => {
    const actions = when(
      p.primary || p.secondary,
      () => html`<div class="nb-cluster${raw(variant === "centered" ? " nb-cluster--center" : "")}">
      ${when(p.primary, () => cta(ctx, p.primary as z.infer<typeof Cta>, "primary", "primary", "lg"))}
      ${when(p.secondary, () => cta(ctx, p.secondary as z.infer<typeof Cta>, "secondary", "secondary", "lg"))}
    </div>`,
    );
    const text = html`${when(p.eyebrow, () => html`<p class="text-sm font-semibold text-accent">${p.eyebrow}</p>`)}
      ${heading(ctx, p.title, variant === "minimal" ? "text-3xl font-bold" : "text-4xl font-bold")}
      ${when(p.subtitle, () => html`<p class="text-lg text-muted">${rich(p.subtitle)}</p>`)}
      ${actions}`;
    if (variant === "image-bg" && p.image)
      return html`<section id="${ctx.id}" class="relative isolate py-16" aria-labelledby="${ctx.id}-title">
  ${image(ctx, p.image, "image", "absolute inset-0 -z-10 w-full h-full object-cover")}
  <div class="nb-container">
    <div class="nb-card nb-card--elevated max-w-md">
      <div class="nb-card__body nb-stack">
        ${text}
      </div>
    </div>
  </div>
</section>`;
    if (variant === "product")
      return html`<section id="${ctx.id}" class="py-16" aria-labelledby="${ctx.id}-title">
  <div class="nb-container grid gap-8 items-center md:grid-cols-2">
    <div class="nb-stack">
      ${text}
      ${when(p.benefits?.length, () => html`<ul class="nb-stack list-disc ps-6">${(p.benefits ?? []).map((b) => html`<li>${b}</li>`)}</ul>`)}
    </div>
    ${when(p.image, () => image(ctx, p.image as z.infer<typeof Image>, "image", "rounded-xl w-full"))}
  </div>
</section>`;
    if (variant === "split" && p.image)
      return html`<section id="${ctx.id}" class="py-16" aria-labelledby="${ctx.id}-title">
  <div class="nb-container grid gap-8 items-center md:grid-cols-2">
    <div class="nb-stack">
      ${text}
    </div>
    ${image(ctx, p.image, "image", "rounded-xl w-full")}
  </div>
</section>`;
    const layout =
      variant === "minimal"
        ? "nb-container nb-stack"
        : "nb-container nb-container--narrow nb-stack text-center";
    return html`<section id="${ctx.id}" class="${variant === "minimal" ? "py-12" : "py-16"}" aria-labelledby="${ctx.id}-title">
  <div class="${layout}">
    ${text}
  </div>
</section>`;
  },
});

export const featureGrid = defineBlueprint({
  name: "feature-grid",
  title: "Feature grid",
  description: "A heading and a grid of features, as cards or as plain columns.",
  variants: ["cards", "plain"],
  region: "main",
  titled: () => true,
  props: z
    .object({
      title: Text(120),
      intro: Inline(400).optional(),
      features: z
        .array(
          z
            .object({
              title: Text(80),
              text: Inline(400),
              icon: z.string().max(8).optional().describe("A short decorative symbol or emoji"),
            })
            .strict(),
        )
        .min(1)
        .max(12),
    })
    .strict(),
  example: {
    title: "Why Brewly",
    intro: "Everything a good morning needs, nothing it doesn't.",
    features: [
      { icon: "☕", title: "Roasted to order", text: "Beans leave the roaster within 48 hours." },
      {
        icon: "🗓",
        title: "Your rhythm",
        text: "Weekly, fortnightly or monthly. Change it any time.",
      },
      {
        icon: "🌱",
        title: "Fair to farmers",
        text: "Direct trade with <em>published</em> prices.",
      },
    ],
  },
  render: (p, variant, ctx) => {
    const item = (f: (typeof p.features)[number]) => {
      const body = html`${when(f.icon, () => html`<span class="text-2xl" aria-hidden="true">${f.icon}</span>`)}
        ${heading(ctx, f.title, variant === "cards" ? "nb-card__title" : "text-lg font-semibold", true)}
        <p class="text-muted">${rich(f.text)}</p>`;
      return variant === "cards"
        ? html`<article class="nb-card"><div class="nb-card__body nb-stack">${body}</div></article>`
        : html`<div class="nb-stack">${body}</div>`;
    };
    return html`<section id="${ctx.id}" class="py-16" aria-labelledby="${ctx.id}-title">
  <div class="nb-container nb-stack">
    ${heading(ctx, p.title, "text-3xl font-bold")}
    ${when(p.intro, () => html`<p class="text-lg text-muted max-w-prose">${rich(p.intro)}</p>`)}
    <div class="nb-grid">
      ${p.features.map(item)}
    </div>
  </div>
</section>`;
  },
});

export const pricing = defineBlueprint({
  name: "pricing",
  title: "Pricing",
  description:
    "Up to four plans side by side, each with its price, features and a call to action; one can be highlighted.",
  variants: ["default"],
  region: "main",
  titled: () => true,
  props: z
    .object({
      title: Text(120),
      intro: Inline(400).optional(),
      tiers: z
        .array(
          z
            .object({
              name: Text(60),
              price: Text(30),
              period: Text(30).optional(),
              description: Inline(300).optional(),
              features: z.array(Text(120)).max(20).default([]),
              cta: Cta,
              highlighted: z.boolean().optional(),
            })
            .strict(),
        )
        .min(1)
        .max(4),
    })
    .strict(),
  example: {
    title: "Simple plans",
    intro: "Free shipping on every plan. Cancel any time.",
    tiers: [
      {
        name: "Taster",
        price: "$12",
        period: "per bag",
        features: ["250 g bag", "Roaster's choice"],
        cta: { text: "Choose Taster", href: "/signup?plan=taster" },
      },
      {
        name: "Regular",
        price: "$22",
        period: "per month",
        description: "Our most loved plan.",
        features: ["2 × 250 g bags", "Pick your roast", "Pause any time"],
        cta: { text: "Choose Regular", href: "/signup?plan=regular" },
        highlighted: true,
      },
      {
        name: "Office",
        price: "$59",
        period: "per month",
        features: ["2 kg of beans", "Grind options", "Priority support"],
        cta: { text: "Choose Office", href: "/signup?plan=office" },
      },
    ],
  },
  render: (
    p,
    _variant,
    ctx,
  ) => html`<section id="${ctx.id}" class="py-16" aria-labelledby="${ctx.id}-title">
  <div class="nb-container nb-stack">
    ${heading(ctx, p.title, "text-3xl font-bold")}
    ${when(p.intro, () => html`<p class="text-lg text-muted max-w-prose">${rich(p.intro)}</p>`)}
    <div class="nb-grid">
      ${p.tiers.map(
        (t, i) => html`<article class="nb-card${raw(t.highlighted ? " nb-card--elevated" : "")}">
        <header class="nb-card__header">
          ${heading(ctx, t.name, "nb-card__title", true)}
          ${when(t.highlighted, () => html`<p><span class="nb-badge">Most popular</span></p>`)}
        </header>
        <div class="nb-card__body nb-stack">
          <p><span class="text-3xl font-bold">${t.price}</span>${when(t.period, () => html` <span class="text-muted">${t.period}</span>`)}</p>
          ${when(t.description, () => html`<p>${rich(t.description)}</p>`)}
          ${when(t.features.length, () => html`<ul class="nb-stack">${t.features.map((f) => html`<li>${f}</li>`)}</ul>`)}
        </div>
        <footer class="nb-card__footer">${cta(ctx, t.cta, `tiers[${i}].cta`, t.highlighted ? "primary" : "secondary", "")}</footer>
      </article>`,
      )}
    </div>
  </div>
</section>`,
});

export const testimonial = defineBlueprint({
  name: "testimonial",
  title: "Testimonials",
  description: "Quotes from customers: one large quote, or a grid of them.",
  variants: ["single", "grid"],
  region: "main",
  titled: (p) => Boolean((p as { title?: string }).title),
  props: z
    .object({
      title: Text(120).optional(),
      quotes: z
        .array(
          z
            .object({
              quote: Inline(600),
              name: Text(80),
              role: Text(120).optional(),
              avatar: Image.optional(),
            })
            .strict(),
        )
        .min(1)
        .max(9),
    })
    .strict(),
  example: {
    title: "Loved by early risers",
    quotes: [
      {
        quote: "The best coffee I've had at home. The tasting notes are spot on.",
        name: "Amira K.",
        role: "Subscriber since 2024",
      },
      { quote: "Pausing for a holiday took two clicks.", name: "Jonas P.", role: "Regular plan" },
    ],
  },
  render: (p, variant, ctx) => {
    const quotes = variant === "single" ? p.quotes.slice(0, 1) : p.quotes;
    const figure = (
      q: (typeof p.quotes)[number],
      i: number,
    ) => html`<figure class="nb-stack${raw(variant === "single" ? " text-center" : "")}">
        <blockquote class="${variant === "single" ? "text-2xl" : "text-lg"}"><p>${rich(q.quote)}</p></blockquote>
        <figcaption class="nb-cluster${raw(variant === "single" ? " nb-cluster--center" : "")}">
          ${when(q.avatar, () => image(ctx, q.avatar as z.infer<typeof Image>, `quotes[${i}].avatar`, "rounded-full w-12 h-12"))}
          <span><strong>${q.name}</strong>${when(q.role, () => html`<br><span class="text-muted">${q.role}</span>`)}</span>
        </figcaption>
      </figure>`;
    const label = p.title
      ? html`aria-labelledby="${ctx.id}-title"`
      : raw('aria-label="Testimonials"');
    return html`<section id="${ctx.id}" class="py-16" ${label}>
  <div class="nb-container${raw(variant === "single" ? " nb-container--narrow" : "")} nb-stack">
    ${when(p.title, () => heading(ctx, p.title as string, "text-3xl font-bold"))}
    ${variant === "single" ? figure(quotes[0] as (typeof p.quotes)[number], 0) : html`<div class="nb-grid">${quotes.map((q, i) => html`<article class="nb-card"><div class="nb-card__body">${figure(q, i)}</div></article>`)}</div>`}
  </div>
</section>`;
  },
});

export const faq = defineBlueprint({
  name: "faq",
  title: "FAQ",
  description: "Questions and answers as an accordion that works without JavaScript.",
  variants: ["default"],
  region: "main",
  titled: () => true,
  props: z
    .object({
      title: Text(120),
      items: z
        .array(z.object({ question: Text(200), answer: Inline(2000) }).strict())
        .min(1)
        .max(20),
    })
    .strict(),
  example: {
    title: "Questions",
    items: [
      {
        question: "Can I pause my subscription?",
        answer: "Yes. Pause or skip a delivery from your account, any time.",
      },
      {
        question: "Do you ship abroad?",
        answer: 'We ship across the EU and to the UK. See <a href="/shipping">shipping</a>.',
      },
    ],
  },
  render: (
    p,
    _variant,
    ctx,
  ) => html`<section id="${ctx.id}" class="py-16" aria-labelledby="${ctx.id}-title">
  <div class="nb-container nb-container--narrow nb-stack">
    ${heading(ctx, p.title, "text-3xl font-bold")}
    <div class="nb-accordion">
      ${p.items.map(
        (item) => html`<details class="nb-accordion__item" name="${ctx.id}">
        <summary class="nb-accordion__trigger">${item.question}</summary>
        <div class="nb-accordion__panel"><p>${rich(item.answer)}</p></div>
      </details>`,
      )}
    </div>
  </div>
</section>`,
});

export const callToAction = defineBlueprint({
  name: "cta",
  title: "Call to action",
  description: "A closing prompt with a headline and one or two actions, plain or on a band.",
  variants: ["default", "banded"],
  region: "main",
  titled: () => true,
  props: z
    .object({
      title: Text(120),
      text: Inline(400).optional(),
      primary: Cta,
      secondary: Cta.optional(),
    })
    .strict(),
  example: {
    title: "Your first bag ships this week",
    text: "Start today and get 20% off the first month.",
    primary: { text: "Start your subscription", href: "/signup" },
    secondary: { text: "Gift a subscription", href: "/gift" },
  },
  render: (p, variant, ctx) => {
    const inner = html`${heading(ctx, p.title, "text-3xl font-bold")}
      ${when(p.text, () => html`<p class="text-lg text-muted">${rich(p.text)}</p>`)}
      <div class="nb-cluster nb-cluster--center">
        ${cta(ctx, p.primary, "primary", "primary", "lg")}
        ${when(p.secondary, () => cta(ctx, p.secondary as z.infer<typeof Cta>, "secondary", "secondary", "lg"))}
      </div>`;
    return html`<section id="${ctx.id}" class="py-16" aria-labelledby="${ctx.id}-title">
  <div class="nb-container nb-container--narrow${raw(variant === "banded" ? " nb-card nb-card--elevated" : "")}">
    <div class="nb-stack text-center${raw(variant === "banded" ? " p-8" : "")}">
      ${inner}
    </div>
  </div>
</section>`;
  },
});

export const footer = defineBlueprint({
  name: "footer",
  title: "Footer",
  description: "Site footer: brand, link columns and legal text; simple (one row) or in columns.",
  variants: ["simple", "columns"],
  region: "footer",
  titled: () => false,
  props: z
    .object({
      brand: Text(60).optional(),
      text: Inline(300).optional(),
      columns: z
        .array(z.object({ title: Text(60), links: z.array(Link).max(10) }).strict())
        .max(4)
        .default([]),
      legal: Text(200).optional(),
    })
    .strict(),
  example: {
    brand: "Brewly",
    text: "Small-batch coffee, delivered.",
    columns: [
      {
        title: "Product",
        links: [
          { text: "Plans", href: "#pricing" },
          { text: "Gift cards", href: "/gift" },
        ],
      },
      {
        title: "Company",
        links: [
          { text: "About", href: "/about" },
          { text: "Contact", href: "mailto:hello@brewly.example" },
        ],
      },
    ],
    legal: "© 2026 Brewly",
  },
  render: (p, variant, ctx) => {
    const links = (list: z.infer<typeof Link>[], at: string) =>
      list.map(
        (l, i) => html`<li><a href="${href(ctx, l.href, `${at}[${i}].href`)}">${l.text}</a></li>`,
      );
    const brand = when(
      p.brand || p.text,
      () =>
        html`<div class="nb-stack">${when(p.brand, () => html`<p class="font-semibold">${p.brand}</p>`)}${when(p.text, () => html`<p class="text-muted">${rich(p.text)}</p>`)}</div>`,
    );
    const body =
      variant === "columns"
        ? html`<div class="nb-grid">
      ${brand}
      ${p.columns.map(
        (c, i) => html`<nav class="nb-stack" aria-label="${c.title}">
        <h2 class="text-sm font-semibold">${c.title}</h2>
        <ul class="nb-stack">${links(c.links, `columns[${i}].links`)}</ul>
      </nav>`,
      )}
    </div>`
        : html`<div class="nb-cluster nb-cluster--between">
      ${brand}
      ${when(
        p.columns.length,
        () =>
          html`<nav aria-label="Footer"><ul class="nb-cluster">${p.columns.flatMap((c, i) => links(c.links, `columns[${i}].links`))}</ul></nav>`,
      )}
    </div>`;
    return html`<footer id="${ctx.id}" class="py-12 border-t">
  <div class="nb-container nb-stack">
    ${body}
    ${when(p.legal, () => html`<p class="text-sm text-muted">${p.legal}</p>`)}
  </div>
</footer>`;
  },
});
