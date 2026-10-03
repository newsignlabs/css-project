import newbrush from "@newbrush/vite";
import { defineConfig } from "astro/config";

export default defineConfig({ vite: { plugins: [newbrush()] } });
