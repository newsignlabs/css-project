import { existsSync } from "node:fs";
import { expect, type Locator, type Page, test } from "@playwright/test";

/**
 * Visual comparison against committed baselines. Baselines are generated on CI runners (fonts differ per OS)
 * via the CI workflow's "update-snapshots" input; until a baseline is committed the comparison is recorded as
 * an annotation instead of failing, while the accessibility assertions in the same test still run.
 */
export async function expectScreenshot(
  target: Page | Locator,
  name: string,
  options: { fullPage?: boolean } = {},
): Promise<void> {
  const info = test.info();
  const updating =
    info.config.updateSnapshots === "all" || info.config.updateSnapshots === "changed";
  if (!updating && !existsSync(info.snapshotPath(name))) {
    info.annotations.push({ type: "no-baseline", description: name });
    return;
  }
  await expect(target).toHaveScreenshot(name, options);
}
