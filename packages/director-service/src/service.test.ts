import { describe, it, expect, vi, afterEach } from "vitest";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createDemoScene,
  createBlankScene,
  mergeCandidate,
} from "@onepage/director-core";
import { buildPrompt, parseProposal, requestProposal } from "./provider";
import { readRegistry, installScene } from "./install";
import { safeToken } from "./server";
afterEach(() => vi.unstubAllGlobals());
describe("local companion proposal boundary", () => {
  it("strips binary media from remote context and cannot modify locks", () => {
    const scene = createDemoScene();
    scene.media.push({
      id: "private",
      name: "portrait",
      mime: "image/png",
      dataUrl: "data:image/png;base64,UFJJVkFURUJJTkFSWQ==",
      source: "user",
      license: "private",
    });
    const prompt = buildPrompt(scene, "Less rain");
    expect(prompt).not.toContain("UFJJVkFURUJJTkFSWQ==");
    expect(() =>
      parseProposal(
        {
          name: "Bypass",
          commands: [
            { type: "set", target: "scene", property: "locks", value: [] },
          ],
        },
        scene,
      ),
    ).toThrow("cannot replace");
    expect(() =>
      parseProposal(
        {
          name: "Prototype",
          commands: [
            { type: "set", target: "scene", property: "__proto__", value: {} },
          ],
        },
        scene,
      ),
    ).toThrow();
  });
  it("validates a provider proposal without applying it to the source", async () => {
    const scene = createDemoScene(),
      before = JSON.stringify(scene);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              content: [
                {
                  type: "tool_use",
                  name: "propose_scene",
                  input: {
                    name: "Quiet rain",
                    commands: [
                      {
                        type: "set",
                        target: "environment",
                        property: "frontRain",
                        value: 0.25,
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200 },
          ),
      ),
    );
    const candidate = await requestProposal(scene, "Less rain", {
      mode: "anthropic-api",
      model: "test-only",
      apiKey: "test-only",
      budget: 1,
    });
    expect(JSON.stringify(scene)).toBe(before);
    expect(mergeCandidate(scene, candidate).scene.environment.frontRain).toBe(
      0.25,
    );
  });
  it("accepts a first staged draft from a blank scene without changing its assets or source", () => {
    const scene = createBlankScene();
    const library = createDemoScene();
    scene.assets = library.assets;
    const before = JSON.stringify(scene);
    const candidate = parseProposal(
      {
        name: "First staged draft",
        commands: [
          ...(
            [
              "shots",
              "actors",
              "layers",
              "motions",
              "dialogue",
              "camera",
            ] as const
          ).map((property) => ({
            type: "set",
            target: "scene",
            property,
            value: library[property],
          })),
        ],
      },
      scene,
    );
    expect(JSON.stringify(scene)).toBe(before);
    const result = mergeCandidate(scene, candidate);
    expect(result.conflicts).toEqual([]);
    expect(result.scene.actors).toHaveLength(2);
    expect(result.scene.layers.length).toBeGreaterThan(0);
    expect(result.scene.assets).toEqual(scene.assets);
    const prompt = buildPrompt(scene, "Stage the first scene");
    expect(prompt).toContain("actor {id,name,familyId,x,y,scale}");
    expect(prompt).toContain("scene.shots,actors,layers");
  });
  it("rejects unsupported provider results and late cancelled output", async () => {
    const scene = createDemoScene();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ content: [] }))),
    );
    await expect(
      requestProposal(scene, "Less rain", {
        mode: "anthropic-api",
        model: "test-only",
        apiKey: "test-only",
        budget: 1,
      }),
    ).rejects.toThrow("structured");
    const controller = new AbortController();
    controller.abort();
    await expect(
      requestProposal(
        scene,
        "Less rain",
        {
          mode: "anthropic-api",
          model: "test-only",
          apiKey: "test-only",
          budget: 1,
        },
        controller.signal,
      ),
    ).rejects.toThrow();
    expect(safeToken("wrong", "secret")).toBe(false);
    expect(safeToken("secret", "secret")).toBe(true);
  });
});
describe("atomic pinned project registration", () => {
  it("checks revisions, retains backup, and pins media with the scene", async () => {
    const root = await mkdtemp(join(tmpdir(), "director-install-test-"));
    try {
      const scene = createDemoScene();
      expect((await readRegistry(root)).revision).toBe(0);
      await installScene(root, scene, 0);
      await expect(installScene(root, scene, 0)).rejects.toThrow("changed");
      scene.title = "New cut";
      await installScene(root, scene, 1);
      const current = await readRegistry(root);
      expect(current.revision).toBe(2);
      expect(current.slots[scene.slot.id]!.scene.title).toBe("New cut");
      const backup = JSON.parse(
        await readFile(join(root, "director-scenes.json.previous"), "utf8"),
      );
      expect(backup.revision).toBe(1);
      expect(
        current.slots[scene.slot.id]!.scene.assets.flatMap(
          (a) => a.variants,
        ).every((v) => v.style === "8-bit"),
      ).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it("rejects symlink registries rather than writing outside the project", async () => {
    const root = await mkdtemp(join(tmpdir(), "director-symlink-test-"));
    const elsewhere = join(root, "untouched.json");
    try {
      await writeFile(elsewhere, "untouched");
      await symlink(elsewhere, join(root, "director-scenes.json"));
      await expect(installScene(root, createDemoScene(), 0)).rejects.toThrow(
        "regular",
      );
      expect(await readFile(elsewhere, "utf8")).toBe("untouched");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
