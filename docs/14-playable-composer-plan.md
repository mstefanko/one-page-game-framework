# Playable composer and real-game integration

Implementation revision: October 17, 2026. This extends [Pocket Score](06-pocket-score-implementation.md) in the existing personal monorepo. The original composer work is retained, including Sketch, Studio, library drafts/versions, exports, and the standalone player. The Arcade and external-game sections below supersede the earlier demo-only direction.

## Revision after playable feedback

The first gesture implementation below is retained as the initial slice's rationale. The user's playtest found that repeated one-beat gestures produced disconnected two-note fragments. The current execution plans are [Arcade experiments](15-arcade-experiments.md) and [composing alongside the game](16-compose-with-game.md), informed by [ten musical-play concepts and primary-source research](17-musical-play-research.md). These supersede the initial per-action phrase and exclusive runtime-audio decisions below.

Three experiments separate musical agency: Phrase Rider directs a continuing motif; Groove Fighter directs rhythmic arrangement and temporary fills; Ribbon Lead controls a flowing pitched line. Rehearsal creates no take. Recording is explicitly armed, bounded to a visible loop, and kept as ordinary notes with the auditioned instruments. Backing choices make room for the performed role. Density and intensity stay on the song's clock; continuous pitch-bend and uncontrolled tempo gestures remain outside the note-only score contract.

For game scoring, keep a single preview instance mounted across editor/full-workspace layout changes. Two starting actions copy the original cue or create a fresh cue. Working-score mode gives the host editor ownership of music while the runtime continues simulation and SFX; the acknowledged source handoff prevents competing music streams. Draft edits are coalesced and adopted at the next unscheduled loop boundary without restarting the transport. Original/saved playback is a source choice, and pinning remains an explicit assignment action.

The supervising integration owns shared audio scheduling and cross-workstream validation. Independent GPT-6.1 sol implementation agents own Arcade and the game workflow; a third researches and reviews musical behavior. Verify bounded capture, take parity, source handoff, live-edit timing, iframe continuity, scene changes, interrupted playback and static-release exclusions before publishing the revised branch.

## Product decisions

Compose one song at a time. Sketch and Studio remain direct editors of the canonical score. Arcade is another way to perform new material into that score. Game audio is the place to hear a song in its intended gameplay context. Keep these purposes distinct: changing a weapon in Arcade should not change a weapon or combat balance in the embedded game.

The embedded reference is the actual locally built Terminator game. Adapt its existing scenes, music requests, SFX and playable character instead of rebuilding a visually similar example. Preserve the original game source. Generate a development preview with explicit hooks, and keep the imported game/assets out of framework commits. The original Lantern Courier fixture remains available for reproducible public tests without external content.

Arcade uses a visible character with movement and four musical gestures. A strike states a motif, a leap moves upward, a dash creates a run, and a guard settles the phrase. Weapons choose timbre. This gives beginners a stable relationship between physical action and musical result. The default is a melodic performance over the existing song. An explicitly selected bass or drum part changes the musical role; the initial experiment does not make every move secretly edit a different layer.

Faster action increases aggression through note density and velocity. It does not independently accelerate the performed part against an unchanged backing song. Actual BPM remains a song setting. Future tempo gestures must control the whole transport at a declared musical boundary and retain timing metadata; they are not needed to validate whether action-based composition is useful.

## Music contract

- The canonical score remains schema version 1, 480 PPQ. Kept performances are ordinary notes, patterns, clips, tracks and patches; export does not need an Arcade runtime.
- A pure music-core function maps action, aggression, selected role, transport position and current score into a bounded phrase. Its output is deterministic, which makes replay and musical regression tests possible.
- Prefer active, audible harmony/bass note evidence when present. Otherwise use declared scale guidance. Never claim a detected chord progression from a key label alone. State that these are heuristic musical choices, not a guarantee of consonance.
- Quantize phrase launch to the next sixteenth-note boundary. Use the Web Audio clock for scheduling, including transport preroll. Visual motion can respond immediately; audible notes follow their stored musical timing.
- Keep a bounded phrase inside the capture region. Do not silently record notes outside the destination pattern, regenerate a take on Keep, or discard a weapon's timbre during commit.
- Avoid dense overlapping runs from key repeat. Held movement and discrete gestures need explicit cadence, release, blur and interruption behavior.

The [music research document](11-arcade-music-theory.md) records the primary sources and exact rules. The [Arcade implementation](13-arcade-implementation.md) and [Terminator adapter](12-terminator-integration.md) document the shipped controls and integration limits. Musical quality still requires listening and novice playtesting.

## Layer and ownership plan

| Layer | Implementation responsibility | Acceptance |
| --- | --- | --- |
| `music-core` | Pure phrase rules, harmonic context, rhythmic density, bounded timing | Deterministic notes, safe ranges, scale fallback, transposed/repeated context tests |
| `music-web-audio` | Delayed preview voices and tick-to-audio-clock alignment | Future notes start at scheduled time; stop cancels scheduled voices |
| `music-editor/Arcade` | Character, weapon selection, gestures, input focus, visible musical mapping | Keyboard and pointer perform; typed text is not intercepted; stopped input cannot create notes |
| `music-editor/Composer` | Pending take ownership and undoable keep/new/replace | View changes preserve work; retained patches and notes survive save/export |
| Game adapter/import script | Instrument actual Terminator source without changing original | Known source hooks validated; source identity recorded; missing hooks fail clearly |
| Game audio host | Catalog, contexts, runtime handshake, draft audition and explicit pinning | Correct game context loads, no doubled music, cleanup on close/reconnect |
| Repo/CI | Existing npm workspaces, documentation, checks and PR | Fresh public checkout works without personal source/assets; local integration tests run when imported |

## Execution order

1. Inspect the current composer and original game. Establish which native music, SFX and contexts have usable hooks. Confirm repo remote and existing plans before changing layout.
2. Research phrase construction and implement the pure generator with focused tests. In parallel, design the character controls and build the game import/adapter path with independent file ownership.
3. Connect the generator to the shared audio engine. Capture exactly the notes and timbres auditioned. Add explicit keep/discard paths and preserve takes across mode changes.
4. Connect the actual game iframe to the validated bridge and catalog. Keep draft audition distinct from pinned project assignments and the original game file.
5. Integrate and review input lifecycle, timing, harmonic fallback, persistence, audio ownership, source provenance and browser behavior. Fix failures before publishing the branch.
6. Run repository checks, unit tests, production build, and Chromium journeys. Exercise the local imported game as an additional gate, while public CI uses redistributable fixtures.
7. Publish the source and plans to the existing personal repository through a feature branch and pull request. Do not claim a deployed composer site or silently merge prior open work.

## Follow-up experiments and release gates

The first experiment compares direct pad entry with character gestures on the same song. Ask a novice to create a short phrase, vary its energy, change its instrument, keep it, and find its notes in Sketch. Observe whether they can predict a move's sound, whether rests feel intentional, and whether repeated movement creates usable variation rather than clutter. Include an experienced musician to assess harmonic clashes and rhythmic feel. Record the task, song, control mapping and failures; do not substitute a preference score for evidence of usable composition.

Only add layered choreography after users understand one role. A later ensemble mode may explicitly arm melody, bass, harmony or percussion and display each recorded lane. A later tempo mode must coordinate the backing transport. Combat enemies, moving targets, combos and rewards are experiments, not requirements for musical validity.

Remaining release work includes physical-device audio latency and interruptions, headphone/speaker listening, loop-seam quality, durable recovery of unfinished takes, accessibility review, and arbitrary third-party game integration. A known local-game adapter is not an automatic game importer. Static hosting and IndexedDB remain the deployment/storage model; portable backups remain necessary for browser-local work.
