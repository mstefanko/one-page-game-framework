# M2 handoff: one short complete game

Prepared October 19, 2026. M2 is already defined in [the v1 specification](32-v1-spec.md), sections 6 and 8. This document makes that milestone executable; it does not add a new milestone or authorize M3. First read the [M1 review handoff](35-m1-review-handoff.md), [review resolutions](36-m1-review-resolution.md) and [repository decision](37-repository-direction.md).

## Goal and scope

Ship one short, complete playable game using the same production simulation: **one level, one enemy type, two moves**, title, loss/retry, a short full-screen Director scene and result/restart. Replace placeholder presentation through Assets, demonstrate two interchangeable skins and Score music at two energy levels. Build a bounded, self-contained static dependency set. Keep the M1 two-room regression fixture intact.

Do not add an ECS, behavior registry, networking, RPG inventory, projectile system just for a benchmark, broad scene editor, general Playtest Lab, PWA or single-HTML exporter. Keep content scope fixed; remove optional content before adding systems.

## Start from facts

1. Inspect Git status and the committed baseline. M1 was isolated from substantial unrelated local edits; preserve those edits. Do not assume the working tree and delivery branch contain identical creative APIs.
2. Verify M1's documented commands and current evidence before changing rules. Preserve old replay evidence separately when a deliberate rules/content change warrants a new baseline.
3. Review and commit the Assets prerequisite separately if it is still absent. The local implementation is in `packages/assets-core`, `packages/assets-io` and their associated app/service. Its delivery notes are `docs/30-pocket-assets-delivery.md` when available. Record the prerequisite commit and capability tests in M2's report. This is a prerequisite, not a request to recreate Assets.
4. Read the existing [Score backend](../packages/music-web-audio/src/index.ts) and [Director runtime](../packages/director-runtime/src/index.ts) at that exact revision. `AudioEngine.play/setEnergy/stop/dispose` and `createPlaybackController.step/advance/skip/dispose` are starting points, not permission to bypass their lifecycle contracts. Inspect both implementations for adapter gaps before wiring them.

## Work order and deliverables

Every row must produce a runnable playtest example, a production build experiment and recorded measurements. A unit test alone does not close a row. Use small examples under `examples/game-m2/` and focused fixtures under `tests/game/`; do not create a large new tooling application.

| Slice | Build and playable example | Verification and experiment |
| --- | --- | --- |
| 1. Flow | A minimal validated flow document, title/play/loss/cinematic/result nodes, declared edges and retry. An example runs the whole loop with placeholder presentation first. | Replay ordered host commands in Node with no renderer. Test invalid edges, duplicate outcomes, retry, restore-before-entry and terminal controls. Record bundle delta, startup and per-transition timing. Compare direct explicit dispatch with any proposed abstraction before adding it. |
| 2. Assets | Pin exported assets, resolve required actions/directions/frame timing centrally, draw two skins with different trim and socket offsets in both facings. Keep body/hurt/hit geometry in gameplay definitions. | Run identical input logs with both skins and compare full gameplay checkpoint bytes. Test missing capabilities, stale pins, malformed media, clipping and fallback diagnostics. Build each skin; record JS/media bytes, decode/upload time and disposal behavior. Compare rendering alternatives only if the measured scene needs them. |
| 3. Score | One audio coordinator owns music/SFX/dialogue, gesture unlock, mute and two energy levels. A playable encounter changes energy and returns it after combat. | Listen to the actual built game, not only event logs. Record audio onset/transition behavior, active voices, bundle delta and an offline render where supported. Test rejected unlock, pause/background/resume, restore/seek suppression and disposal; old SFX and audition must not overlap. Keep musical PPQ, game ticks and audio seconds distinct. |
| 4. Director | A short full-screen Canvas cinematic, driven by the host cinematic clock. Gameplay pauses and controls cancel on entry; complete or skip returns control exactly once. | Play normal completion, early/late skip, dialogue advance, repeated callbacks, late resources and dispose/restart. Record cinematic frame/submission timing, build delta and resource ownership. No second RAF; preview seek must not commit a game outcome. |
| 5. Bounded asset build | Resolve pinned original/licensed media into a static output with content lock, notices, diagnostics and artifact hashes. Runtime needs no personal library or service. | Build from a clean checkout and serve under a repository subpath with library/network services unavailable. Test limits before allocation/read, missing files, traversal and deterministic rebuilds. Record per-asset sizes, total JS gzip, total media and load costs. Verify no React/editor/service/schema compiler/dev bridge in player. |
| 6. Complete game | Combine the slices into the fixed short game. Include clear controls, pause, win/loss, retry and skip. | Run three-engine replay and browser regression suites, logical-resolution screenshots, complete/skip/retry flows and repeated mount/dispose. Two other people must complete the loop unaided; record observations and fix blocking control/comprehension issues. |

## State, clock and integration contract

The simulation remains pure, integer and 60 Hz. The browser owns one scheduler. Audio/rendering never write simulation state. Skin changes affect presentation only. Do not copy the editor runtime graph into the player.

Define bounded host commands carrying slot instance, flow epoch, monotonic host sequence, gameplay tick, cinematic tick and outcome token. Validate commands, process them in a stable order and make outcome consumption idempotent. Node replay processes the same flow transitions while gameplay time is frozen. Declare lose/retry/cancel behavior explicitly. A pause overlay is not another running scene.

Do not support exact checkpoints inside a cinematic in v1. Save before or after the slot. Restore cancels current presentation, resets view/audio state, and prevents old callbacks from committing outcomes. A cinematic cannot move a gameplay body unless a declared transition applies an authored spawn/progression change.

Resolve Assets through its existing families/variants/actions/directions, frame timing, trim/mirroring and anchor APIs. Keep its explicit conversion boundary to Director. Verify the actual committed API (local candidates include `capabilityReport`, `frameAtTick`, `resolveAnchors` and `exportDirectorPack`) before designing adapters. Runtime uses prepared pinned data, not authoring services.

Keep separate identities for reviewed rules source, canonical content and emitted build artifacts, as established by M1 review. For archival replay retain the emitted build manifest and actual build. Compatibility success is not proof of compiler equivalence; require full-byte cross-engine replay for each supported toolchain build.

## Measurement protocol

Capture a baseline before each integration and a comparable result after it. Store concise JSON plus a readable interpretation in `docs/evidence/game-m2/`. Include revision/dirty state, rules/content identities, emitted artifact manifest, Node/browser/OS/hardware versions, exact commands, seeds, warmup, sample counts and failure cases. Never overwrite expected replay bytes merely to make a test green.

For Node simulation timing, reuse M1's 2,000 warmup and 10,000 measured steps across five runs (report process isolation explicitly). Time stepping separately from serialization/loading. Keep scenarios actively playing and report actor/mechanic counts. The future 40-actor/20-projectile and 100/100 budgets apply only when those mechanics exist; do not call the current small fixture a stress pass. Compare on the same reference machine. CI timing is a trend, not an absolute M4 performance gate.

For browser experiments, report startup/resource decode, simulation time, render submission time, debt/dropped ticks and repeated transition/mount behavior separately. RAF duration is not GPU completion. Keep ≤250 KiB gzip for all required runtime JS as the build target; if integration exceeds it, identify contributors and test one concrete alternative before claiming success. Include audio and Director code actually required by the game. Media bytes are separately reported.

Run desktop plus small viewport examples throughout, not only at the end. Real phone/controller/GPU recovery, memory and human playtests require actual observations. If people or hardware are unavailable, mark those gates pending and do not claim feel validated or move automatically to M3.

## Completion report for the next reviewer

Provide the commit/base/prerequisite revisions, code map, runnable commands and URLs, exact behavior changes, test counts, refreshed replay coverage, artifact identities, build-size/performance comparisons, screenshots and listening/playtest notes. Link each slice to its example and experiment. Separate automated evidence from human/device observations. Document remaining limitations and any approved spec changes.

Suggested first instruction to the implementation agent: “Implement M2 from docs/38-m2-handoff.md and docs/32-v1-spec.md, starting with prerequisite verification and the smallest runnable flow example. Preserve M1's regression fixture and unrelated work. Build, playtest and measure every integration slice; do not widen content or move to M3.”
