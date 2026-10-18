import { defineConfig } from "vite";
export default defineConfig({
  root: "apps/director",
  base: "./",
  build: { outDir: "../../dist/director", emptyOutDir: true },
  server: { port: 4174, strictPort: true },
});
