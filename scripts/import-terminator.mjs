import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { build } from "esbuild";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export function extractTerminator(source) {
  const markers = [
    "</script>",
    "function scoreEvent(",
    "AUDIO.songId=null;",
    "function frame(now){",
    "window.AUDIO = AUDIO;",
    "const STAGES = [",
    "const CUT_SCENES = {",
  ];
  for (const marker of markers)
    if (source.split(marker).length !== 2)
      throw new Error(`Unsupported Terminator source: expected one ${marker}`);
  const code = source.slice(
    source.indexOf("function scoreEvent("),
    source.indexOf("AUDIO.songId=null;"),
  );
  const context = vm.createContext({});
  return vm.runInContext(`${code}\nJSON.stringify(TRACKS)`, context, {
    timeout: 1000,
  });
}
export function instrumentTerminator(source, project, bundle) {
  const result = source.replace(
    "</script>",
    () =>
      `\n;globalThis.__TERMINATOR_PROJECT__=${JSON.stringify(project).replaceAll("<", "\\u003c")};\n${bundle.replaceAll("</script", "<\\/script")}\n</script>`,
  );
  const script = result.slice(
    result.indexOf("<script>") + 8,
    result.lastIndexOf("</script>"),
  );
  new vm.Script(script, { filename: "instrumented-terminator.js" });
  return result;
}
export async function importTerminator(sourcePath) {
  const source = await readFile(resolve(sourcePath), "utf8"),
    tracks = JSON.parse(extractTerminator(source));
  const moduleBuild = await build({
    stdin: {
      contents:
        'export * from "./packages/music-editor/src/terminator-project.ts"',
      resolveDir: root,
    },
    bundle: true,
    write: false,
    platform: "node",
    format: "esm",
  });
  const { TERMINATOR_CONTEXTS, importTerminatorTrack, parseTerminatorProject } =
    await import(
      `data:text/javascript;base64,${Buffer.from(moduleBuild.outputFiles[0].text).toString("base64")}`
    );
  const sourceSha256 = createHash("sha256").update(source).digest("hex");
  const scores = Object.fromEntries(
    Object.entries(tracks).map(([id, track]) => [
      id,
      importTerminatorTrack(id, track),
    ]),
  );
  const sfxSection = source.slice(
    source.indexOf("const SFX = {"),
    source.indexOf("// Play a one-shot effect:"),
  );
  const sfx = [...sfxSection.matchAll(/^  (\w+):/gm)].map((m) => m[1]);
  if (!sfx.length || !scores.title || !scores.play_chase)
    throw new Error("Unsupported Terminator audio catalog");
  const musicUsages = TERMINATOR_CONTEXTS.map((c) => ({
    id: `music-${c.id}`,
    contextId: c.id,
    assetId: c.cue,
    trigger: "context entered",
    checkpoint: "start",
  }));
  const cutEffects = {
    galleriaIn: ["harley"],
    drainIn: ["rev", "harley", "crash"],
    drainOut: ["blast", "harley"],
    millIn: ["crash", "splash", "ready"],
    farewell: [],
  };
  const sfxUsages = Object.entries(cutEffects).flatMap(([scene, effects]) =>
    effects.map((id) => ({
      id: `sfx-cut-${scene}-${id}`,
      contextId: `cut-${scene}`,
      assetId: `sfx-${id}`,
      trigger: "authored cinematic event",
      checkpoint: "start",
    })),
  );
  for (const c of TERMINATOR_CONTEXTS.filter((c) => /^stage-\d$/.test(c.id)))
    for (const id of sfx.filter((id) =>
      [
        "shove",
        "shotgun",
        "splash",
        "blade",
        "grenade",
        "hurt",
        "ready",
        "quarter",
        "bump",
        "minigun",
        "box",
        "lure",
      ].includes(id),
    ))
      sfxUsages.push({
        id: `sfx-${c.id}-${id}`,
        contextId: c.id,
        assetId: `sfx-${id}`,
        trigger: "gameplay action (role dependent)",
        checkpoint: "start",
      });
  const catalog = {
    projectId: "terminator-liquid-metal",
    projectName: "Terminator: Liquid Metal",
    contexts: TERMINATOR_CONTEXTS.map(({ id, name, kind }) => ({
      id,
      name,
      kind,
    })),
    assets: [
      ...Object.keys(scores).map((id) => ({
        id,
        name: id.replaceAll("_", " "),
        kind: "music",
        revision: sourceSha256.slice(0, 12),
      })),
      ...sfx.map((id) => ({
        id: `sfx-${id}`,
        name: id,
        kind: "sfx",
        revision: sourceSha256.slice(0, 12),
      })),
    ],
    usages: [...musicUsages, ...sfxUsages],
  };
  const project = parseTerminatorProject({
    schemaVersion: 1,
    sourceSha256,
    catalog,
    scores,
  });
  const runtime = await build({
    entryPoints: [
      resolve(root, "packages/music-editor/src/terminator-runtime.ts"),
    ],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    minify: false,
  });
  // Append inside the game's existing script so its lexical game APIs stay available.
  const instrumented = instrumentTerminator(
    source,
    project,
    runtime.outputFiles[0].text,
  );
  const output = resolve(root, "apps/composer/public/local-games/terminator");
  await mkdir(output, { recursive: true });
  await writeFile(resolve(output, "index.html"), instrumented);
  await writeFile(resolve(output, "catalog.json"), JSON.stringify(project));
  console.log(
    `Imported ${catalog.contexts.length} contexts, ${Object.keys(scores).length} scores and ${sfx.length} sound effects. Local source SHA-256 ${sourceSha256}. Output: ${output}`,
  );
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (!process.argv[2]) {
    console.error(
      "Usage: npm run import:terminator -- /path/to/terminator-game-repo/index.html",
    );
    process.exitCode = 1;
  } else await importTerminator(process.argv[2]);
}
