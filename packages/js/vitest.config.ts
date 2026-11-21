import { defineConfig } from "vitest/config";
import { define } from "./styles.config.ts";

export default defineConfig({ define, test: { environment: "happy-dom" } });
