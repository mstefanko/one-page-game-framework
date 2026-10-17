import {
  createBlankScore,
  assertScore,
  type Score,
  type Patch,
} from "@onepage/project";
export type ContextId = "menu" | "explore" | "combat" | "victory";
export interface MusicAsset {
  id: string;
  kind: "music";
  name: string;
  revision: number;
  score: Score;
}
export interface SfxAsset {
  id: string;
  kind: "sfx";
  name: string;
  revision: number;
  patch: Patch;
  pitch: number;
  duration: number;
}
export type AudioAsset = MusicAsset | SfxAsset;
export interface AudioUsage {
  id: string;
  contextId: ContextId;
  contextName: string;
  contextType: "menu" | "level" | "cutscene";
  assetId: string;
  trigger: string;
  checkpoint: number;
}
export interface GameAudioManifest {
  schemaVersion: 1;
  projectId: string;
  name: string;
  assets: AudioAsset[];
  usages: AudioUsage[];
}
export const CONTEXTS: ContextId[] = ["menu", "explore", "combat", "victory"];
export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
export function createDemoManifest(score: Score): GameAudioManifest {
  const victory = createBlankScore("Lantern Arrival");
  victory.id = "lantern-arrival";
  victory.playback = "one-shot";
  victory.loop = null;
  victory.lengthTicks = 1440;
  victory.patterns[0]!.lengthTicks = 1440;
  victory.patterns[0]!.notes = [72, 76, 79, 84].map((pitch, i) => ({
    id: `arrival-${i}`,
    startTick: i * 240,
    durationTicks: i === 3 ? 600 : 180,
    pitch,
    velocity: 0.75,
  }));
  victory.sections = [];
  const patch: Patch = {
    id: "demo-sfx",
    name: "Lantern sparkle",
    waveform: "sine",
    attack: 0.003,
    release: 0.1,
    brightness: 0.8,
    duty: 0.5,
  };
  return {
    schemaVersion: 1,
    projectId: "lantern-courier-demo",
    name: "Lantern Courier • built-in demo",
    assets: [
      {
        id: "cue",
        kind: "music",
        name: score.title,
        revision: 1,
        score: clone(score),
      },
      {
        id: "arrival",
        kind: "music",
        name: victory.title,
        revision: 1,
        score: victory,
      },
      {
        id: "step",
        kind: "sfx",
        name: "Lantern step",
        revision: 1,
        patch: { ...patch, waveform: "triangle" },
        pitch: 55,
        duration: 0.04,
      },
      {
        id: "strike",
        kind: "sfx",
        name: "Paper phantom strike",
        revision: 1,
        patch: { ...patch, waveform: "noise" },
        pitch: 38,
        duration: 0.08,
      },
      {
        id: "win",
        kind: "sfx",
        name: "Delivery sparkle",
        revision: 1,
        patch,
        pitch: 88,
        duration: 0.2,
      },
    ],
    usages: CONTEXTS.map<AudioUsage>((contextId, i) => ({
      id: `music-${contextId}`,
      contextId,
      contextName: [
        "Title menu",
        "Moonlit path",
        "Paper phantom encounter",
        "Lantern delivered",
      ][i]!,
      contextType:
        contextId === "menu"
          ? "menu"
          : contextId === "victory"
            ? "cutscene"
            : "level",
      assetId: contextId === "victory" ? "arrival" : "cue",
      trigger:
        contextId === "victory" ? "delivery complete" : "context entered",
      checkpoint: i * 4,
    })).concat([
      {
        id: "step-explore",
        contextId: "explore",
        contextName: "Moonlit path",
        contextType: "level",
        assetId: "step",
        trigger: "move",
        checkpoint: 4,
      },
      {
        id: "strike-combat",
        contextId: "combat",
        contextName: "Paper phantom encounter",
        contextType: "level",
        assetId: "strike",
        trigger: "strike",
        checkpoint: 8,
      },
      {
        id: "win-victory",
        contextId: "victory",
        contextName: "Lantern delivered",
        contextType: "cutscene",
        assetId: "win",
        trigger: "delivery complete",
        checkpoint: 12,
      },
    ]),
  };
}
export function whereUsed(
  manifest: GameAudioManifest,
  assetId: string,
): AudioUsage[] {
  return manifest.usages.filter((u) => u.assetId === assetId);
}
export function pinDraft(
  manifest: GameAudioManifest,
  assetId: string,
  score: Score,
): GameAudioManifest {
  assertScore(score);
  if (!manifest.assets.some((a) => a.id === assetId && a.kind === "music"))
    throw new Error("Choose a music asset");
  return {
    ...manifest,
    assets: manifest.assets.map((a) =>
      a.id === assetId && a.kind === "music"
        ? {
            ...a,
            revision: a.revision + 1,
            name: score.title,
            score: clone(score),
          }
        : a,
    ),
  };
}
export function parseManifest(text: string): GameAudioManifest {
  if (text.length > 4_000_000) throw new Error("Manifest is too large");
  const m = JSON.parse(text) as GameAudioManifest;
  if (
    m.schemaVersion !== 1 ||
    m.projectId !== "lantern-courier-demo" ||
    !Array.isArray(m.assets) ||
    m.assets.length > 32 ||
    !Array.isArray(m.usages) ||
    m.usages.length > 128
  )
    throw new Error("Unsupported demo manifest");
  const ids = new Set<string>();
  for (const asset of m.assets) {
    if (
      typeof asset.id !== "string" ||
      ids.has(asset.id) ||
      typeof asset.name !== "string" ||
      !Number.isInteger(asset.revision) ||
      asset.revision < 1
    )
      throw new Error("Invalid asset");
    ids.add(asset.id);
    if (asset.kind === "music") assertScore(asset.score);
    else if (asset.kind === "sfx") {
      const p = asset.patch;
      if (
        !p ||
        !["pulse", "triangle", "sine", "sawtooth", "noise"].includes(
          p.waveform,
        ) ||
        ![
          p.attack,
          p.release,
          p.brightness,
          p.duty,
          asset.pitch,
          asset.duration,
        ].every(Number.isFinite) ||
        p.attack < 0 ||
        p.attack > 5 ||
        p.release < 0 ||
        p.release > 10 ||
        p.brightness < 0 ||
        p.brightness > 1 ||
        p.duty < 0.05 ||
        p.duty > 0.95 ||
        asset.pitch < 0 ||
        asset.pitch > 127 ||
        asset.duration <= 0 ||
        asset.duration > 3
      )
        throw new Error("Invalid SFX");
    } else throw new Error("Unknown asset type");
  }
  const usageIds = new Set<string>();
  for (const u of m.usages) {
    if (
      !ids.has(u.assetId) ||
      !CONTEXTS.includes(u.contextId) ||
      typeof u.contextName !== "string" ||
      !["menu", "level", "cutscene"].includes(u.contextType) ||
      typeof u.trigger !== "string" ||
      !Number.isFinite(u.checkpoint) ||
      u.checkpoint < 0 ||
      typeof u.id !== "string" ||
      usageIds.has(u.id)
    )
      throw new Error("Invalid usage reference");
    usageIds.add(u.id);
  }
  return clone(m);
}
export interface PreviewCommand {
  version: 1;
  session: string;
  type: "loadContext" | "requestEnergy" | "pause" | "reset";
  contextId?: ContextId;
  energy?: number;
}
/** A bounded command validator for a future explicitly instrumented connection; not an iframe adapter. */
export function verifyPreviewCommand(
  value: unknown,
  session: string,
): value is PreviewCommand {
  if (!value || typeof value !== "object") return false;
  const v = value as PreviewCommand;
  return (
    v.version === 1 &&
    v.session === session &&
    (["pause", "reset"].includes(v.type) ||
      (v.type === "loadContext" && CONTEXTS.includes(v.contextId!)) ||
      (v.type === "requestEnergy" &&
        Number.isInteger(v.energy) &&
        v.energy! >= 1 &&
        v.energy! <= 3))
  );
}
