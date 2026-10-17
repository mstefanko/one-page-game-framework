# Pocket Score: implementation evidence and remaining gates

Implementation on October 17, 2026, branch `codex/pocket-score-implementation`. The initial composer and its first Arcade/Terminator integration were revised after playtest feedback. Three parallel GPT-6.1 sol workers researched ten musical-play concepts and implemented three Arcade experiments plus the persistent compose-with-game workflow. The supervising agent integrated and reviewed the work, added audio-clock scheduling and release-content boundaries, and exercised browser flows. This is an implemented composer slice, not completion of the whole game framework or a public website deployment.

## What works

- Six original editable starters with distinct metadata and notes; blank cue; one-shot and looping scores; a canonical 480-PPQ document shared by all views.
- Sketch notes/live pad and Studio arrangement; editable timing, velocity, sound and mix; note-list alternative, drum steps, linked/unique patterns, validated undo/redo. Arcade now offers Phrase Rider, Groove Fighter, and Ribbon Lead: continuing musical intent, persistent kit grooves/fills, and a responsive gated scale melody. Jam is separate from bounded next-loop capture; backing choices, rest, replay, weapon lanes and ordinary editable takes remain on the song clock.
- IndexedDB drafts, explicit immutable versions, compare-and-swap writes, conflict recovery as a copy, library backup/restore and portable source packs. Browser storage is origin-specific, not an external backup.
- Bounded MIDI review/conversion and export; unsupported expression and timing are declined explicitly rather than silently destroyed. Source packs preserve the full editable score. MIDI preserves notes, timing and selected conductor information, not chip timbre or game context.
- Native Web Audio scheduling, distinct deterministic drum voices, intensity changes without transport reset, shared offline rendering, PCM16 WAV and a self-contained player HTML with no network dependency.
- A local **Lantern Courier** project fixture: catalog of two music assets and three SFX; derived usage lists; menu, level, encounter and victory contexts; playable interactions and repeatable replay; draft audition and explicit pinned assignment updates. Project assignments persist separately and have their own JSON backup.
- The actual **Terminator: Liquid Metal** game can be imported from trusted local source: 28 contexts, 23 music scores and 33 SFX; native gameplay/cinematics, deterministic context starts, original/assigned/fresh composing paths, persistent preview layout, acknowledged host/runtime music ownership and source-revision-bound pinned assignments. Working music and live edits run beside game simulation/SFX; edits join the next loop or can be auditioned immediately with Hear edits now. Native source is untouched. Generated game/art/music remain Git-ignored and excluded from the public production build.
- Static Vite distribution with relative URLs. The editor is reusable by the future studio host; no server or account is needed for the current composer.

## Automated evidence

Final consolidated local result: **103 unit tests and 24 Chromium browser tests pass**, along with strict TypeScript and the production build. The real-game check exercised all 28 imported contexts, native mute/unmute, SFX audition, draft playback, reset, editing with the dock retained, assignment persistence and imported-source immutability, with no page errors. Without the optional local game import, public CI runs 23 browser tests and skips that one source-dependent integration test.

The original baseline passed 57 unit tests and 13 browser tests. The first integrated slice passed 81 unit tests and 21 browser tests. This revision adds full-phrase identity and backing-aware harmony, all three Arcade capture modes, immediate Ribbon gating, capture/rest parity, nonzero/transposed take parity, persistent game identity, original/fresh draft flows, independent SFX/music, rapid source-request correlation, same-scene saved-cue restoration, and queued score/tempo/range updates including very short loops. The final main static bundle is approximately 600 kB minified / 178 kB gzip. Vite continues to report its 500 kB chunk advisory; import/export code splitting remains a load-time optimization rather than a hidden warning.

`npm run check` runs the unchanged-archive/link/workspace check, strict TypeScript, unit tests and the static build. `npm run test:browser` requires the build plus installed Chromium and runs actual browser journeys. Tests live with packages and in `tests/browser`; CI runs both commands.

Unit coverage includes schema/reference validation, exact fractional phrases and event windows, immutable version/concurrent draft semantics, bounded/corrupt archives, MIDI loss/rejection paths, audio scheduling and shutdown, pinned assignments, capture and the external bridge protocol.

Browser journeys verify:

- Starter identity and tempo; add/undo; rename/autosave/version/reload.
- A second tab cannot silently overwrite a saved draft; local edits can become a separate recovered copy.
- Arcade capture becomes editable notes; selecting an SFX usage loads its game context.
- Source pack roundtrip and MIDI note parity using real browser modules.
- Actual OfflineAudioContext output is finite and nonzero; WAV header/frame count agrees with rendered audio.
- HTML export is downloaded, reopened through `file://`, unlocked with a user gesture, played and stopped; no HTTP(S) request is made.
- Audio-clock position survives energy changes and advances through a deliberate main-thread stall.
- Phone viewport checks and a production build served from a Pages-style repository subpath.
- Arcade Jam without capture or phrase stacking, bounded next-loop recording, automatic review, replay, changing weapons, ordinary per-instrument parts, one-step undo/redo, explicit drum role, immediate Ribbon gate release, pointer cancellation, recorded rests, and nonzero-loop/transposed replacement.
- Actual imported Terminator contexts, native/canonical/host music ownership, mute/unmute, SFX, deterministic resets, retained iframe/game state while editing, live-score updates, fresh/original draft preservation, explicit pins, same-scene saved-source restoration, and excluded local content in release output.

Observed Chromium audio probe: a 3120-tick phrase at 120 BPM rendered twice at 48 kHz yields **312000 frames**. Peak 0.11121 and RMS 0.01593 for the measured fixture; zero nonfinite samples. Energy switching preserved position at the call boundary. A 180 ms busy-loop plus scheduling wait advanced the audio clock by 0.24533 seconds and 235.52 ticks, consistent with that tempo. These are local measurements, not device-independent latency guarantees.

The measured maximum channel discontinuity at a continuous iteration join was 0.01172, while joining the single exported file's end to its start produced 0.04568 for that fixture. The difference is a reason to keep seam audition/preroll work open; neither number certifies audible seamlessness.

## Remaining gates and intentional limits

1. **Real games:** the local Terminator adapter is implemented for the known source structure. This is not an arbitrary game importer or complete framework scene/replay runtime. Its canonical score conversion approximates orchestral timbres/stereo/heat, and override looping starts at the repeat region rather than playing a native one-time introduction. Original native audio remains available. See the [Terminator integration](12-terminator-integration.md) and [adapter contract](09-external-game-preview-bridge.md).
2. **Sound quality:** Chromium programmatic output has been checked, but listening on speakers/headphones, real Safari/iOS/Android interruptions, practical latency and high-polyphony CPU/memory remain unverified. The native backend choice is provisional; see [C1 evidence](07-backend-proof.md).
3. **Loop exports:** zero tail crops at the requested boundary. Realtime voices may release into the next iteration; no steady-state preroll or compressed-loop encoder exists. Do not label arbitrary WAV output “seamless.”
4. **Editing depth:** numeric note controls and simple clip/section controls are a first slice, not a complete DAW. Advanced gestures, automation, rich reusable patch browsing and production MIDI conversion are later work. Scale guidance affects future playing; it does not retune existing notes.
5. **Storage:** no cloud, folder-picker integration or automatic external backup. A library backup and game-assignment backup are currently separate. Cross-browser migration is by files. Saved history is explicit versions, not every undo step. In-progress performance recovery needs further reload/abrupt-close testing.
6. **Arcade:** three distinct playable experiments, weapon changes, bounded multi-instrument capture and song-aware phrase heuristics are implemented. Ribbon records stepped notes, not continuous pitch bend; human listening and novice playtesting determine which modes to keep. Harmonic anchors are derived from sounding accompaniment; scale metadata alone does not prove a chord. Layers-as-moves, true tempo gestures, enemies/combos and novice/musician usability trials remain experiments. Unkept takes survive view changes and canceling Keep but remain memory-only until kept; abrupt-close recovery is not yet durable.
7. **Deployment/accessibility:** local Chromium and responsive inspection do not replace a full keyboard/screen-reader audit or real GitHub Pages deployment. Cloud sharing, video/stems, OGG, service-worker offline install and hardware-exact NES/SNES emulation remain deferred.

## Next implementation sequence

- Finish the listening/loop/latency gate with comparable BeepBox fixtures and device checks before locking backend presets.
- Extend the tested Terminator adapter only when another real game requires new capabilities; improve exact native-to-canonical audio fidelity, arbitrary source import and project-native export separately.
- Add safe source/patch dependency snapshots, a dedicated SFX editor/adapter, reference image/video fallback and project-level combined backups.
- Add durable unfinished-take recovery and compare Phrase Rider, Groove Fighter, Ribbon Lead, and the direct pad with novice and experienced musicians. The research memo retains ensemble/weapon packs, call-and-response, motif growth and shared-clock tempo conducting as later experiments.
- Broaden arrangement/keyboard/touch editing and accessibility based on those trials, then publish the static composer after release validation.
