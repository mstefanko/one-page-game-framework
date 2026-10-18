# Cutscene director: research and decisions

Researched October 18, 2026 through three parallel investigations: existing music workflow, Terminator cinematic implementation, and external tools. This records inspected source and current official documentation, not a performance benchmark or a working director. See [implementation plan](20-cutscene-director-implementation-plan.md) and [five-concept design prompt](21-cutscene-director-claude-design-prompt.md).

## 1. Findings that drive the design

1. **Reuse Pocket Score's workflow, not an assumed generic editor infrastructure.** The real workflow separates a game context, the selected cue, a working draft and an explicit saved assignment. The library and project schemas are currently music-specific.
2. **Use scene → shot → actor/action as the new hierarchy.** Music sections audition ranges of a score; they do not currently seek the game to a synchronized phrase. Shot seeking is new runtime work.
3. **Export game-native scene data with all dependencies.** Video files are optional review artifacts. Agents need IDs, files, slot/outcome bindings, versions and validation, not instructions to interpret a movie.
4. **Terminator has storyboards but no general staging format.** Five cutscenes use named procedural renderers; gameplay sprites, cinematic portraits and cinematic bodies are not one interchangeable asset model.
5. **Modularity has limits worth showing in the UI.** Whole-body motions transfer broadly; semantic frame animations require matching capabilities; mouth animation requires mouth art; skeletal animation requires a compatible rig.
6. **Build the domain model; reuse small specialist tools.** No reviewed package supplies game context, editable scene tracks, compatible modular assets, portable speech and project installation together.

## 2. Existing music workflow: what is actually implemented

Source links below are repository-relative; line references record the inspected working tree, which also had pre-existing uncommitted Arcade changes. No runtime files were changed for this investigation.

| Finding | Evidence | Director implication |
| --- | --- | --- |
| Selected cue, current context and sounding cue are separate | [GameAudio.tsx](../packages/music-editor/src/GameAudio.tsx), lines 110, 469–587 | Scene selection, current game location and assigned scene must remain distinct |
| Edit original / Edit assigned / Start fresh create an editable copy | [GameAudio.tsx](../packages/music-editor/src/GameAudio.tsx), lines 169, 400; [Composer.tsx](../packages/music-editor/src/Composer.tsx), lines 302–337 | Preserve draft/navigation guards and explicit copy semantics |
| Game instance stays mounted through full/docked/collapsed layouts | [Composer.tsx](../packages/music-editor/src/Composer.tsx), lines 1043–1084 | Maintain preview identity while editing a scene or drilling into music |
| Original / saved assignments / working score are explicit sources; pinning is separate | [GameAudio.tsx](../packages/music-editor/src/GameAudio.tsx), lines 440–460 | Autosave/preview must not silently install a cutscene |
| Source-hash mismatch exposes recoverable assignments | [GameAudio.tsx](../packages/music-editor/src/GameAudio.tsx), lines 197, 374 | Detect game-source or project revision changes before applying old scene bindings |
| Imported phrases become `Score.sections`; section strip auditions that range | [terminator-project.ts](../packages/music-editor/src/terminator-project.ts), line 124; [Composer.tsx](../packages/music-editor/src/Composer.tsx), lines 1183, 1219 | Useful drill-in pattern; there is no existing phrase-to-game-time synchronization |
| Music and game transports are independent | [Compose with game](16-compose-with-game.md) | Preserve explicit ownership but use coordinated audiovisual scene time for cutscenes |

The preview bridge already validates origin/source/session and requests, exposes capabilities, and disposes pending work. However [preview-bridge.ts](../packages/music-editor/src/preview-bridge.ts) currently admits only music/SFX assets and Score drafts; its message bound is 2 MiB. The [project assignment store](../packages/asset-library/src/projects.ts), line 36, limits serialized manifests to four million characters. Repeatedly embedding visual binaries in scrub/update messages would be a poor fit.

The current [library API](../packages/asset-library/src/index.ts), lines 4–47, stores Score drafts and versions. [Project schemas](../packages/project/src/index.ts), lines 77–123, define score sections and musical documents, not generic cinematics/sprites/flow. `AssetProvider`, dependency-closure storage and local project installation in [the strategy](03-repository-and-asset-strategy.md) are planned work.

Tests inspected: [compose-with-game.spec.ts](../tests/browser/compose-with-game.spec.ts), [terminator.spec.ts](../tests/browser/terminator.spec.ts), and bridge tests. They cover useful music/preview behavior; they do not demonstrate cutscene editing, visual seek or scene installation. No runtime test suite was executed as part of this research-only change.

## 3. Terminator: current source and migration constraints

The authoritative local source is `/Users/mstefanko/terminator-game-repo/index.html`, clean Git commit `00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0`. SHA-256 `139acca505c4f3d065366790bfb4ee6ee6cf70a58a478c301fc0cd4fb527ad00` matches the generated local music preview catalog. Older files in `terminator-review` contain an earlier one-shot farewell; they were not used as the final source of truth.

| Area | Current behavior | Consequence |
| --- | --- | --- |
| Storyboards | `drainIn` 4 shots; `drainOut` 4; `galleriaIn` 2; `millIn` 4; `farewell` 5. Panels contain ticks, named shot, caption, optional SFX/impact; scene owns a cue. Galleria caption can be a role-dependent function. | Import catalog/timing/text explicitly; convert dynamic text into typed variants, not code in JSON |
| Lifecycle | `startCut(name, then)` creates panel/time/text/skip state; end marks watched, clears input and calls a continuation | Replace procedural callbacks with declared outcomes and exactly-once handling |
| Advance | 60 Hz; one non-break character every 2 ticks; advance first reveals text then moves on; holding Enter/Escape 20 ticks skips; watched scenes skip on press; panels also time out | Preserve user-controlled reading and skip policies, expose them as data |
| Rendering | 512×352 cinematic canvas, 512×254 staging area; game logical space 256×176; bitmap captions, fades, flashes/shake, labels/progress | Viewport and caption safe area belong in authored data; avoid mixing cinematic and gameplay coordinates |
| Staging | `ciShot` branches compute jumps, truck motion, fire/smoke, lowering, portraits and final road from local time | Some math is suitable for reusable tracks, but it is not already a data-driven animation asset |
| Art | Gameplay 16×24 palette-row sprites; cinema uses separate PNG portraits, bodies, vehicles and environments | Stable actor bindings need explicit gameplay/portrait/close-up appearances; swapping one image cannot replace all depictions |
| Speech/audio | Synthesized typewriter blips, music and tick-equality SFX; no voice recording, mouth rig or bubble layout system | Speech text, audio and mouth animation need separate new contracts |
| Placement | Intros continue to gameplay briefing; farewell continues to progression/unlock completion; aftermath continues into shop/next state | Pack installation needs flow/outcome bindings, not only a scene file |

Primary source: [storyboards](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html#L6353), [lifecycle/input](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html#L6914), [staging](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html#L7213), [rendering](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html#L7264), [music routing](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html#L7871), [game placement](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html#L5832).

A second cinematic category exists: [`stepDrainCut`](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html#L11107) controls live truck motion, explosions and outcomes during the encounter. Treating it as ordinary decorative animation would lose gameplay semantics. Presentation proxies should precede live-entity cinematics.

The music preview [context loader](../packages/music-editor/src/terminator-runtime.ts), lines 233–282, starts a fresh seeded T-800 run and exposes start checkpoints only. Cutscene completion returns to title in that preview, not the real campaign continuation. Therefore its existence does not prove arbitrary seek or correct production placement. The [import script](../scripts/import-terminator.mjs) extracts trusted local music builders and injects a preview adapter; it does not extract cinematic tracks. Keep generated game content ignored and out of public starter bundles.

## 4. External tools: verified fit and recommended use

Official sources were checked October 18, 2026. Recommendations below are engineering judgments; licenses remain tied to the exact version ultimately selected. No dependencies were installed or benchmarked.

| Candidate | Verified capability / constraint | Decision |
| --- | --- | --- |
| [React Timeline Editor](https://github.com/xzdarcy/react-timeline-editor) | MIT; row/action time model; React ≥18 in its [manifest](https://raw.githubusercontent.com/xzdarcy/react-timeline-editor/master/packages/timeline/package.json); includes interaction/virtualization/engine dependencies | Editor-only spike against controlled state, undo, keyboard editing, grouped lanes, trim/snap and current React. Keep our JSON/evaluator; reject if adaptation dominates |
| [PixiJS](https://github.com/pixijs/pixijs) / [AnimatedSprite](https://pixijs.download/v8.21.0/docs/scene.AnimatedSprite.html) | MIT; rendering/asset/text facilities; manual animation timing is possible | Consider only as shared renderer if measured needs justify it. Do not add a separate cinematic engine |
| [Phaser](https://phaser.io/download/license) / [animation docs](https://docs.phaser.io/phaser/concepts/animations) | MIT game framework with frame/Aseprite animation support | Relevant to a whole-game renderer decision, too broad solely for a cutscene editor |
| [Theatre.js](https://github.com/theatre-js/theatre#license) | Core Apache-2.0, Studio AGPL-3.0; README describes development temporarily moved to a private repository | Keyframe UX reference; no default embedding in this product |
| [GSAP license](https://gsap.com/community/standard-license/) | No-charge terms contain restrictions relevant to competing visual animation builders, with scope-dependent exceptions | Avoid this dependency question for a small evaluator; no claim that this particular proposed tool is legally prohibited |
| [Aseprite CLI](https://www.aseprite.org/docs/cli/) / [FAQ](https://www.aseprite.org/faq/) | PNG/JSON export with tags/layers/slices; art output and redistribution of the Aseprite application are separate matters | First-class PNG+JSON import; optional user-installed CLI; do not bundle the application |
| [Wavesurfer.js](https://github.com/katspaugh/wavesurfer.js) | BSD-3-Clause; waveform and regions/timeline/envelope/record plugins | Optional voice editor UI. Shared scene transport remains authoritative; simple peak thumbnails may be enough initially |
| [Rhubarb Lip Sync](https://github.com/DanielSWolf/rhubarb-lip-sync) / [license](https://github.com/DanielSWolf/rhubarb-lip-sync/blob/master/LICENSE.md) | MIT local CLI; recorded speech to editable JSON/TSV/XML mouth cues; six basic and three optional shapes | Later preprocessing after compatible mouth art exists; output ordinary data, do not ship processor in game |
| [Ink](https://github.com/inkle/ink) / [inkjs](https://github.com/y-lohse/inkjs) | MIT branching narrative system/runtime | Defer until narrative branching warrants an additional language/runtime |
| [Motion Canvas](https://github.com/motion-canvas/motion-canvas) / [video export](https://motioncanvas.io/docs/rendering/video/) | MIT TypeScript generator animation and live editor, optional FFmpeg video exporter | Sequencing/feedback reference; avoid second source model for editable game tracks |
| [Remotion license FAQ](https://convert.remotion.dev/docs/license/faq) / [Editor Starter](https://www.remotion.dev/docs/editor-starter) | React video tooling; organizational licensing conditions; starter has additional terms | Optional separate video product path, not needed for playable scenes; do not describe as unrestricted MIT |
| [WebCodecs](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API) / [Mediabunny](https://github.com/Vanilagy/mediabunny) | Codecs need container handling; Mediabunny provides media tooling under MPL-2.0 | Later lazy-loaded review-video export after browser codec checks |
| [ffmpeg.wasm FAQ](https://ffmpegwasm.netlify.app/docs/faq/) | Wrapper/core licenses differ; browser execution has performance/resource costs | Avoid as MVP prerequisite; optional local/native rendering later |

The recommended production dependency set is intentionally small: existing TypeBox/React/music modules, our scene evaluator and shared renderer, a documented Aseprite importer, and only an editor timeline library if the spike passes. Audio waveform, automatic mouth analysis and video output can arrive independently.

### Assets and speech

[Kenney](https://kenney.nl/support) states its asset-page game assets use CC0. Preserve pack-level provenance when selecting starter material. [OpenGameArt's FAQ](https://opengameart.org/content/faq) describes asset-specific licensing/credit; a site result is not proof of compatibility or a blanket license. Start with curated discovery links and user import. A later [Openverse API](https://api.openverse.org/v1/) connector can search images/audio, with its [source-verification caveat](https://docs.openverse.org/api/reference/made_with_ov.html); these are not automatically rigged character assets.

Recorded speech should be persisted as bytes alongside transcript and editable animation cues. Browser speech synthesis is unsuitable as the canonical offline soundtrack because a voice can be a [local or remote service](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisVoice/localService). Generation can be a later authoring adapter; it should produce the same portable recorded-audio asset.

## 5. What remains unproven

A bounded prototype must establish timeline-library accessibility and React compatibility, evaluator/render parity, actual dependency sizes, lip-sync accuracy for chosen languages/art, browser audio/codec behavior, and phone performance. Source inspection is not visual/audio QA. Existing framework runtime/CLI/export plans remain dependencies, not available services.

The implementation plan therefore starts with a handwritten original fixture and a portable evaluator/player, then imports/library, then editor, then explicit game installation. It retains the framework's Canvas-versus-LittleJS decision gate and adds no promise of automatic arbitrary-game or arbitrary-animation conversion.
