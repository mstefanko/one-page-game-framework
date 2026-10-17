# Instrumented game preview bridge

The reusable implementation is `packages/music-editor/src/preview-bridge.ts`. It provides executable host/runtime adapters and protocol tests. The composer now uses it for an instrumented iframe of the actual locally imported Terminator game; see the [integration plan and evidence](12-terminator-integration.md). The original Lantern Courier preview remains a separate redistributable fixture. This is a known-game integration, not an arbitrary URL loader.

An external game must deliberately include this adapter in its development/preview build. A URL or folder alone does not supply scene enumeration, checkpoints, playback controls or audio assignments. Embed permissions, HTTPS/mixed-content restrictions and the game's own authentication still apply. Opaque `file:` or sandboxed `null` origins are rejected; serve the instrumented preview from a known HTTP(S) origin.

## Host example

Expose the bridge through the `@onepage/music-editor/preview-bridge` package subpath so preview builds can import it without the React composer entry point. The following code belongs in a future Studio host, after the configured instrumented iframe has loaded. The frame URL and origin come from an explicit project adapter configuration, not an arbitrary message received from a child.

```ts
import { createPreviewHost } from '@onepage/music-editor/preview-bridge';
import type { Score } from '@onepage/project';

export async function attachGamePreview(
  iframe: HTMLIFrameElement,
  stopComposerAudio: () => void,
) {
  if (!iframe.contentWindow) throw new Error('Preview frame is not mounted');
  const bridge = createPreviewHost({
    target: iframe.contentWindow,
    origin: 'https://preview.example.com',
    stopLocalAudio: stopComposerAudio,
    onEvent(event) {
      // Update host inspection UI; the game runtime already owns audio.
      // Do not start a second host synth in response to these reports.
      if (event.type === 'contextChanged') console.log('Game context', event.contextId);
      if (event.type === 'requestCue') console.log('Game requested music', event.assetId);
      if (event.type === 'triggerSfx') console.log('Game requested SFX', event.assetId);
      if (event.type === 'error') console.error(event.message);
    },
  });
  const { catalog, capabilities } = await bridge.connect();
  console.log(catalog.projectName, catalog.contexts, catalog.usages);

  return {
    showContext(contextId: string, checkpoint?: string) {
      bridge.loadContext(contextId, checkpoint);
      bridge.play(); // Serialized behind async loadContext in the runtime.
    },
    auditionDraft(assetId: string, score: Score) {
      if (!capabilities.previewDraft) throw new Error('This game has no draft override adapter');
      bridge.previewDraft(assetId, score);
    },
    clearDraft() { if (capabilities.previewDraft) bridge.clearPreview(); },
    pause() { bridge.pause(); },
    reset() { bridge.reset(); },
    seek(tick: number) { if (capabilities.seek) bridge.seek(tick); },
    dispose() { bridge.dispose(); },
  };
}
```

`connect()` stops the host's local audio before sending the handshake. It resolves only after the runtime has stopped previous preview audio, cleared transient overrides and returned a validated catalog/capability response. It rejects after five seconds by default when a game does not implement the protocol. Reconnect after a frame navigation; each connection gets a new random session token. Dispose on host teardown. Resuming composer playback after leaving preview is an explicit host action.

## Runtime adapter example

The following function is an executable integration template over a game's existing scene/replay/audio APIs. It does not implement a second renderer or synth. The actual game supplies the callbacks and original asset catalog. Include it only in an explicitly instrumented preview build; production game playback does not need editor inspection capabilities.

```ts
import {
  createPreviewRuntime,
  type PreviewCatalog,
  type RuntimePreviewEvent,
} from '@onepage/music-editor/preview-bridge';
import type { Score } from '@onepage/project';

interface GamePreviewAPI {
  loadContext(id: string, checkpoint?: string): Promise<void>;
  play(): void | Promise<void>;
  pause(): void | Promise<void>; // Must stop this game's music and SFX too.
  reset(): void | Promise<void>;
  setDraftOverride(assetId: string, score: Score): void | Promise<void>;
  clearDraftOverrides(): void | Promise<void>;
  subscribeAudioReports(listener: (event: RuntimePreviewEvent) => void): () => void;
}

export function instrumentGamePreview(game: GamePreviewAPI, catalog: PreviewCatalog) {
  const runtime = createPreviewRuntime({
    host: window.parent,
    hostOrigin: 'https://studio.example.com',
    catalog,
    callbacks: {
      loadContext: (id, checkpoint) => game.loadContext(id, checkpoint),
      play: () => game.play(),
      pause: () => game.pause(),
      reset: () => game.reset(),
      previewDraft: (assetId, score) => game.setDraftOverride(assetId, score),
      clearPreview: () => game.clearDraftOverrides(),
      // Add seek(tick) only if the game can restore/replay state correctly.
    },
  });
  const unsubscribe = game.subscribeAudioReports(event => {
    try { runtime.report(event); }
    catch (error) {
      // There may be no attached host yet. Invalid catalog references should
      // also be diagnosed by the game's own development tooling.
      console.debug('Preview report unavailable', error);
    }
  });
  return async () => { unsubscribe(); await runtime.dispose(); };
}

export const exampleCatalog: PreviewCatalog = {
  projectId: 'my-platformer',
  projectName: 'My platformer',
  contexts: [{ id: 'cave-entrance', name: 'Cave entrance', kind: 'level' }],
  assets: [
    { id: 'cave-theme', name: 'Cave theme', kind: 'music', revision: 'revision-4' },
    { id: 'jump', name: 'Jump', kind: 'sfx', revision: 'revision-2' },
  ],
  usages: [
    { id: 'cave-enter', contextId: 'cave-entrance', assetId: 'cave-theme', trigger: 'enter', checkpoint: 'door' },
    { id: 'cave-jump', contextId: 'cave-entrance', assetId: 'jump', trigger: 'jump' },
  ],
};
```

The game's loader validates checkpoint names against its own replay/scene data. An opaque checkpoint string is a reference, never script or a path to execute. The bridge's catalog is a frozen snapshot with unique identities and validated usage references. Music and SFX retain distinct asset kinds. Draft override commands target an existing music asset, carry a fully validated canonical `Score`, and cannot write the library or alter a pinned catalog revision. Clearing preview or disconnecting invokes the runtime's cleanup callbacks.

## Protocol and ownership

Every envelope contains `protocol: "onepage-preview"`, `version: 1`, a random session token, `type` and `payload`. Both peers require exact `MessageEvent.source` identity and exact configured HTTP(S) origin before interpreting data. Every `postMessage` uses that origin. Unknown versions, unknown fields/types, stale sessions, invalid payloads, wrong asset kinds and messages above 2 MiB are ignored. The host validates the `ready` catalog and capabilities before enabling commands. Catalog limits are 256 contexts, 1,024 assets and 4,096 usages. This is a connection boundary for an explicitly trusted/instrumented preview, not a sandbox for arbitrary game code.

Host commands are `loadContext`, `play`, `pause`, `reset`, optional `seek`, optional `previewDraft`, and `clearPreview`. The runtime serializes callbacks, including asynchronous context loads. Reports are `contextChanged`, `requestCue`, `requestEnergy`, `triggerSfx`, `soundingCue`, `position` and `error`. Request reports describe the game's own audio behavior; the host observes them and must not duplicate playback. The default music owner is the runtime. An optional `musicSource` capability adds `setMusicSource("host" | "runtime")` and a `musicSourceChanged` report, both carrying the same unique request ID. A host awaits that acknowledgement before playing working music. The runtime suppresses only music while the host owns it; simulation and SFX stay active. On returning to runtime ownership, request the current cue again even if its identity is unchanged, so saved assignments restore. Cleanup pauses the runtime and clears draft overrides; it does not auto-resume the host's audio. See [the composing workflow](16-compose-with-game.md).

The bridge has no direct filesystem/library access, project mutation command, arbitrary URL loader or automatic assignment update. The Terminator host stores explicitly pinned overrides separately in IndexedDB and reapplies them through draft-preview commands; it does not rewrite the original game source. Other project integrations must supply their own assignment transaction. Browser autoplay policy still applies: the game's existing sound-enable interaction must unlock its own audio context; receiving a bridge message does not create a user gesture in the child frame.

Run `npx vitest run packages/music-editor/src/preview-bridge.test.ts` to verify handshake/capabilities, wrong source/origin/session/version/schema rejection, bounded draft overrides, asynchronous ordering, reconnect, timeout and disposal. The tests use injected message windows. Local Terminator browser tests additionally exercise the actual imported game's instrumentation and embedding. An optional `auditionSfx` capability allows a host to request a known catalog sound effect; runtimes that do not advertise it retain the original protocol behavior.
