import { assertScore, type Score } from "@onepage/project";

const PROTOCOL = "onepage-preview";
const MAX_MESSAGE_BYTES = 2 * 1024 * 1024;
export interface PreviewContext {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
}
export interface PreviewAsset {
  readonly id: string;
  readonly name: string;
  readonly kind: "music" | "sfx";
  readonly revision: string;
}
export interface PreviewUsage {
  readonly id: string;
  readonly contextId: string;
  readonly assetId: string;
  readonly trigger: string;
  readonly checkpoint?: string;
}
export interface PreviewCatalog {
  readonly projectId: string;
  readonly projectName: string;
  readonly contexts: readonly PreviewContext[];
  readonly assets: readonly PreviewAsset[];
  readonly usages: readonly PreviewUsage[];
}
export interface PreviewCapabilities {
  readonly audioOwner: "runtime";
  readonly seek: boolean;
  readonly previewDraft: boolean;
  readonly auditionSfx?: boolean;
  readonly musicSource?: boolean;
}
export interface PreviewReady {
  readonly catalog: PreviewCatalog;
  readonly capabilities: PreviewCapabilities;
}
export type RuntimePreviewEvent =
  | { type: "contextChanged"; contextId: string }
  | { type: "requestCue"; assetId: string; usageId?: string }
  | { type: "requestEnergy"; energy: 1 | 2 | 3 }
  | { type: "triggerSfx"; assetId: string; usageId?: string }
  | { type: "soundingCue"; assetId: string | null }
  | { type: "position"; tick: number }
  | { type: "error"; message: string }
  | {
      type: "musicSourceChanged";
      source: "runtime" | "host";
      requestId: string;
    };

/** Injectable only to support tests or a host window other than the global window. */
export interface PreviewMessageWindow {
  addEventListener(
    type: "message",
    listener: (event: MessageEvent) => void,
  ): void;
  removeEventListener(
    type: "message",
    listener: (event: MessageEvent) => void,
  ): void;
}
export interface PreviewTarget {
  postMessage(message: unknown, targetOrigin: string): void;
}
type Envelope = {
  protocol: typeof PROTOCOL;
  version: 1;
  session: string;
  type: string;
  payload: unknown;
};
type AsyncAction = void | Promise<void>;
export interface PreviewRuntimeCallbacks {
  loadContext(contextId: string, checkpoint?: string): AsyncAction;
  play(): AsyncAction;
  pause(): AsyncAction;
  reset(): AsyncAction;
  seek?(tick: number): AsyncAction;
  previewDraft?(assetId: string, score: Score): AsyncAction;
  clearPreview?(): AsyncAction;
  auditionSfx?(assetId: string): AsyncAction;
  setMusicSource?(source: "runtime" | "host"): AsyncAction;
}

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, max = 200): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= max;
const id = (value: unknown): value is string => text(value, 128);
const tick = (value: unknown): value is number =>
  Number.isSafeInteger(value) &&
  (value as number) >= 0 &&
  (value as number) <= 10000000;
const exact = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).every((key) => keys.includes(key));
function origin(value: string): string {
  const parsed = new URL(value);
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.origin !== value)
    throw new Error(
      "Preview origin must be an exact HTTP(S) origin, without a path or wildcard",
    );
  return value;
}
function withinLimit(value: unknown): boolean {
  try {
    const json = JSON.stringify(value);
    return (
      typeof json === "string" &&
      new TextEncoder().encode(json).length <= MAX_MESSAGE_BYTES
    );
  } catch {
    return false;
  }
}
function envelope(value: unknown): value is Envelope {
  return (
    object(value) &&
    withinLimit(value) &&
    exact(value, ["protocol", "version", "session", "type", "payload"]) &&
    value.protocol === PROTOCOL &&
    value.version === 1 &&
    typeof value.session === "string" &&
    /^[a-zA-Z0-9-]{32,128}$/.test(value.session) &&
    text(value.type, 32) &&
    "payload" in value
  );
}
function send(
  target: PreviewTarget,
  targetOrigin: string,
  session: string,
  type: string,
  payload: unknown = null,
): void {
  const message: Envelope = {
    protocol: PROTOCOL,
    version: 1,
    session,
    type,
    payload,
  };
  if (!withinLimit(message))
    throw new Error("Preview message exceeds the 2 MiB limit");
  target.postMessage(structuredClone(message), targetOrigin);
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
export function validPreviewCatalog(value: unknown): value is PreviewCatalog {
  if (
    !object(value) ||
    !exact(value, [
      "projectId",
      "projectName",
      "contexts",
      "assets",
      "usages",
    ]) ||
    !id(value.projectId) ||
    !text(value.projectName) ||
    !Array.isArray(value.contexts) ||
    !Array.isArray(value.assets) ||
    !Array.isArray(value.usages) ||
    value.contexts.length > 256 ||
    value.assets.length > 1024 ||
    value.usages.length > 4096
  )
    return false;
  const contexts = new Set<string>(),
    assets = new Set<string>(),
    usages = new Set<string>();
  for (const item of value.contexts) {
    if (
      !object(item) ||
      !exact(item, ["id", "name", "kind"]) ||
      !id(item.id) ||
      !text(item.name) ||
      !text(item.kind, 80) ||
      contexts.has(item.id)
    )
      return false;
    contexts.add(item.id);
  }
  for (const item of value.assets) {
    if (
      !object(item) ||
      !exact(item, ["id", "name", "kind", "revision"]) ||
      !id(item.id) ||
      !text(item.name) ||
      !["music", "sfx"].includes(item.kind as string) ||
      !text(item.revision) ||
      assets.has(item.id)
    )
      return false;
    assets.add(item.id);
  }
  for (const item of value.usages) {
    if (
      !object(item) ||
      !exact(item, ["id", "contextId", "assetId", "trigger", "checkpoint"]) ||
      !id(item.id) ||
      !id(item.contextId) ||
      !id(item.assetId) ||
      !contexts.has(item.contextId) ||
      !assets.has(item.assetId) ||
      !text(item.trigger) ||
      (item.checkpoint !== undefined && !text(item.checkpoint)) ||
      usages.has(item.id)
    )
      return false;
    usages.add(item.id);
  }
  return true;
}
function readyPayload(value: unknown): value is PreviewReady {
  if (
    !object(value) ||
    !exact(value, ["catalog", "capabilities"]) ||
    !validPreviewCatalog(value.catalog) ||
    !object(value.capabilities)
  )
    return false;
  const c = value.capabilities;
  return (
    exact(c, [
      "audioOwner",
      "seek",
      "previewDraft",
      "auditionSfx",
      "musicSource",
    ]) &&
    c.audioOwner === "runtime" &&
    typeof c.seek === "boolean" &&
    typeof c.previewDraft === "boolean" &&
    (c.auditionSfx === undefined || typeof c.auditionSfx === "boolean") &&
    (c.musicSource === undefined || typeof c.musicSource === "boolean")
  );
}
function asset(catalog: PreviewCatalog, value: unknown, kind: "music" | "sfx") {
  return (
    id(value) &&
    catalog.assets.some((item) => item.id === value && item.kind === kind)
  );
}
function runtimeEvent(
  value: unknown,
  catalog: PreviewCatalog,
): value is RuntimePreviewEvent {
  if (!object(value)) return false;
  switch (value.type) {
    case "musicSourceChanged":
      return (
        exact(value, ["type", "source", "requestId"]) &&
        id(value.requestId) &&
        ["runtime", "host"].includes(value.source as string)
      );
    case "contextChanged":
      return (
        exact(value, ["type", "contextId"]) &&
        catalog.contexts.some((item) => item.id === value.contextId)
      );
    case "requestEnergy":
      return (
        exact(value, ["type", "energy"]) &&
        [1, 2, 3].includes(value.energy as number)
      );
    case "position":
      return exact(value, ["type", "tick"]) && tick(value.tick);
    case "error":
      return exact(value, ["type", "message"]) && text(value.message, 1000);
    case "soundingCue":
      return (
        exact(value, ["type", "assetId"]) &&
        (value.assetId === null || asset(catalog, value.assetId, "music"))
      );
    case "requestCue":
    case "triggerSfx":
      return (
        exact(value, ["type", "assetId", "usageId"]) &&
        asset(
          catalog,
          value.assetId,
          value.type === "requestCue" ? "music" : "sfx",
        ) &&
        (value.usageId === undefined ||
          catalog.usages.some(
            (item) =>
              item.id === value.usageId && item.assetId === value.assetId,
          ))
      );
    default:
      return false;
  }
}

export interface PreviewHost {
  connect(): Promise<PreviewReady>;
  readonly ready: PreviewReady | undefined;
  loadContext(contextId: string, checkpoint?: string): void;
  play(): void;
  pause(): void;
  reset(): void;
  seek(tick: number): void;
  previewDraft(assetId: string, score: Score): void;
  clearPreview(): void;
  auditionSfx(assetId: string): void;
  setMusicSource(source: "runtime" | "host"): Promise<void>;
  dispose(): void;
}

/** Connect only to an explicitly instrumented iframe's contentWindow and exact origin. */
export function createPreviewHost(options: {
  target: PreviewTarget;
  origin: string;
  messageWindow?: PreviewMessageWindow;
  stopLocalAudio(): AsyncAction;
  onEvent?(event: RuntimePreviewEvent): void;
  handshakeTimeoutMs?: number;
}): PreviewHost {
  const targetOrigin = origin(options.origin);
  const local: PreviewMessageWindow = options.messageWindow ?? window;
  const timeout = options.handshakeTimeoutMs ?? 5000;
  if (!Number.isFinite(timeout) || timeout < 1 || timeout > 60000)
    throw new Error("Invalid preview handshake timeout");
  let session = "",
    ready: PreviewReady | undefined,
    disposed = false;
  const ownership = new Map<
    string,
    {
      resolve(): void;
      reject(error: Error): void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  let pending:
    | {
        resolve(value: PreviewReady): void;
        reject(error: Error): void;
        timer: ReturnType<typeof setTimeout>;
      }
    | undefined;
  function cancel(message: string) {
    if (pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error(message));
      pending = undefined;
    }
  }
  function cancelOwnership(message: string) {
    for (const wait of ownership.values()) {
      clearTimeout(wait.timer);
      wait.reject(new Error(message));
    }
    ownership.clear();
  }
  const listener = (event: MessageEvent) => {
    if (
      disposed ||
      event.source !== options.target ||
      event.origin !== targetOrigin ||
      !envelope(event.data) ||
      event.data.session !== session
    )
      return;
    if (
      event.data.type === "ready" &&
      pending &&
      readyPayload(event.data.payload)
    ) {
      ready = freeze(structuredClone(event.data.payload));
      clearTimeout(pending.timer);
      pending.resolve(ready);
      pending = undefined;
    } else if (
      event.data.type === "event" &&
      ready &&
      runtimeEvent(event.data.payload, ready.catalog)
    ) {
      const value = event.data.payload;
      if (value.type === "musicSourceChanged") {
        const wait = ownership.get(value.requestId);
        if (wait) {
          clearTimeout(wait.timer);
          ownership.delete(value.requestId);
          wait.resolve();
        }
      }
      options.onEvent?.(structuredClone(value));
    }
  };
  local.addEventListener("message", listener);
  function command(type: string, payload: unknown = null) {
    if (disposed || !ready) throw new Error("Preview handshake is not ready");
    send(options.target, targetOrigin, session, type, payload);
  }
  return {
    get ready() {
      return ready;
    },
    async connect() {
      if (disposed) throw new Error("Preview bridge is disposed");
      if (session) send(options.target, targetOrigin, session, "disconnect");
      cancel("Preview connection was replaced");
      cancelOwnership("Preview connection was replaced");
      ready = undefined;
      session = crypto.randomUUID();
      const current = session;
      await options.stopLocalAudio();
      if (disposed || current !== session)
        throw new Error("Preview connection was replaced or disposed");
      return new Promise<PreviewReady>((resolve, reject) => {
        const timer = setTimeout(() => {
          try {
            send(options.target, targetOrigin, session, "disconnect");
          } catch {
            /* The peer may have navigated away. Still reject the handshake. */
          }
          pending = undefined;
          session = "";
          reject(
            new Error("Instrumented preview did not complete its handshake"),
          );
        }, timeout);
        pending = { resolve, reject, timer };
        try {
          send(options.target, targetOrigin, session, "hello");
        } catch (error) {
          cancel(
            error instanceof Error ? error.message : "Preview handshake failed",
          );
        }
      });
    },
    loadContext(contextId, checkpoint) {
      if (
        !ready?.catalog.contexts.some((item) => item.id === contextId) ||
        (checkpoint !== undefined && !text(checkpoint))
      )
        throw new Error("Unknown preview context or invalid checkpoint");
      command(
        "loadContext",
        checkpoint === undefined ? { contextId } : { contextId, checkpoint },
      );
    },
    play() {
      command("play");
    },
    pause() {
      command("pause");
    },
    reset() {
      command("reset");
    },
    seek(value) {
      if (!ready?.capabilities.seek || !tick(value))
        throw new Error("Preview seek is unsupported or invalid");
      command("seek", { tick: value });
    },
    previewDraft(assetId, score) {
      if (
        !ready?.capabilities.previewDraft ||
        !asset(ready.catalog, assetId, "music")
      )
        throw new Error(
          "Draft preview is unsupported or the music asset is unknown",
        );
      assertScore(score);
      command("previewDraft", { assetId, score });
    },
    setMusicSource(source) {
      if (
        !ready?.capabilities.musicSource ||
        !["runtime", "host"].includes(source)
      )
        return Promise.reject(
          new Error("Independent music routing is unsupported"),
        );
      return new Promise<void>((resolve, reject) => {
        const requestId = crypto.randomUUID();
        const timer = setTimeout(() => {
          ownership.delete(requestId);
          reject(new Error("Music routing timed out"));
        }, timeout);
        ownership.set(requestId, { resolve, reject, timer });
        try {
          command("setMusicSource", { source, requestId });
        } catch (e) {
          clearTimeout(timer);
          ownership.delete(requestId);
          reject(e);
        }
      });
    },
    auditionSfx(assetId) {
      if (
        !ready?.capabilities.auditionSfx ||
        !asset(ready.catalog, assetId, "sfx")
      )
        throw new Error("SFX audition is unsupported or unknown");
      command("auditionSfx", { assetId });
    },
    clearPreview() {
      if (!ready?.capabilities.previewDraft)
        throw new Error("Draft preview is unsupported");
      command("clearPreview");
    },
    dispose() {
      if (disposed) return;
      try {
        if (session) send(options.target, targetOrigin, session, "disconnect");
      } finally {
        disposed = true;
        cancelOwnership("Preview bridge was disposed");
        ready = undefined;
        cancel("Preview bridge was disposed");
        local.removeEventListener("message", listener);
      }
    },
  };
}

/** Runtime owns music playback for this session; callbacks never receive editor library access. */
export function createPreviewRuntime(options: {
  host: PreviewTarget;
  hostOrigin: string;
  messageWindow?: PreviewMessageWindow;
  catalog: PreviewCatalog;
  callbacks: PreviewRuntimeCallbacks;
}): { report(event: RuntimePreviewEvent): void; dispose(): Promise<void> } {
  const targetOrigin = origin(options.hostOrigin);
  const local: PreviewMessageWindow = options.messageWindow ?? window;
  if (!validPreviewCatalog(options.catalog) || !withinLimit(options.catalog))
    throw new Error("Invalid preview catalog");
  if (!!options.callbacks.previewDraft !== !!options.callbacks.clearPreview)
    throw new Error(
      "Draft preview requires both previewDraft and clearPreview callbacks",
    );
  const catalog = freeze(structuredClone(options.catalog));
  const capabilities: PreviewCapabilities = {
    audioOwner: "runtime",
    seek: !!options.callbacks.seek,
    previewDraft: !!options.callbacks.previewDraft,
    ...(options.callbacks.auditionSfx ? { auditionSfx: true } : {}),
    ...(options.callbacks.setMusicSource ? { musicSource: true } : {}),
  };
  let session: string | undefined,
    disposed = false,
    ready = false;
  let queue: Promise<void> = Promise.resolve();
  function report(event: RuntimePreviewEvent) {
    if (disposed || !ready || !session)
      throw new Error("Preview runtime is not connected");
    if (!runtimeEvent(event, catalog))
      throw new Error("Invalid preview runtime event");
    send(options.host, targetOrigin, session, "event", event);
  }
  function enqueue(action: () => AsyncAction) {
    queue = queue.then(action).catch((error) => {
      if (ready && !disposed && session)
        send(options.host, targetOrigin, session, "event", {
          type: "error",
          message:
            (error instanceof Error
              ? error.message
              : "Preview callback failed"
            ).slice(0, 1000) || "Preview callback failed",
        });
    });
  }
  async function stop() {
    try {
      await options.callbacks.pause();
    } finally {
      await options.callbacks.clearPreview?.();
    }
  }
  const listener = (event: MessageEvent) => {
    if (
      disposed ||
      event.source !== options.host ||
      event.origin !== targetOrigin ||
      !envelope(event.data)
    )
      return;
    const message = event.data;
    if (message.type === "hello" && message.payload === null) {
      session = message.session;
      ready = false;
      enqueue(async () => {
        await stop();
        if (disposed || session !== message.session) return;
        ready = true;
        send(options.host, targetOrigin, message.session, "ready", {
          catalog,
          capabilities,
        });
      });
      return;
    }
    if (message.session !== session) return;
    const payload = message.payload;
    let action: (() => AsyncAction) | undefined;
    if (
      message.type === "setMusicSource" &&
      capabilities.musicSource &&
      object(payload) &&
      exact(payload, ["source", "requestId"]) &&
      id(payload.requestId) &&
      ["runtime", "host"].includes(payload.source as string)
    )
      action = async () => {
        const source = payload.source as "runtime" | "host";
        await options.callbacks.setMusicSource!(source);
        if (ready && session === message.session)
          report({
            type: "musicSourceChanged",
            source,
            requestId: payload.requestId as string,
          });
      };
    if (message.type === "disconnect" && payload === null) {
      session = undefined;
      ready = false;
      enqueue(stop);
      return;
    }
    if (!ready) return;
    if (["play", "pause", "reset"].includes(message.type) && payload === null)
      action = () =>
        options.callbacks[message.type as "play" | "pause" | "reset"]();
    if (
      message.type === "clearPreview" &&
      payload === null &&
      capabilities.previewDraft
    )
      action = () => options.callbacks.clearPreview!();
    if (
      message.type === "loadContext" &&
      object(payload) &&
      exact(payload, ["contextId", "checkpoint"]) &&
      catalog.contexts.some((item) => item.id === payload.contextId) &&
      (payload.checkpoint === undefined || text(payload.checkpoint))
    )
      action = () =>
        options.callbacks.loadContext(
          payload.contextId as string,
          payload.checkpoint as string | undefined,
        );
    if (
      message.type === "seek" &&
      capabilities.seek &&
      object(payload) &&
      exact(payload, ["tick"]) &&
      tick(payload.tick)
    )
      action = () => options.callbacks.seek!(payload.tick as number);
    if (
      message.type === "auditionSfx" &&
      capabilities.auditionSfx &&
      object(payload) &&
      exact(payload, ["assetId"]) &&
      asset(catalog, payload.assetId, "sfx")
    )
      action = () => options.callbacks.auditionSfx!(payload.assetId as string);
    if (
      message.type === "previewDraft" &&
      capabilities.previewDraft &&
      object(payload) &&
      exact(payload, ["assetId", "score"]) &&
      asset(catalog, payload.assetId, "music")
    ) {
      try {
        assertScore(payload.score);
        const score = structuredClone(payload.score);
        action = () =>
          options.callbacks.previewDraft!(payload.assetId as string, score);
      } catch {
        return;
      }
    }
    if (action)
      enqueue(() => {
        if (!disposed && session === message.session) return action!();
      });
  };
  local.addEventListener("message", listener);
  return {
    report,
    async dispose() {
      if (disposed) return queue;
      disposed = true;
      ready = false;
      session = undefined;
      local.removeEventListener("message", listener);
      enqueue(stop);
      await queue;
    },
  };
}
