import { defineConfig, devices } from "@playwright/test";

/**
 * Visual-regression + accessibility harness (specs/001-core-framework T015).
 * NB_BROWSERS=chromium limits engines locally; CI runs all three (constitution §V).
 */
const engines = (process.env.NB_BROWSERS ?? "chromium,firefox,webkit").split(",");
const all = [
  { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  { name: "webkit", use: { ...devices["Desktop Safari"] } },
];

export default defineConfig({
  testDir: "specs",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  // Baselines are produced on CI runners (workflow_dispatch "update-snapshots") so fonts match; missing ones are written, not failed.
  updateSnapshots: "missing",
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.001, animations: "disabled" } },
  snapshotPathTemplate: "{testDir}/__screenshots__/{projectName}/{testFilePath}/{arg}{ext}",
  projects: all.filter((p) => engines.includes(p.name)),
});
