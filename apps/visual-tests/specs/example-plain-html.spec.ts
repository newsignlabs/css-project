import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { expectNoAxeViolations, manifest } from "../harness/fixtures.ts";

// T035 — the zero-build showcase renders every manifest component with only newbrush.css linked.
test("examples/plain-html renders all components accessibly", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(new URL("../../../examples/plain-html/index.html", import.meta.url).href);
  for (const c of manifest.components) await expect(page.locator(`#${c.name}`)).toBeVisible();
  const linked = readFileSync(
    new URL("../../../examples/plain-html/index.html", import.meta.url),
    "utf8",
  );
  expect(linked.match(/<link rel="stylesheet"/g)).toHaveLength(1);
  // Checked before axe runs: axe fetches stylesheets via XHR, which file:// pages block (not a page error).
  expect(errors).toEqual([]);
  await expectNoAxeViolations(page);
});
