import { AudioEngine } from "@onepage/music-web-audio";
import {
  createPreviewRuntime,
  type RuntimePreviewEvent,
} from "./preview-bridge";
import {
  TERMINATOR_CONTEXTS,
  type TerminatorProject,
} from "./terminator-project";
import type { Score } from "@onepage/project";
// These lexical APIs belong to the imported, unchanged single-file game.
declare const G: any,
  CFG: any,
  AUDIO: any,
  BS: any,
  INPUT: any,
  TRACKS: any,
  CUT_SCENES: any;
declare function pickRole(index: number): void;
declare function goSelect(): void;
declare function startIntro(): void;
declare function startCut(id: string, then: () => void): void;
declare function enterMap(from: number, to: number, next: string): void;
declare function openShop(): void;
declare function finishEnding(): void;
declare function enterDeath(out: { win: boolean; title: string }): void;
declare function render(): void;
declare function touchCancel(): void;
declare function newRun(): any;
declare function audioInit(): void;
declare function audioSync(): void;
declare function audioTick(): void;
declare function sfx(name: string, multiplier?: number): void;
declare function stepOnce(): void;
declare function retireScoreBus(bus: any, time: number): void;

const project = (
  globalThis as unknown as { __TERMINATOR_PROJECT__: TerminatorProject }
).__TERMINATOR_PROJECT__;
const canonical = new AudioEngine();
let playbackGeneration = 0;
let hostMusic = false;
let running = false,
  contextId = "title",
  draft: { assetId: string; score: Score } | undefined;
let sounding: string | null = null,
  contextReported = "",
  nativeCue: string | null = null;
let canonicalAsset: string | null = null,
  wasOverridden = false;
const originalSync = audioSync,
  originalSfx = sfx,
  originalStep = stepOnce;
// Preview uses a separate storage namespace, preserving the player's hosted/local save.
for (const key of Object.keys(CFG).filter(
  (key) => key.endsWith("_KEY") || key.endsWith("_PREFIX"),
))
  if (typeof CFG[key] === "string") CFG[key] = `onepage-preview:${CFG[key]}`;
CFG.SEED = 426;
function report(event: RuntimePreviewEvent) {
  try {
    runtime.report(event);
  } catch {
    /* No host before handshake. */
  }
}
function currentContext() {
  if (G.state === "cutscene") return `cut-${G.cut.scene}`;
  if (["intro", "play"].includes(G.state))
    return `stage-${G.stage}${G.state === "intro" ? "-intro" : ""}`;
  if (G.state === "result") return G.outcome?.win ? "win" : "death";
  return ["title", "select", "map", "shop", "ending", "death"].includes(G.state)
    ? G.state
    : contextId;
}
function updateReports() {
  const id = currentContext();
  if (
    project.catalog.contexts.some((c) => c.id === id) &&
    id !== contextReported
  ) {
    contextId = id;
    contextReported = id;
    report({ type: "contextChanged", contextId: id });
  }
  if (AUDIO.trackName !== nativeCue) {
    nativeCue = AUDIO.trackName;
    if (
      nativeCue &&
      project.catalog.assets.some(
        (a) => a.id === nativeCue && a.kind === "music",
      )
    )
      report({ type: "requestCue", assetId: nativeCue });
  }
}
function syncDraft() {
  if (hostMusic) {
    canonical.stop();
    canonicalAsset = null;
    if (AUDIO.ok) {
      AUDIO.music.gain.cancelScheduledValues(AUDIO.ctx.currentTime);
      AUDIO.music.gain.setValueAtTime(0, AUDIO.ctx.currentTime);
      if (AUDIO.cur) {
        retireScoreBus(AUDIO.scoreBus, AUDIO.ctx.currentTime);
        AUDIO.cur = null;
      }
    }
    wasOverridden = true;
    if (sounding !== null) {
      sounding = null;
      report({ type: "soundingCue", assetId: null });
    }
    return;
  }
  const active = running && draft && AUDIO.trackName === draft.assetId;
  if (active) {
    AUDIO.music?.gain.cancelScheduledValues(AUDIO.ctx.currentTime);
    AUDIO.music?.gain.setValueAtTime(0, AUDIO.ctx.currentTime);
    if (AUDIO.cur) {
      retireScoreBus(AUDIO.scoreBus, AUDIO.ctx.currentTime);
      AUDIO.cur = null;
    }
    wasOverridden = true;
    if (AUDIO.muted) {
      canonical.stop();
      canonicalAsset = null;
    } else if (canonicalAsset !== draft!.assetId) {
      canonicalAsset = draft!.assetId;
      void canonical
        .play(draft!.score)
        .catch((e) => report({ type: "error", message: String(e) }));
    }
  } else {
    canonical.stop();
    canonicalAsset = null;
    if (wasOverridden && AUDIO.ok) {
      AUDIO.music.gain.cancelScheduledValues(AUDIO.ctx.currentTime);
      AUDIO.music.gain.setValueAtTime(1, AUDIO.ctx.currentTime);
    }
    wasOverridden = false;
  }
  const next =
    running && !AUDIO.muted
      ? active
        ? draft!.assetId
        : AUDIO.trackName
      : null;
  if (next !== sounding) {
    sounding = next;
    report({ type: "soundingCue", assetId: next });
  }
}
// Replace only the preview copy's hooks, while preserving the game simulation and renderers.
// @ts-expect-error Imported function declarations are reassigned inside the original classic script.
audioSync = function () {
  if (!running) return;
  originalSync();
  updateReports();
  syncDraft();
};
// @ts-expect-error See audioSync.
sfx = function (name: string, multiplier?: number) {
  if (!running) return;
  originalSfx(name, multiplier);
  if (
    project.catalog.assets.some(
      (a) => a.kind === "sfx" && a.id === `sfx-${name}`,
    )
  )
    report({ type: "triggerSfx", assetId: `sfx-${name}` });
};
// @ts-expect-error See audioSync.
stepOnce = function () {
  if (!running) {
    INPUT.clicks.length = 0;
    INPUT.keys.length = 0;
    return;
  }
  originalStep();
  if (G.paused) {
    void pause();
    return;
  }
  if (G.tick % 15 === 0)
    report({ type: "position", tick: Math.max(0, G.tick) });
};
async function pause() {
  playbackGeneration++;
  running = false;
  touchCancel();
  canonical.stop();
  canonicalAsset = null;
  if (AUDIO.ok) {
    AUDIO.cur = null;
    retireScoreBus(AUDIO.scoreBus, AUDIO.ctx.currentTime);
    AUDIO.trackName = null;
    AUDIO.scoreBus?.out.disconnect();
    AUDIO.sfxBus.disconnect();
    AUDIO.sfxBus = AUDIO.ctx.createGain();
    AUDIO.sfxBus.connect(AUDIO.master);
    await AUDIO.ctx.suspend();
  }
  sounding = null;
  report({ type: "soundingCue", assetId: null });
}
async function clearDraft() {
  canonical.stop();
  canonicalAsset = null;
  draft = undefined;
  wasOverridden = false;
  if (AUDIO.ok) {
    AUDIO.music.gain.cancelScheduledValues(AUDIO.ctx.currentTime);
    AUDIO.music.gain.setValueAtTime(1, AUDIO.ctx.currentTime);
    AUDIO.trackName = null;
  }
  if (running) audioSync();
  else if (hostMusic) syncDraft();
}
async function play() {
  const generation = playbackGeneration;
  audioInit();
  if (AUDIO.failed)
    throw new Error("Game audio is unavailable in this browser");
  await AUDIO.ctx?.resume();
  if (AUDIO.ctx?.state !== "running")
    throw new Error("Click inside the game to enable sound, then press Play.");
  if (generation !== playbackGeneration || document.hidden) return;
  running = true;
  G.paused = false;
  audioSync();
}
async function load(id: string, checkpoint?: string) {
  if (checkpoint && checkpoint !== "start")
    throw new Error(
      "Unknown checkpoint: only deterministic start checkpoints are supported",
    );
  if (!TERMINATOR_CONTEXTS.some((c) => c.id === id))
    throw new Error("Unknown game context");
  await pause();
  const oldDraft = draft;
  draft = undefined;
  // All contexts start from a reproducible fresh T-800 run.
  pickRole(1);
  G.tick = 0;
  G.paused = false;
  G.run = newRun();
  if (id.startsWith("stage-")) {
    G.stage = Number(id.split("-")[1]);
    G.round = [1, 2, 3, 3, 4, 5, 6, 6][G.stage];
    startIntro();
    if (!id.endsWith("intro")) {
      G.state = "play";
      G.introT = 10000;
    }
  } else if (id.startsWith("cut-"))
    startCut(id.slice(4), () => {
      G.state = "title";
    });
  else if (id === "map") enterMap(-1, 0, "intro");
  else if (id === "shop") {
    startIntro();
    openShop();
  } else if (id === "ending") finishEnding();
  else if (id === "win") {
    startIntro();
    G.state = "result";
    G.outcome = { win: true, title: "ROUND CLEARED" };
  } else if (id === "death") {
    startIntro();
    enterDeath({ win: false, title: "TERMINATED" });
  } else {
    goSelect();
    G.state = id;
  }
  draft = oldDraft;
  contextId = id;
  contextReported = "";
  updateReports();
  render();
}
const runtime = createPreviewRuntime({
  host: window.parent,
  hostOrigin: location.origin,
  catalog: project.catalog,
  callbacks: {
    async setMusicSource(source) {
      hostMusic = source === "host";
      canonical.stop();
      canonicalAsset = null;
      // A cue can be unchanged while its owner changes. Request its pinned
      // assignment again, including when Play follows a paused handoff.
      if (!hostMusic) nativeCue = null;
      if (!hostMusic && AUDIO.ok) {
        AUDIO.music.gain.cancelScheduledValues(AUDIO.ctx.currentTime);
        AUDIO.music.gain.setValueAtTime(1, AUDIO.ctx.currentTime);
        AUDIO.trackName = null;
        wasOverridden = false;
      }
      if (running) audioSync();
      else if (hostMusic) syncDraft();
    },
    loadContext: load,
    play,
    pause,
    reset: () => load(contextId, "start"),
    async previewDraft(assetId, score) {
      canonical.stop();
      canonicalAsset = null;
      draft = { assetId, score: structuredClone(score) };
      if (running) syncDraft();
    },
    clearPreview: clearDraft,
    async auditionSfx(assetId) {
      audioInit();
      await AUDIO.ctx?.resume();
      if (AUDIO.ctx?.state !== "running")
        throw new Error("Click inside the game to enable sound.");
      originalSfx(assetId.replace(/^sfx-/, ""));
      report({ type: "triggerSfx", assetId });
      setTimeout(() => {
        if (!running) void AUDIO.ctx.suspend();
      }, 1600);
    },
  },
});
window.addEventListener(
  "pointerdown",
  () => {
    audioInit();
    if (draft) void canonical.enable();
    if (!running) void AUDIO.ctx?.suspend();
  },
  { capture: true },
);
window.addEventListener("pagehide", () => {
  void runtime.dispose();
  void canonical.dispose();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) void pause();
});
// Debug-only observation aids local integration tests; there is no library write capability.
(globalThis as any).__TERMINATOR_PREVIEW__ = {
  get hostMusic() {
    return hostMusic;
  },
  get running() {
    return running;
  },
  get contextId() {
    return contextId;
  },
  get draftAssetId() {
    return draft?.assetId ?? null;
  },
  get canonicalPlaying() {
    return canonical.isPlaying;
  },
};
