import { afterEach, describe, expect, it, vi } from "vitest";
import { createBlankScore } from "@onepage/project";
import {
  createPreviewHost,
  createPreviewRuntime,
  type PreviewCatalog,
  type PreviewMessageWindow,
  type PreviewRuntimeCallbacks,
  type PreviewTarget,
} from "./preview-bridge";

const HOST = "https://studio.example",
  CHILD = "https://game.example";
const catalog: PreviewCatalog = {
  projectId: "platformer",
  projectName: "Platformer",
  contexts: [{ id: "cave-entrance", name: "Cave entrance", kind: "level" }],
  assets: [
    {
      id: "explore",
      name: "Explore music",
      kind: "music",
      revision: "pinned-1",
    },
    { id: "jump", name: "Jump", kind: "sfx", revision: "pinned-2" },
  ],
  usages: [
    {
      id: "cave-music",
      contextId: "cave-entrance",
      assetId: "explore",
      trigger: "enter",
      checkpoint: "door",
    },
    {
      id: "jump-use",
      contextId: "cave-entrance",
      assetId: "jump",
      trigger: "jump",
    },
  ],
};
class Inbox implements PreviewMessageWindow {
  listeners = new Set<(event: MessageEvent) => void>();
  addEventListener(_type: "message", listener: (event: MessageEvent) => void) {
    this.listeners.add(listener);
  }
  removeEventListener(
    _type: "message",
    listener: (event: MessageEvent) => void,
  ) {
    this.listeners.delete(listener);
  }
  emit(data: unknown, source: PreviewTarget, origin: string) {
    for (const listener of this.listeners)
      listener({ data, source, origin } as unknown as MessageEvent);
  }
}
const disposals: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of disposals.splice(0)) await dispose();
  vi.useRealTimers();
});
function setup(overrides: Partial<PreviewRuntimeCallbacks> = {}) {
  const hostInbox = new Inbox(),
    childInbox = new Inbox();
  const sentToChild: { message: Record<string, unknown>; origin: string }[] =
    [];
  const sentToHost: { message: Record<string, unknown>; origin: string }[] = [];
  const hostWindow: PreviewTarget = {
    postMessage(message, origin) {
      sentToHost.push({ message: message as Record<string, unknown>, origin });
      queueMicrotask(() =>
        hostInbox.emit(structuredClone(message), childWindow, CHILD),
      );
    },
  };
  const childWindow: PreviewTarget = {
    postMessage(message, origin) {
      sentToChild.push({ message: message as Record<string, unknown>, origin });
      queueMicrotask(() =>
        childInbox.emit(structuredClone(message), hostWindow, HOST),
      );
    },
  };
  const callbacks = {
    loadContext: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    reset: vi.fn(),
    seek: vi.fn(),
    previewDraft: vi.fn(),
    clearPreview: vi.fn(),
    ...overrides,
  };
  const stopLocalAudio = vi.fn(),
    onEvent = vi.fn();
  const runtime = createPreviewRuntime({
    host: hostWindow,
    hostOrigin: HOST,
    messageWindow: childInbox,
    catalog,
    callbacks,
  });
  const host = createPreviewHost({
    target: childWindow,
    origin: CHILD,
    messageWindow: hostInbox,
    stopLocalAudio,
    onEvent,
  });
  disposals.push(
    () => host.dispose(),
    () => runtime.dispose(),
  );
  const command = (type: string, payload: unknown = null) => ({
    protocol: "onepage-preview",
    version: 1,
    session: sentToChild[0]?.message.session,
    type,
    payload,
  });
  return {
    host,
    runtime,
    hostWindow,
    childWindow,
    hostInbox,
    childInbox,
    callbacks,
    onEvent,
    stopLocalAudio,
    sentToChild,
    sentToHost,
    command,
  };
}
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("instrumented preview bridge", () => {
  it("handshakes with exact origins, immutable catalog and one runtime audio owner", async () => {
    const s = setup();
    expect(() => s.host.play()).toThrow("not ready");
    const ready = await s.host.connect();
    expect(s.stopLocalAudio).toHaveBeenCalledOnce();
    expect(s.callbacks.pause).toHaveBeenCalledOnce();
    expect(s.callbacks.clearPreview).toHaveBeenCalledOnce();
    expect(ready.catalog).toEqual(catalog);
    expect(Object.isFrozen(ready.catalog.usages)).toBe(true);
    expect(ready.capabilities).toEqual({
      audioOwner: "runtime",
      seek: true,
      previewDraft: true,
    });
    expect(s.sentToChild.every((message) => message.origin === CHILD)).toBe(
      true,
    );
    expect(s.sentToHost.every((message) => message.origin === HOST)).toBe(true);
    s.host.loadContext("cave-entrance", "door");
    s.host.play();
    s.host.seek(480);
    s.host.pause();
    s.host.reset();
    await flush();
    expect(s.callbacks.loadContext).toHaveBeenCalledWith(
      "cave-entrance",
      "door",
    );
    expect(s.callbacks.play).toHaveBeenCalledOnce();
    expect(s.callbacks.seek).toHaveBeenCalledWith(480);
    expect(s.callbacks.reset).toHaveBeenCalledOnce();
    s.runtime.report({
      type: "requestCue",
      assetId: "explore",
      usageId: "cave-music",
    });
    s.runtime.report({ type: "requestEnergy", energy: 2 });
    s.runtime.report({
      type: "triggerSfx",
      assetId: "jump",
      usageId: "jump-use",
    });
    s.runtime.report({ type: "contextChanged", contextId: "cave-entrance" });
    await flush();
    expect(s.onEvent).toHaveBeenCalledTimes(4);
  });

  it("ignores wrong source, origin, session, protocol and payload before any callback", async () => {
    const s = setup();
    await s.host.connect();
    const fake: PreviewTarget = { postMessage() {} };
    s.childInbox.emit(s.command("play"), fake, HOST);
    s.childInbox.emit(
      s.command("play"),
      s.hostWindow,
      "https://attacker.example",
    );
    s.childInbox.emit(
      { ...s.command("play"), session: crypto.randomUUID() },
      s.hostWindow,
      HOST,
    );
    s.childInbox.emit({ ...s.command("play"), version: 2 }, s.hostWindow, HOST);
    s.childInbox.emit(
      s.command("play", { script: "payload" }),
      s.hostWindow,
      HOST,
    );
    s.childInbox.emit(
      s.command("loadContext", { contextId: "unknown" }),
      s.hostWindow,
      HOST,
    );
    s.childInbox.emit(
      s.command("seek", { tick: Infinity }),
      s.hostWindow,
      HOST,
    );
    s.childInbox.emit(
      s.command("previewDraft", {
        assetId: "explore",
        score: { schemaVersion: 99 },
      }),
      s.hostWindow,
      HOST,
    );
    await flush();
    expect(s.callbacks.play).not.toHaveBeenCalled();
    expect(s.callbacks.loadContext).not.toHaveBeenCalled();
    expect(s.callbacks.seek).not.toHaveBeenCalled();
    expect(s.callbacks.previewDraft).not.toHaveBeenCalled();
    const event = s.command("event", {
      type: "requestCue",
      assetId: "explore",
    });
    s.hostInbox.emit(event, fake, CHILD);
    s.hostInbox.emit(event, s.childWindow, "https://attacker.example");
    s.hostInbox.emit(
      { ...event, session: crypto.randomUUID() },
      s.childWindow,
      CHILD,
    );
    s.hostInbox.emit(
      s.command("event", { type: "triggerSfx", assetId: "explore" }),
      s.childWindow,
      CHILD,
    );
    await flush();
    expect(s.onEvent).not.toHaveBeenCalled();
  });

  it("requires a validated ready schema and the right peer before host readiness", async () => {
    const inbox = new Inbox();
    let hello: Record<string, unknown> = {};
    const target: PreviewTarget = {
      postMessage(value) {
        hello = value as Record<string, unknown>;
      },
    };
    const host = createPreviewHost({
      target,
      origin: CHILD,
      messageWindow: inbox,
      stopLocalAudio() {},
    });
    disposals.push(() => host.dispose());
    const connected = host.connect();
    await flush();
    const ready = {
      ...hello,
      type: "ready",
      payload: {
        catalog,
        capabilities: {
          audioOwner: "runtime",
          seek: false,
          previewDraft: false,
        },
      },
    };
    inbox.emit(
      { ...ready, payload: { catalog, capabilities: { audioOwner: "host" } } },
      target,
      CHILD,
    );
    inbox.emit(ready, { postMessage() {} }, CHILD);
    inbox.emit(ready, target, HOST);
    expect(host.ready).toBeUndefined();
    inbox.emit(ready, target, CHILD);
    expect((await connected).catalog.projectId).toBe("platformer");
  });

  it("validates and clones bounded draft overrides without changing catalog revisions", async () => {
    const s = setup();
    await s.host.connect();
    const score = createBlankScore();
    s.host.previewDraft("explore", score);
    score.title = "Later unsent edit";
    await flush();
    expect(s.callbacks.previewDraft).toHaveBeenCalledWith(
      "explore",
      expect.objectContaining({ title: "Untitled cue" }),
    );
    expect(s.host.ready?.catalog.assets[0].revision).toBe("pinned-1");
    expect(() => s.host.previewDraft("jump", score)).toThrow("unknown");
    s.childInbox.emit(
      s.command("previewDraft", {
        assetId: "explore",
        score: { ...score, junk: "x".repeat(2 * 1024 * 1024) },
      }),
      s.hostWindow,
      HOST,
    );
    await flush();
    expect(s.callbacks.previewDraft).toHaveBeenCalledOnce();
  });

  it("serializes async context loading before play and discards old sessions on reconnect", async () => {
    let loaded!: () => void;
    const order: string[] = [];
    const s = setup({
      loadContext: () =>
        new Promise<void>((resolve) => {
          order.push("loading");
          loaded = () => {
            order.push("loaded");
            resolve();
          };
        }),
      play: () => {
        order.push("play");
      },
    });
    await s.host.connect();
    const oldSession = s.sentToChild[0].message.session;
    s.host.loadContext("cave-entrance");
    s.host.play();
    await flush();
    expect(order).toEqual(["loading"]);
    loaded();
    await flush();
    expect(order).toEqual(["loading", "loaded", "play"]);
    await s.host.connect();
    s.childInbox.emit(
      { ...s.command("reset"), session: oldSession },
      s.hostWindow,
      HOST,
    );
    await flush();
    expect(s.callbacks.reset).not.toHaveBeenCalled();
  });

  it("disposes listeners, clears transient overrides and stops runtime audio", async () => {
    const s = setup();
    await s.host.connect();
    s.host.dispose();
    await flush();
    expect(s.hostInbox.listeners.size).toBe(0);
    expect(s.callbacks.pause).toHaveBeenCalledTimes(2);
    expect(s.callbacks.clearPreview).toHaveBeenCalledTimes(2);
    expect(() => s.host.play()).toThrow("not ready");
    expect(() => s.runtime.report({ type: "position", tick: 0 })).toThrow(
      "not connected",
    );
    await s.runtime.dispose();
    expect(s.childInbox.listeners.size).toBe(0);
  });

  it("fails closed for opaque/wildcard origins, invalid catalogs and unsupported capabilities", async () => {
    const target = { postMessage() {} };
    for (const value of [
      "*",
      "null",
      "file:///tmp/game.html",
      "https://game.example/path",
    ])
      expect(() =>
        createPreviewHost({
          target,
          origin: value,
          messageWindow: new Inbox(),
          stopLocalAudio() {},
        }),
      ).toThrow();
    const s = setup({
      seek: undefined,
      previewDraft: undefined,
      clearPreview: undefined,
    });
    await s.host.connect();
    expect(() => s.host.seek(1)).toThrow("unsupported");
    expect(() => s.host.previewDraft("explore", createBlankScore())).toThrow(
      "unsupported",
    );
    expect(() =>
      s.runtime.report({ type: "triggerSfx", assetId: "explore" }),
    ).toThrow("Invalid");
    expect(() =>
      createPreviewRuntime({
        host: target,
        hostOrigin: HOST,
        messageWindow: new Inbox(),
        catalog: { ...catalog, contexts: [] },
        callbacks: s.callbacks,
      }),
    ).toThrow("catalog");
  });

  it("times out cleanly when an iframe does not implement the protocol", async () => {
    vi.useFakeTimers();
    const target = { postMessage: vi.fn() },
      inbox = new Inbox();
    const host = createPreviewHost({
      target,
      origin: CHILD,
      messageWindow: inbox,
      stopLocalAudio() {},
      handshakeTimeoutMs: 20,
    });
    disposals.push(() => host.dispose());
    const promise = host.connect();
    const rejected = expect(promise).rejects.toThrow("handshake");
    await vi.advanceTimersByTimeAsync(21);
    await rejected;
    expect(host.ready).toBeUndefined();
    expect(target.postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "disconnect" }),
      CHILD,
    );
  });
});

describe("optional native sound effect audition", () => {
  it("permits only an advertised existing SFX asset after a trusted handshake", async () => {
    const auditionSfx = vi.fn();
    const s = setup({ auditionSfx });
    const ready = await s.host.connect();
    expect(ready.capabilities.auditionSfx).toBe(true);
    s.host.auditionSfx("jump");
    await flush();
    expect(auditionSfx).toHaveBeenCalledExactlyOnceWith("jump");
    expect(() => s.host.auditionSfx("explore")).toThrow(
      "unsupported or unknown",
    );
    s.childInbox.emit(
      s.command("auditionSfx", { assetId: "jump", extra: true }),
      s.hostWindow,
      HOST,
    );
    s.childInbox.emit(
      s.command("auditionSfx", { assetId: "jump" }),
      s.hostWindow,
      "https://wrong.example",
    );
    await flush();
    expect(auditionSfx).toHaveBeenCalledTimes(1);
    const unsupported = setup();
    await unsupported.host.connect();
    expect(() => unsupported.host.auditionSfx("jump")).toThrow("unsupported");
  });
});

describe("independent game and host music ownership", () => {
  it("acknowledges a routing change only after the runtime has suppressed its music", async () => {
    let complete!: () => void;
    const setMusicSource = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve;
        }),
    );
    const s = setup({ setMusicSource });
    expect((await s.host.connect()).capabilities.musicSource).toBe(true);
    let acknowledged = false;
    const routed = s.host.setMusicSource("host").then(() => {
      acknowledged = true;
    });
    await flush();
    expect(setMusicSource).toHaveBeenCalledExactlyOnceWith("host");
    expect(acknowledged).toBe(false);
    expect(s.callbacks.pause).toHaveBeenCalledOnce();
    complete();
    await routed;
    expect(acknowledged).toBe(true);
    s.childInbox.emit(
      s.command("setMusicSource", { source: "host", extra: true }),
      s.hostWindow,
      HOST,
    );
    s.childInbox.emit(
      s.command("setMusicSource", { source: "other" }),
      s.hostWindow,
      HOST,
    );
    await flush();
    expect(setMusicSource).toHaveBeenCalledTimes(1);
  });
  it("rejects unavailable routing and cancels pending ownership on disposal", async () => {
    const unsupported = setup();
    await unsupported.host.connect();
    await expect(unsupported.host.setMusicSource("host")).rejects.toThrow(
      "unsupported",
    );
    const s = setup({ setMusicSource: () => new Promise<void>(() => {}) });
    await s.host.connect();
    const pending = s.host.setMusicSource("host");
    const rejection = expect(pending).rejects.toThrow("disposed");
    s.host.dispose();
    await rejection;
    // Do not block fixture cleanup on the deliberately unresolved callback.
    disposals.pop();
  });
});

it("correlates rapid host → runtime → host routing acknowledgements with their requests", async () => {
  const completes: (() => void)[] = [];
  const s = setup({
    setMusicSource: () =>
      new Promise<void>((resolve) => completes.push(resolve)),
  });
  await s.host.connect();
  const acknowledged: string[] = [];
  const first = s.host
    .setMusicSource("host")
    .then(() => acknowledged.push("first"));
  const middle = s.host
    .setMusicSource("runtime")
    .then(() => acknowledged.push("middle"));
  const last = s.host
    .setMusicSource("host")
    .then(() => acknowledged.push("last"));
  await flush();
  expect(completes).toHaveLength(1);
  completes[0]!();
  await first;
  expect(acknowledged).toEqual(["first"]);
  await flush();
  completes[1]!();
  await middle;
  expect(acknowledged).toEqual(["first", "middle"]);
  await flush();
  completes[2]!();
  await last;
  expect(acknowledged).toEqual(["first", "middle", "last"]);
});
