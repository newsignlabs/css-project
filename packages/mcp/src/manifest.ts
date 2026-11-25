// specs/003 T004 — the newBrush build manifest, bundled into the server (no file reads at run time).
import type { Manifest } from "@newbrush/schema";
import data from "newbrush/manifest.json" with { type: "json" };
import packageJson from "../package.json" with { type: "json" };

export const manifest = data as unknown as Manifest;
export const SERVER_NAME = "newbrush";
export const SERVER_VERSION = packageJson.version;
/** The live docs (Catalyst Slate), linked from tool results. */
export const DOCS_URL = "https://css-project-fyqaeqal.onslate.in/site";
