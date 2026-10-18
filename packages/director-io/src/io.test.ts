import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { createDemoScene } from "../../director-core/src";
import {
  exportScenePack,
  importScenePack,
  importAssetPack,
  addPackToScene,
  saveDraft,
  loadDraft,
  listDraftVersions,
  exportStandaloneHtml,
  importImageAsset,
  saveAssetPack,
  loadAssetPacks,
  importAsepriteSheet,
} from "./index";
const png = "data:image/png;base64,iVBORw0KGgo=";
const pack = () => ({
  schemaVersion: 1 as const,
  id: "test",
  name: "test",
  version: "1",
  author: "Artist",
  source: "Original",
  license: "MIT",
  assets: createDemoScene()
    .assets.slice(0, 1)
    .map((a) => ({
      ...a,
      variants: a.variants.map((v) => ({ ...v, mediaId: "sheet" })),
    })),
  media: [
    {
      id: "sheet",
      name: "sheet",
      mime: "image/png",
      dataUrl: png,
      source: "Original",
      license: "MIT",
    },
    {
      id: "unused",
      name: "other",
      mime: "image/png",
      dataUrl: png,
      source: "Original",
      license: "MIT",
    },
  ],
});
describe("portable packs", () => {
  it("includes only scene-used style variants and media", () => {
    const scene = createDemoScene();
    scene.media = pack().media;
    scene.assets[0].variants.find((v) => v.style === scene.style)!.mediaId =
      "sheet";
    const restored = importScenePack(exportScenePack(scene));
    expect(restored.assets.every((a) => a.variants.length === 1)).toBe(true);
    expect(restored.media.map((m) => m.id)).toEqual(["sheet"]);
  });
  it("remaps family, variant and media collisions without replacing originals", () => {
    const scene = createDemoScene();
    scene.media = [
      { ...pack().media[0], dataUrl: "data:image/png;base64,YQ==" },
    ];
    const next = addPackToScene(scene, pack(), ["lantern:courier"]);
    expect(next.assets.at(-1)?.id).toBe("lantern:courier~2");
    expect(next.assets.at(-1)?.variants[0].mediaId).toBe("sheet~2");
    expect(next.media.some((m) => m.id === "unused")).toBe(false);
    expect(scene.assets).toHaveLength(5);
  });
  it("rejects executable fields, prototype keys and remote media", () => {
    expect(() => importAssetPack('{"__proto__":{}}')).toThrow("Unsafe");
    expect(() =>
      importAssetPack(JSON.stringify({ ...pack(), script: "alert(1)" })),
    ).toThrow("Executable");
    const remote = pack();
    remote.media[0].dataUrl = "https://example.com/a.png";
    expect(() => importAssetPack(JSON.stringify(remote))).toThrow("embedded");
  });
  it("recovers drafts and version history in an isolated sidecar", async () => {
    const scene = createDemoScene();
    await saveDraft(scene);
    scene.revision++;
    scene.title = "Revision";
    await saveDraft(scene);
    expect((await loadDraft())?.title).toBe("Revision");
    expect(await listDraftVersions()).toHaveLength(2);
  });
  it("uses a bundled renderer and script-safe source for standalone HTML", async () => {
    const scene = createDemoScene();
    scene.title = "</script><script>alert(1)</script>";
    const html = await exportStandaloneHtml(scene);
    expect(html).toContain("PocketDirector.mountPlayer");
    expect(html).not.toContain("<script>alert(1)");
    expect(html).toContain("default-src 'none'");
    expect(html).not.toContain('src="http');
  });
});

it("stores immutable pack revisions and requires explicit Aseprite action mapping", async () => {
  await saveAssetPack(pack());
  const changed = pack();
  changed.name = "changed";
  await expect(saveAssetPack(changed)).rejects.toThrow("immutable");
  expect(await loadAssetPacks()).toHaveLength(1);
  const sheet = {
    frames: [{ frame: { x: 0, y: 0, w: 16, h: 20 }, duration: 100 }],
    meta: {
      size: { w: 16, h: 20 },
      frameTags: [{ name: "standing", from: 0, to: 0, direction: "forward" }],
    },
  };
  const options = {
    id: "sheet",
    name: "Sheet",
    style: "16-bit" as const,
    source: "Original",
    license: "MIT",
    author: "A",
    actions: { standing: "idle" },
    ground: { x: 8, y: 20 },
  };
  const normalized = importAsepriteSheet(JSON.stringify(sheet), png, options);
  expect(normalized.assets[0].variants[0].frames[0].duration).toBe(6);
  expect(() =>
    importAsepriteSheet(JSON.stringify(sheet), png, {
      ...options,
      actions: {},
    }),
  ).toThrow("Map action");
});

it("rejects unknown secret or execution fields instead of re-exporting them", () => {
  const scene = createDemoScene();
  expect(() =>
    exportScenePack({ ...scene, apiKey: "private" } as typeof scene),
  ).toThrow("Unknown scene field");
  const p = pack();
  Object.assign(p.assets[0].variants[0], { providerSession: "secret" });
  expect(() => importAssetPack(JSON.stringify(p))).toThrow(
    "Unknown variant field",
  );
});

it("rejects unsupported scene envelopes and exports exact pinned variant closure", () => {
  const scene = createDemoScene();
  expect(() =>
    importScenePack(JSON.stringify({ format: "other", version: 1, scene })),
  ).toThrow("format/version");
  scene.actors[0].variantId = scene.assets[0].variants.find(
    (v) => v.style === "16-bit",
  )!.id;
  const packed = importScenePack(exportScenePack(scene));
  expect(packed.assets[0].variants.map((v) => v.style)).toEqual(["16-bit"]);
});

it("normalizes static set/prop images without inventing character clips", () => {
  const normalized = importImageAsset(png, {
    id: "background",
    name: "Station",
    kind: "set",
    style: "16-bit",
    width: 512,
    height: 352,
    source: "Original",
    author: "Artist",
    license: "MIT",
  });
  expect(normalized.assets[0].variants[0]).toMatchObject({
    logicalHeight: 176,
    clips: [],
    sockets: { origin: { x: 0, y: 0 } },
  });
  expect(normalized.assets[0].kind).toBe("set");
  expect(() =>
    importImageAsset("https://example.com/file.png", {
      id: "x",
      name: "x",
      kind: "prop",
      style: "8-bit",
      width: 1,
      height: 1,
      source: "",
      license: "MIT",
      author: "",
    }),
  ).toThrow("embedded");
});

it("preserves incomplete editable packs but blocks incomplete runtime export", async () => {
  const scene = createDemoScene();
  scene.style = "realistic";
  expect(importScenePack(exportScenePack(scene)).style).toBe("realistic");
  await expect(exportStandaloneHtml(scene)).rejects.toThrow(
    "requires complete used assets",
  );
});
it("excludes non-output layers and their unused family/media from runtime closure", async () => {
  const scene = createDemoScene();
  scene.layers.find((l) => l.kind === "foreground")!.output = false;
  const html = await exportStandaloneHtml(scene);
  const json =
      /<script type="application\/json" id="scene">([\s\S]*?)<\/script>/.exec(
        html,
      )![1],
    runtime = JSON.parse(json);
  expect(runtime.layers.some((l: any) => l.kind === "foreground")).toBe(false);
  expect(runtime.assets.some((a: any) => a.id === "lantern:foreground")).toBe(
    false,
  );
  const portable = importScenePack(exportScenePack(scene));
  expect(portable.assets.some((a) => a.id === "lantern:foreground")).toBe(true);
});
