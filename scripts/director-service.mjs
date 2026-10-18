import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
await mkdir(".local", { recursive: true });
const outfile = resolve(".local/director-service.mjs");
await build({
  entryPoints: ["packages/director-service/src/cli.ts"],
  outfile,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
});
const { main } = await import(pathToFileURL(outfile).href);
await main(process.argv.slice(2));
