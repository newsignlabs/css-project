import { expect, type Page } from "@playwright/test";

const INTERACTIVE =
  "a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=switch], [tabindex]:not([tabindex='-1'])";

/**
 * WCAG 2.2 SC 2.5.8 (24×24 CSS px) for interactive elements — constitution §IV.
 * Inline links inside text are exempt (per the SC); a control counts as large enough when its own box,
 * its enclosing <label>, or its stretched ::after hit area meets the minimum.
 */
export async function expectTargetSize(page: Page, min = 24): Promise<void> {
  const failures = await page.locator(INTERACTIVE).evaluateAll(
    (elements, minimum) =>
      elements
        .filter((el) => {
          const style = getComputedStyle(el);
          if (
            style.display === "inline" &&
            el.closest("p, li, td, th, dd, figcaption, blockquote, small")
          )
            return false;
          return (
            style.visibility !== "hidden" &&
            style.display !== "none" &&
            (el as HTMLElement).offsetParent !== null
          );
        })
        .map((el) => {
          const own = el.getBoundingClientRect();
          const label = el.closest("label")?.getBoundingClientRect();
          // Stretched links (e.g. nb-card__link) make an absolutely positioned ::after the actual hit area.
          const after = getComputedStyle(el, "::after");
          const stretched =
            after.content !== "none" && after.position === "absolute"
              ? (el as HTMLElement).offsetParent?.getBoundingClientRect()
              : undefined;
          const ok = (r?: DOMRect) => !!r && r.width >= minimum - 0.5 && r.height >= minimum - 0.5;
          return ok(own) || ok(label) || ok(stretched)
            ? null
            : `${el.outerHTML.slice(0, 80)} (${own.width.toFixed(1)}×${own.height.toFixed(1)})`;
        })
        .filter(Boolean),
    min,
  );
  expect(failures).toEqual([]);
}
