# Pocket Score: implementation and orchestration plan

Decision: October 17, 2026. This is the current composer implementation handoff and supersedes conflicting UI proposals in documents 04/05. The broader one-page framework remains in scope. Implementation status must be established by running artifacts, not this plan.

The subsequent [playable composer and real-game plan](14-playable-composer-plan.md) supersedes this document's initial target-only Arcade experiment and demo-only game integration sequence. Its implementation adds song-aware character gestures and an adapter for the actual local Terminator game while retaining these score, storage and export contracts.

## Product decisions after the second review

- One song/cue is edited at a time. **Sketch** and **Studio** are the composing views. A compact section strip and collapsible overview replace the redundant Scenes/Song screen. **Game audio** is a separate project workspace.
- Home says “Score a moment in your game.” Original starters have game-moment and loop/one-shot labels. A starter opens its suggested edit (for example Drums and the last snare). Blank/Jam opens the live pad. Choosing Sketch directly opens the live pad initially; remember the user's explicit surface choice. Edit-notes commands always open notes. No forced mode conversion.
- Sketch supports Notes, Live pad, and an explicitly experimental Arcade surface. Instrument/part selection owns sound and useful pitch range; percussion uses named kit voices. Performance creates ordinary editable notes. Tempo remains fixed unless deliberately changed in song settings.
- Arcade is an experiment to **build and play**, not reject from screenshots. Compare note-authoring and adaptive-energy play separately. Targets/gestures have visible musical mappings, no failure screen or hidden tempo changes, and use the same capture/history as the pad. Retain or cut based on deliberate expression, repeatability, and keep/recovery tests.
- Game audio catalogs all music and SFX referenced by a connected framework project. Selecting an asset shows **where used**, the actual level/menu/cutscene context, assigned revision, and preview checkpoint. Selecting a usage loads that moment in a live preview. Multi-scene organization belongs here.
- Preview a working music draft against the game without updating its pinned assets. Save a version and explicitly apply the assignment to update a project. SFX retains a distinct schema/editor; never turn it into a song track to simplify implementation.
- No new game-engine rewrite. Reuse the framework's eventual scene loader/renderer/replay APIs. A small original preview fixture can prove the audio interface before the complete runtime exists.

## Review validation and corrections

Accepted: remove onboarding-purpose tabs; show starter-specific edits immediately; simplify title/transport menus; expose tempo, scale, meter, arrangement length, parts and loop/one-shot; one foreground dialog; sequential take labels; clear target instrument; backup/restore and concurrent-edit protection; preview loop joins; game contexts outside composition.

Adjusted or rejected:

1. Keep **480 PPQ**, already canonical. Both 96 and 480 represent 6.5 beats, but 480 also represents supported quintuplets. One score is one constant-tempo/meter musical cue; game contexts reference scores. This intentionally flattens the earlier multi-cue score outline and avoids conflating a game scene with an arrangement section.
2. Keep **React + TypeScript + Vite**, already selected; no Svelte/Solid migration justified by this prototype.
3. OGG is not an initial dependency. Compact score+patch+runtime packs avoid large WAVs in framework games. Add compressed codecs only after encoder/license/loop tests and measured need.
4. Native Web Audio nodes and a shared graph can support both realtime scheduling and offline rendering. AudioWorklet is a later measured DSP decision, not a prerequisite. Never drive offline rendering with a wall-clock lookahead timer.
5. localStorage blocks the main JavaScript thread, not directly the audio rendering thread. This can still delay scheduling. Use IndexedDB.
6. Safari's documented ITP rule concerns seven days **of Safari use without user interaction**, not a universal seven-calendar-day expiry. Persistence is heuristic and denied persistence does not mean a failed save. [WebKit ITP](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/), [WebKit storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/).
7. GitHub Pages lacks configurable response headers; do not require SharedArrayBuffer/cross-origin isolation. Service-worker isolation workarounds exist but add deployment constraints and are unnecessary here. [coi-serviceworker](https://github.com/gzuidhof/coi-serviceworker).
8. Folder saving is capability/outcome based, not a browser-name promise. A successful picker is not a successful write. Download/open works everywhere we support.
9. The supplied prototype already includes drum-grid, Enable Sound and Resume Sound markup. Their discovery and functional wiring need validation; they are not absent designs.
10. “v2 + 4 edits” is not the primary save label: command counts are ambiguous across undo/redo. Prefer “Saved in this browser”; expose version ancestry in history.

## Libraries and package boundaries

Root installation pins exact versions in package manifests and package-lock.json. Do not fetch runtime code from a CDN. Review licenses with the installed package artifacts.

| Layer | Dependency / responsibility | Exclusions |
|---|---|---|
| `packages/project` | `@sinclair/typebox`; typed JSON schemas, semantic validation, original starter fixtures, game audio manifest schemas | No browser/audio/UI/storage |
| `packages/music-core` | Tick math, windowed event compilation, clip expansion, deterministic gesture rules, transition decisions | No React or AudioContext |
| `packages/music-web-audio` | Native Web Audio; deterministic voices, audio-clock lookahead, shared offline graph, WAV encoding | No storage, importers, scene ownership |
| `packages/asset-library` | `idb`; revision-checked drafts, immutable versions, recoverable trash, backup schema | No required server/account |
| `packages/music-io` | `fflate`, `@tonejs/midi`, `midi-file`; bounded packs, conversion reports, MIDI, player HTML | No silent conversion loss or executing imported scripts |
| `packages/music-editor` | React; shared commands/history, views, piano roll/drums, live and arcade surfaces, project audio workspace | No second score or synth |
| `apps/composer` | Vite host, relative assets/hash routing, capability wiring | No duplicated editor implementation |
| `apps/studio` | Later framework host for the same music editor and project audio catalog | No separate composer fork |
| Verification | Vitest, fake-indexeddb, Playwright; native browser render checks | Browser tests cannot certify physical-device sound quality |

BeepBox remains a comparison backend at the proof gate, not a second shipped engine. Tone.js is not needed merely to use its MIDI parser. The existing ZzFX SFX adapter plan remains a later generalized SFX implementation; a clearly bounded original preview sound fixture may use the shared voice graph until that adapter is measured and pinned.

## Shared interfaces

### Score and event interpretation

`Score`: schemaVersion 1; stable id/title; ppq 480; bpm; meter tuple; scale root/mode; playback loop or one-shot; positive lengthTicks; optional explicit loop range; tracks, patches, patterns, clips, sections.

`Note`: id, integer startTick/durationTicks, MIDI pitch, velocity 0..1. `Pattern`: id/name/lengthTicks/notes. `Clip`: id/trackId/patternId/startTick/repeats/transpose. `Track`: id/name/role/patchId/gain/pan/minEnergy. Track roles are labels, not hardware channels.

`Patch`: id/name/waveform/attack/release/brightness/duty; bounds validated before audio. The initial waveform set is pulse, triangle, sine, sawtooth, noise. Optional later backend parameters require schema migration.

`compileScore(score, {startTick,endTick,energy})` returns deterministic expanded notes with absolute musical ticks and resolved track gain/pan/patch. Window boundaries are half-open; crossing notes are trimmed under a declared restart-envelope approximation. Explicit 3120-tick phrases are first-class.

Changing scale guidance never silently transposes existing music. Changing song length must not truncate content silently. Linked-pattern edits affect each instance; Make unique copies the pattern in one command. Instruments, sections, patterns and tracks use stable IDs, never title/index identity.

### Editor/session commands

One canonical draft and one bounded history belong to a working song. The initial implementation may use validated immutable snapshots behind command functions; every musical operation is named and undoable. View, cursor, transport, solo, selection and reference preview are editor state. History is not embedded into runtime score data.

Draft edits, undo and redo all queue persistence. Keep an in-memory authoritative working copy on save failure. Switching songs awaits or safely preserves pending writes. Library restore never overwrites an immutable version.

### Browser library

`createLibrary(name?)` provides list/readDraft/saveDraft(expectedRevision)/saveVersion/listVersions/readVersion/restoreVersion/deleteSong/close. A draft has score, monotonically increasing revision, updatedAt. SaveVersion captures deep immutable content. Atomic expected-revision checks reject stale writers with the latest draft available for conflict resolution.

BroadcastChannel may announce edits but is not a correctness mechanism. A second tab can open read-only, reload, or preserve its local work as a copy. Do not automatically overwrite another tab.

Library backup and song packs share a versioned archive family; manifest kind distinguishes song vs library. Validate all entries and dependencies before committing. Cap bytes/counts/decompressed sizes, reject traversal/ambiguous entries and unsupported versions. Import collision must preserve both or stop, never overwrite by name.

### Audio and take capture

`AudioEngine.enable/play/stop/dispose/getPositionTick/previewNote`; play options select range, loop, energy, mute/solo. Native audio clock is musical authority; React animation samples transport state. Stop/dispose cancel scheduled future voices as well as sounding voices.

`renderScore` pre-schedules the same graph into OfflineAudioContext. WAV defaults stereo 48 kHz/16-bit. Listening export permits finite repeats/tail. Loop-body export has explicit range, join audition and no unsupported promise of seamless effects. Render snapshots are frozen at render start; later edits are excluded.

`Take`: stable id, target part/patch, backing draft identity/revision, loop bounds, captured note events, complete/incomplete state. A keep operation freezes the selected take, then adds a new part or replaces the selected pattern explicitly. No regenerated notes on keep. Keep two completed nonempty takes plus bounded current input. Pointer cancel, blur, stop and sound interruption end voices and preserve partial work.

Live pad and Arcade are input adapters into this take interface. Pitch bands/kit rows, density and timbre are visible. Initial tests compare a vertical strip plus density control with a two-axis pad. Keyboard instrument keys must not steal text fields or note-editor shortcuts.

### Game audio workspace and bridge

Project manifest has stable project/version IDs, audio assets keyed by id/kind/revision, and usages: context id/name/type (menu, level, cutscene), asset reference, event/trigger, and preview checkpoint/replay reference. Music and SFX are separate kinds. A where-used index is derived from references; edits do not guess usage by filename.

Navigation: Game audio → music or SFX asset → usage → preview context → edit/audition → return. The viewport remains visible while editing where space allows; on phone it is a separate panel. SFX events can be auditioned in isolation and at their occurrence in replay. Loops, stingers and one-shots have explicit behaviors.

Preview commands use a versioned, validated protocol: ready/capabilities, listContexts, loadContext, play/pause/reset/seek (if supported), requestCue/requestEnergy/triggerSfx, previewDraft/clearPreview. Runtime reports contextChanged, audioRequested, soundingCue, energy, position, error. A session token/message port and source/origin verification isolate the connection. No wildcard trust of arbitrary frame messages. Untrusted game code never runs with direct editor library access.

The production playback API is smaller than the editor bridge. The shared renderer/player code is reused, but scene enumeration, inspection and draft override are editor capabilities, not shipped requirements. Exactly one music owner plays during preview to prevent doubled audio. Draft overrides are ephemeral; assignment updates copy/pin the dependency closure in a project transaction.

Start with a built-in original game fixture: menu, exploration, combat and victory; reusable SFX and music usages; deterministic replay plus a playable interaction. It proves the bridge/catalog path without claiming arbitrary games are connected. External game integration requires an instrumented supported build; arbitrary URLs/folders, blocked embedding, and HTTPS→localhost cannot be assumed to work. File-backed images/videos are a useful independent fallback, not a replacement for live game integration.

## Ordered execution and parallel ownership

1. **Foundation wave (parallel)**: score/compiler and six fixtures; idb library/concurrency; audio graph/live/offline proof. Root owns package manifests/build/test configuration and interface decisions.
2. **Feature wave (parallel after contracts)**: React composer/Sketch/Studio/live capture; source/MIDI/WAV/player IO; Game audio manifest/catalog/built-in preview/Arcade experiment. Shared files have one owner; requests cross through root.
3. **Integration**: root connects storage, transport, imports/exports, game context and capture. Fix cross-package issues, add browser journeys, update status docs.
4. **Hardening**: backend comparison evidence; malformed/import-loss fixtures; archive limits; stale-save/quota tests; nested-path and local player tests; lifecycle/voice cleanup; accessibility and responsive checks; physical-device audio checks and musician/novice listening.
5. **Follow-on framework work**: real project adapter, ZzFX recipes, stable replay/checkpoint interface, explicit pinned-version updates, generic game export; compressed codecs only if measured needs justify them. Service worker/installability follows tested migrations and update behavior. Cloud remains deferred.

## Acceptance and limits

- First complete loop: choose a distinct starter → hear/edit → live/arcade take → keep → refine same notes → save/reload → source round-trip → render actual WAV.
- One-shot ends; loop respects explicit region; fractional phrase stays exact; changing view preserves source and selection; linked/unique edits are explicit.
- Library backups are validated; stale writes preserve both; failure labels reflect real results; local save never implies cloud sync or external backup.
- MIDI preflight reports unsupported events and unrepresentable ticks. A limited importer may reject unsupported files rather than pretend to convert them. No parser-only import is considered lossless.
- Game audio shows music and SFX uses and loads the selected preview context; working draft preview leaves pinned versions intact; no duplicate audio owner. Demo-only support is labeled.
- Arcade is usable with mouse/touch/keyboard alternatives and can be disabled without losing notes. Human playtesting decides its future.
- Static production build works under a repository subpath, has no CDN runtime dependency, and documents current browser/device verification. No public deployment or full framework completion is implied by a local build.

## Evidence log

Implementation evidence and remaining gates will be recorded in README and a validation report after integration. Existing scaffold CI is not product verification. This plan authorizes parallel work through the user's explicit request; agents do not edit unrelated files or historical archives.
