import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createDemoScene,
  validateScene,
  evaluateScene,
} from "@onepage/director-core";
import {
  importScenePack,
  exportScenePack,
  exportStandaloneHtml,
} from "@onepage/director-io";
import { createCompanion } from "./server";
import { installScene, readRegistry } from "./install";
import { requestProposal, type ProviderConfig } from "./provider";

export async function main(args: string[]) {
  const [command, file] = args;
  const option = (name: string) => {
    const index = args.indexOf(name);
    return index < 0 ? undefined : args[index + 1];
  };
  const config: ProviderConfig = {
    mode: option("--provider") === "api" ? "anthropic-api" : "claude-code",
    model: process.env.DIRECTOR_MODEL,
    budget: Number(process.env.DIRECTOR_RUN_BUDGET ?? 1),
    apiKey: process.env.ANTHROPIC_API_KEY,
  };
  if (
    !Number.isFinite(config.budget) ||
    config.budget <= 0 ||
    config.budget > 20
  )
    throw new Error("Run budget must be between 0 and 20 USD.");
  if (command === "serve") {
    const port = Number(option("--port") ?? 4175);
    if (!Number.isInteger(port) || port < 1024 || port > 65535)
      throw new Error("Invalid companion port.");
    const project = option("--project");
    const { server, token } = createCompanion({
      ...config,
      port,
      projectRoot: project ? resolve(project) : undefined,
    });
    server.listen(port, "127.0.0.1", () => {
      console.log(
        `Pocket Director companion: http://127.0.0.1:${port}\nPairing token: ${token}\nProvider: ${config.mode}. Enter this token in Director → connection settings.\nNo provider credential is sent to the browser. Ctrl+C stops the companion.`,
      );
      if (config.mode === "anthropic-api")
        console.log(
          "API requests are limited to one response / 4096 output tokens. Dollar budget is not enforced for API mode; configure a provider account spending limit.",
        );
    });
    process.once("SIGINT", () => server.close());
    return;
  }
  if (command === "demo") {
    console.log(exportScenePack(createDemoScene()));
    return;
  }
  if (
    !file ||
    ![
      "inspect",
      "validate",
      "evaluate",
      "propose",
      "install",
      "build",
    ].includes(command ?? "")
  ) {
    console.log(
      'Pocket Director\n  serve [--provider api] [--project folder] [--port 4175]\n  demo > scene.pack.json\n  inspect|validate scene.pack.json\n  evaluate scene.pack.json --tick 504\n  propose scene.pack.json --prompt "Less rain" [--provider api]\n  install scene.pack.json --project folder [--dry-run] --expected-revision 0\n  build scene.pack.json --out scene.html\nAPI connection: ANTHROPIC_API_KEY + DIRECTOR_MODEL in the companion environment.',
    );
    return;
  }
  const scene = importScenePack(await readFile(file, "utf8"));
  if (command === "validate") {
    const issues = validateScene(scene);
    console.log(JSON.stringify(issues, null, 2));
    if (issues.some((i) => i.severity === "error")) process.exitCode = 1;
  }
  if (command === "inspect")
    console.log(
      JSON.stringify(
        {
          id: scene.id,
          revision: scene.revision,
          shots: scene.shots,
          actors: scene.actors,
          locks: scene.locks,
          assets: scene.assets.map((a) => ({
            id: a.id,
            name: a.name,
            variants: a.variants.map((v) => ({
              id: v.id,
              style: v.style,
              ready: v.ready,
              clips: v.clips.map((c) => c.name),
            })),
          })),
        },
        null,
        2,
      ),
    );
  if (command === "evaluate")
    console.log(
      JSON.stringify(
        evaluateScene(scene, Number(option("--tick") ?? 0)),
        null,
        2,
      ),
    );
  if (command === "propose")
    console.log(
      JSON.stringify(
        await requestProposal(scene, option("--prompt") ?? "", config),
        null,
        2,
      ),
    );
  if (command === "build") {
    const out = option("--out");
    if (!out) throw new Error("--out is required.");
    await writeFile(out, await exportStandaloneHtml(scene));
    console.log(`Built ${out}`);
  }
  if (command === "install") {
    const root = option("--project");
    if (!root) throw new Error("--project is required.");
    if (args.includes("--dry-run")) {
      const current = await readRegistry(root);
      console.log(
        JSON.stringify(
          {
            revision: current.revision,
            slot: scene.slot,
            assets: scene.assets.length,
            changes: ["director-scenes.json"],
            gameHostRequired: true,
          },
          null,
          2,
        ),
      );
    } else {
      const rev = option("--expected-revision");
      if (rev === undefined)
        throw new Error("--expected-revision is required.");
      console.log(JSON.stringify(await installScene(root, scene, Number(rev))));
    }
  }
}
