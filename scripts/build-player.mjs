import { build } from "esbuild";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";

const dependencies = [
  "@sinclair/typebox",
  "@tonejs/midi",
  "array-flatten",
  "fflate",
  "idb",
  "midi-file",
  "react",
  "react-dom",
  "scheduler",
];
const notices = new Map();
for (const name of dependencies) {
  const root = `node_modules/${name}`;
  const pkg = JSON.parse(await readFile(`${root}/package.json`, "utf8"));
  const file = (await readdir(root)).find((name) =>
    /^licen[sc]e(\.|$)/i.test(name),
  );
  if (!file) throw new Error(`Missing license for ${name}`);
  notices.set(
    name,
    `${name} ${pkg.version}\n\n${await readFile(`${root}/${file}`, "utf8")}`,
  );
}
const ownLicense = await readFile("LICENSE", "utf8");
await mkdir("apps/composer/public", { recursive: true });
await writeFile(
  "apps/composer/public/THIRD_PARTY_NOTICES.txt",
  [
    "Pocket Score / One-page game framework\n\n" + ownLicense,
    ...notices.values(),
  ].join("\n\n" + "=".repeat(72) + "\n\n"),
);
// The file player carries the licenses for its own smaller dependency closure.
const playerLicense = `Pocket Score runtime\n${ownLicense}\n${notices.get("@sinclair/typebox")}`;
await build({
  entryPoints: ["packages/music-io/src/player-entry.ts"],
  outfile: "packages/music-io/src/player-runtime.generated.js",
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  minify: true,
  legalComments: "inline",
  banner: { js: `/*\n${playerLicense.replaceAll("*/", "* /")}\n*/` },
});
