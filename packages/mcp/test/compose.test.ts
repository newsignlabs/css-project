import { describe, expect, it } from "vitest";
import { composeComponent } from "../src/lib/compose-component.ts";

// specs/003 T023 and US3 acceptance 1 — compose_component.

describe("compose_component", () => {
  it("composes a card from parts, with modifiers and escaped text (US3-1)", () => {
    const r = composeComponent({
      name: "card",
      modifiers: ["elevated"],
      slots: {
        title: "Plans <script>x</script>",
        body: "Pick <em>one</em>.",
        footer: { href: "/go", text: "Go" },
      },
      withCss: true,
    });
    expect(r.html).toBe(
      '<article class="nb-card nb-card--elevated">\n  <h3 class="nb-card__title">Plans &lt;script&gt;x&lt;/script&gt;</h3>\n  <div class="nb-card__body">Pick <em>one</em>.</div>\n  <a class="nb-card__footer" href="/go">Go</a>\n</article>',
    );
    expect(r.css).toContain(".nb-card");
    expect(r.diagnostics).toEqual([]);
  });

  it("nests parts inside their parent part (accordion, navbar)", () => {
    const r = composeComponent({
      name: "accordion",
      slots: { trigger: "Question", panel: "Answer" },
    });
    expect(r.html).toContain('<details class="nb-accordion__item">');
    expect(r.html).toMatch(
      /<details class="nb-accordion__item"><summary class="nb-accordion__trigger">Question<\/summary>/,
    );
  });

  it("buttons: root attributes, size, content; warns without a name", () => {
    expect(
      composeComponent({
        name: "button",
        modifiers: ["primary"],
        size: "lg",
        slots: { content: "Save" },
      }).html,
    ).toBe('<button class="nb-btn nb-btn--primary nb-btn--lg" type="button">Save</button>');
    expect(composeComponent({ name: "button" }).diagnostics.map((d) => d.code)).toContain(
      "NB_ANATOMY_INVALID",
    );
  });

  it("drops unknown modifiers, parts and unsafe attributes with diagnostics", () => {
    const r = composeComponent({
      name: "card",
      modifiers: ["huge"],
      slots: { titel: "x" },
      attrs: { onclick: "alert(1)", "data-id": "7", "aria-label": "Plan" },
    });
    expect(r.html).not.toContain("onclick");
    expect(r.html).toContain('data-id="7"');
    const messages = r.diagnostics.map((d) => d.message).join(" ");
    expect(messages).toContain('"huge" is not a card modifier');
    expect(messages).toContain("did you mean title?");
    expect(messages).toContain('Attribute "onclick" is not allowed');
  });
});
