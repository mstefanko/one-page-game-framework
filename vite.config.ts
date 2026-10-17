import { defineConfig } from "vite";
import { readFile } from "node:fs/promises";

export default defineConfig(({ command }) => ({
  root: "apps/composer",
  base: "./",
  // Local game imports are development inputs, not framework release assets.
  publicDir: command === "build" ? false : "public",
  plugins: [
    {
      name: "framework-release-notices",
      apply: "build",
      async generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "THIRD_PARTY_NOTICES.txt",
          source: await readFile(
            new URL(
              "./apps/composer/public/THIRD_PARTY_NOTICES.txt",
              import.meta.url,
            ),
            "utf8",
          ),
        });
      },
    },
  ],
  build: { outDir: "../../dist", emptyOutDir: true },
  server: { port: 4173 },
}));
