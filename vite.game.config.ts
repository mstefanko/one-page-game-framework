import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { gameDevPlugin } from "./scripts/game-dev-plugin.mjs";
export default defineConfig({
  root: "apps/game",
  base: "./",
  publicDir: false,
  plugins: [gameDevPlugin()],
  build: { outDir: "../../dist-game", emptyOutDir: true },
  server: {
    port: 4180,
    host: "127.0.0.1",
    fs: { allow: [fileURLToPath(new URL(".", import.meta.url))] },
  },
});
