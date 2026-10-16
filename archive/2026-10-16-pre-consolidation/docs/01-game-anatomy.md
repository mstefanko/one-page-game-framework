# Anatomy of Terminator: Liquid Metal

This document describes the implementation inspected on October 16, 2026, at commit `00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0`. It explains the final artifact, not an inferred history of how every asset was originally authored.

[Play the game](https://mstefanko.github.io/terminator-game/) · [Browse the pinned source](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html) · [Current repository](https://github.com/mstefanko/terminator-game).

The game is one 930,196-byte HTML file containing 11,805 lines, inline CSS, one inline JavaScript program, generated graphics, seven embedded PNG portraits, and a synthesized soundtrack. It has no runtime framework, package installation, remote asset requests, or server dependency. “One page” describes the delivered artifact; it does not make the underlying design simple.

## 1. Runtime shell, clocks, and state

The browser hosts two Canvas 2D surfaces: a **256 × 176 gameplay canvas** and a **512 × 352 cinematic canvas**. Both display at the same aspect ratio. CSS preserves hard pixel edges. Desktop sizing favors integer enlargement; touch layouts fit the remaining space around external controls. Changing the display size does not change world coordinates or hit ranges. See [HTML shell](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html#L1) and [canvas fitting](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html#L5586).

`requestAnimationFrame` draws frames. An accumulator advances simulation in **1/60-second steps**, with a maximum of five steps per display frame and a clamp on elapsed time. Most gameplay durations are integer ticks, and movement/ranges are logical pixels. This makes balance independent of monitor refresh rate, while very long stalls deliberately discard excess catch-up time. The frame loop is scheduled before processing so a render failure cannot silently prevent the next request. See [configuration](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html#L49), [stepOnce](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html#L6330), and [frame loop](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html#L11775).

There are several clocks, not just one:

| Clock | Owns | Important behavior |
| --- | --- | --- |
| Fixed simulation steps | Movement, AI, combat, screen timers | Pausing prevents simulation advancement |
| Presentation tick/effect timers | Pickup flashes, sparks, HUD notches | Pickup hit-stop can freeze gameplay while these continue |
| Web Audio time | Notes, envelopes, reverb, SFX | Independent of display refresh; audio scheduling continues separately |
| Cinematic panel time | Shot animation, captions, timed sound events | Integer ticks, with explicit next/skip handling |

`G` is a large mutable run/screen state object. Separate actor and projectile arrays hold world state. `BS` holds boss state; `DR` specializes the drain encounter. Screen dispatch and role dispatch are different: `stepState()` selects a screen, while `MODES[role]` supplies crowd-mode setup, update, HUD, and end conditions. Boss modes bypass the crowd update. See [G](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html#L1224) and [screen dispatch](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html#L6300).

Random choices use a seeded Mulberry32 generator. A fresh run chooses a seed once, unless a query parameter supplies one. A seed alone is insufficient to reproduce a session: the input sequence and simulation stepping must also match. Some source comments predate later changes; follow executable routing rather than treating comments as a complete specification.

**Reusable lesson:** expose explicit clocks, simulation stepping, scene lifecycle, seeded randomness, and state snapshots. Avoid exporting the giant global `G` object as the framework API.

## 2. Pixel art, sprite construction, and animation

Most people are generated from a **16 × 24 character matrix**. Characters in that matrix mean material roles rather than final colors: outline, hair, skin, shirt, sleeves, trousers, shoes, and so on. A character definition maps those roles to palette entries. `.` is transparent. An overlay row uses `_` to retain a template pixel.

The pipeline is:

```text
body template → walk/back-facing substitutions → named overlays
              → material-to-palette mapping → cached small canvas
              → position, flip, pose, and effect rendering
```

`rowsFor()` applies the body, walking rows, back-facing rows, then overlays. `paint()` resolves palette colors and can draw a chrome shimmer. `sprite()` caches the result. The four-step `CYCLE` reuses idle, stepping, and mirrored stepping images. This is economical frame animation, not a skeleton or general animation-retargeting system. Sarah demonstrates a custom body template; crowd shoppers are generated by varying hair, clothing, skin palettes, and overlays. See [templates and cast](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html#L346), [baking](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html#L483), and [gear rendering](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html#L551).

Upgrades add small pixel marks and palette changes. A hoodie has front/back cloth patterns; equipment and power tiers alter outlines or selected pixels. A separate hold-up builder clears arm pixels and redraws raised arms. Many combat poses, vehicles, hands, weapons, and special effects are drawn procedurally around the base body.

This explains both the efficiency and the limits of swapping sprites today. Recoloring a compatible body is easy. Replacing it with a taller character, different limb placement, or nonhuman silhouette is not: overlays and pose builders contain exact pixel coordinates. The plain `sprite()` cache key also excludes `d.base`, although other caches include more identity information. A future asset system should key caches by stable asset identity and revision, not assume identical palettes imply identical bodies.

The seven cinematic PNGs are each **224 × 256** and total **207,365 decoded PNG bytes** before base64 expansion. They represent T-800, T-1000, John, and expression/material variants. Their source images and original creation recipe are not stored as editable assets in this repository. The HTML proves their dimensions and embedding, not which external illustration workflow made them. A procedural portrait fallback remains available. See [portrait payload and loader](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html#L6993).

**Reusable lesson:** keep body art, equipment attachments, semantic clips, portraits, and collision geometry as separate assets with explicit compatibility requirements. Do not require every character to share the same silhouette merely to reuse animation.

## 3. World, levels, and rendering order

The mall is built from procedural rectangles and palette choices, not a general-purpose tilemap editor. `SOLIDS` describes planters and a bench; `DOORS` defines exit thresholds. Actors use feet positions for floor collision. Helpers push feet out of solids, clamp movement, choose valid spawn points, and separate crowds. `THEMES` changes colors and environmental presentation; `chapterCast()` changes shoppers and watchers for Pescadero. Static backgrounds are baked and cached. See [world geometry](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html#L1013) and [themes/stages](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html#L1051).

The eight-stage campaign contains three Galleria rounds, a drain boss, three Pescadero rounds, and a steel-mill boss. Later loops change difficulty and threats. Stage, round, theme, and loop are related but different concepts.

`drawWorld()` draws background and underlays, pickups and floor effects, actors sorted by feet Y, foreground effects and projectiles, aim indicators, feedback, and HUD. Intro and pause cards add screen-level presentation. This explicit ordering creates depth without a 3D renderer. It also explains why UI placement matters: an overlay drawn above the world can hide an otherwise valid pickup. See [world render order](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html#L5210).

The bosses are genuine encounter modules, not palette swaps:

- **Storm drain:** scrolling distance, obstacle waves, vehicles, jump/slide opportunities, truck attack phases, grenade flight, counter windows, and role-specific goals. A T-800 grenade checks vulnerability on impact; enough truck damage wins. The T-1000 loses when its truck is destroyed. See [drain setup](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html#L10104), [counter resolution](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html#L10542), and [end conditions](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html#L11098).
- **Steel mill:** arena geometry, molten pits, belts, hooks, freezing, falling hazards, role-specific attacks and objectives, and staged finishers. See [mill setup](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html#L8191) and [role extensions](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html#L9419).

**Reusable lesson:** separate editable level content from encounter code. An editor can author geometry, spawn points, paths, hazard placement, and parameters; it cannot automatically replace the rules that make a chase different from an arena.

## 4. Input, characters, AI, and moves

Browser input becomes a small `INPUT` structure: pointer position, held primary button, click/key queues, special/secondary queues, and held keys. Screen and gameplay functions consume it on fixed ticks. Touch adapts pointer gestures and external buttons into the same structure, preserving the established desktop rules. It tracks steering and firing fingers separately, remembers aim after a finger lifts, guarantees a quick fire tap has a held tick before release, and cancels holds across transitions. See [input](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html#L791) and [touch adapter](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html#L832).

Actors are ordinary mutable objects with position, facing, movement, AI state, timers, health, disguise, weapon, and special fields. AI uses explicit state transitions, distance/cone tests, timers, weighted goals, and line checks. It is not a generic behavior-tree editor. Human and AI behaviors share many primitives but also have dedicated policies.

| Role in crowd encounters | Core loop | Distinctive mechanics |
| --- | --- | --- |
| John | Hide in crowds, collect quarters, reach the exit | Exposure meter, box protection, upgrade items |
| T-800 | Protect John and survive without killing civilians | Hold/release aiming, shotgun/M79/minigun, shove, call, Harley |
| T-1000 | Identify and reach disguised John while avoiding the protector | Moving mimic, suspicion, blade/slide options, three forms with one-hit form loss |
| Sarah | Variant of the John role | Different body and upgrades, jacket decoys, later encounter variations |

See [John mode](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html#L3285), [T-1000 and T-800 modes](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html#L3856), and [AI](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html#L1566).

Three moves show the contracts a reusable system needs:

1. **T-800 fire:** press starts a hold; continued hold can plant the actor and show aiming; release fires the equipped weapon. Cancel is different from release. A right-click during an aim hold cancels that aim rather than spending a Harley charge. The minigun has a separate continuous-fire behavior. See [aim handling](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html#L3550).
2. **Shove:** validates targets and line of sight, starts a windup, queries a broad arc, gathers targets before moving any of them, applies collision-safe displacement and stun, then enters cooldown/recovery. Player range is 28 logical pixels, with a close-range allowance; the player's shove has separate tuning from the AI's defensive shove. Hit feedback makes a landed move visible. See [shove](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html#L3658).
3. **Box:** activation consumes a charge and starts protection. All enemy-hit paths should consult the same protection predicate. Expiry or a valid T-1000 contact ends it, announces the change, and grants escape grace. Environmental damage is a distinct category. See [specials and protection](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html#L2894).

The important distinction is **move logic versus move presentation**. A drawn fist should not determine whether a shove hit, and a prettier sprite should not change invulnerability or collision. Today those concerns are recognizable but distributed across functions, flags, and timers. A framework should make them explicit.

## 5. Menus, campaign, economy, and feedback

Most UI is drawn on canvas using a custom 3 × 5 glyph font, scaled large text, icons, key chips, bars, and sprite previews. Hit tests use manually authored rectangles. HTML buttons are currently reserved for the touch rail. There is no DOM-based level editor or general menu component library. See [font](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html#L678), [UI helpers](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html#L5127), and [state machine](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html#L5989).

The main route is title → character selection → opening scene/map → briefing → play. Wins lead to results, upgrades, and the next stage; losses lead to a death card and retry/selection. Boss cards, the finale, loop selection, and unlocks extend that graph. `UPGRADES` describes offers and prices, while behavior reads upgrade levels and `CFG` values. Progression therefore combines authored data with code.

Feedback is a first-class layer: telegraphs, floaters, muzzle flashes, camera shake, hit-stop, pickup poses, rising combo pitch, and animated HUD notches. `onPickup()` routes pickup categories to sound, flash, sparkle, and hit-stop. It deliberately avoids stopping the entire browser/audio clock. See [pickup presentation](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html#L11675).

Best scores, unlocks, seen cutscenes, and mute preference use guarded `localStorage` operations. This is not a general saved-game snapshot system. Storage keys are game-specific strings but not a formal framework namespace. Separate GitHub Pages games under one origin will need explicit project IDs to avoid collisions.

**Reusable lesson:** derive button labels, briefings, pause help, and availability from the same action metadata. Reserve HUD space in the viewport contract. Represent scene transitions explicitly, and centralize save namespaces and feedback events.

## 6. Music and sound design

The soundtrack is synthesized in Web Audio, not an embedded movie recording. It is a browser score inspired by the film's musical vocabulary, not a hardware-accurate NES/SNES emulator. Its current source contains a D-minor melodic motif, sustained harmonic beds, a five-stroke machine rhythm, metallic percussion, and separate faster gameplay arrangements. This analysis is based on score and synthesis code; it is not a new listening evaluation.

### Sound-generation layer

The score offers six named melodic voices: brass, strings, bass, pulse, glass, and threat. They combine oscillators, detuning, frequency ratios, low-pass filtering, envelopes, panning, and reverb sends. Metallic hits use inharmonic sine partials plus filtered noise. Drum/snare sounds combine swept oscillators and noise. A stereo room impulse is synthesized locally; music has a compressor. Gameplay SFX have a separate bus using pulse/triangle tones and LFSR noise. Gunfire temporarily ducks music. See [graph and instruments](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html#L7539) and [SFX recipes](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html#L7915).

### Composition layer

An event contains `{at, voice, note, dur, vel, pan, heat}`. `at` and `dur` are quarter-note beats; the percussion events omit a pitch. A phrase has a beat length and sorted events. A track has BPM, phrases, loop behavior, optional intro-only phrases (`loopFrom`), gain, and intensity gating. Code helpers generate repeating pulse patterns and arrangements from authored note lines. The phrase lengths include six and 6.5 beats; a future editor must support fractional positions and non-4/4 structures.

| Cue | Current tempo | Arrangement purpose |
| --- | ---: | --- |
| Title | 94 BPM | Opening machine pulse and broad theme |
| Map / shop / ending | 82 / 90 / 74 BPM | Softer, less percussive beds |
| Dedicated opening/interstitial cutscene tracks | 88–90 BPM | Opening cue followed by quieter reading bed |
| Active Galleria `play_sale` | 128 BPM | Eighth-note drive and short melodic calls |
| Other active crowd themes | 132 / 140 / 116 BPM | After-hours / industrial / ward variants |
| Active drain / mill | 148 / 144 BPM | Pursuit and boss intensity |

The gameplay change is more than speeding up the title: `pursuitPhrase()` adds shorter bass/pulse patterns, call-and-response melody, reduced releases/reverb, and intensity-dependent fills. `heat` gates allow extra layers to enter as danger rises. The layer choice is captured when a phrase starts, so it is phrase-boundary adaptation, not a continuous music mixer. See [track definitions](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html#L7720) and [gameplay arrangements](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html#L7800).

### Playback layer

Audio starts after user interaction. A scheduler wakes every 25 ms and schedules roughly 100 ms ahead using `AudioContext.currentTime`. It skips a backlog after throttling rather than producing a burst of overdue notes. Track changes fade/retire a bus, stop scheduled sources, and disconnect nodes. Source lifetimes are tracked so sustained voices do not accumulate. Missing audio support leaves gameplay playable. `audioSync()` maps screens and encounters to cues. See [scheduler and routing](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html#L7833).

**Reusable lesson:** this is already the core of a music-authoring system. Extract instrument presets, beat events, phrases, arrangements, and cue rules into editable data. Keep the audio-clock scheduler shared between editor preview and game export. A piano roll alone would miss the distinctive parts: drums, variable phrase lengths, instrument timbre, intensity layers, and transitions.

## 7. Cutscenes and directed motion

`CUT_SCENES` is a storyboard table. Each panel selects a named shot, duration, caption, optional sound events, and optional impact frame. The scene has a music cue. A runtime tracks scene/panel index, panel time, typed text, skip hold, and continuation. It supports typewriter text, completing a line, advancing a panel, skipping, and remembering watched scenes. Inputs are cleared at entry/exit. See [storyboards](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html#L6347) and [scene lifecycle](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html#L6914).

The actual staging is in `ciShot()`: hand-authored math positions portraits, moves vehicles, generates fire/smoke, animates jumps, lowers the T-800, and draws the final road. `renderCut()` adds clipping, impact flashes, short fades, captions, chapter labels, and progress dots. The finale is five shots: foundry wide, farewell close-up, lowering, thumb, and road. See [shot renderer](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html#L7213).

The existing code has **storyboard data but no general timeline editor**. Named shots are code branches. Some helpers reuse game art, but the modern cinematic path also has independent portraits and bespoke bodies/vehicles. Replacing a gameplay sprite does not automatically replace every depiction in a cutscene.

**Reusable lesson:** retain storyboards and optional portrait art, but bind scene actors to character IDs. Use reusable transform tracks and semantic animation clips for shared sprites. Make timeline evaluation seekable and separate from sound/event emission; otherwise scrubbing could replay hits, rewards, or transitions.

## 8. Delivery, validation, and what is missing

The repository serves `index.html` through GitHub Pages from `main`; `.nojekyll` makes it a plain static publication. Embedded portraits finish loading before the animation loop starts, with fallbacks on error. Generated art and audio need no network downloads. A local file and a hosted page have separate browser-storage behavior.

The checked-in [test harness](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/tests/runtime.cjs) runs the inline script in Node's VM with minimal DOM/canvas shims. [Mobile-input tests](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/tests/mobile-input.cjs) cover 15 input cases and passed during this investigation. The shim calls the real game functions, but its drawing operations are no-ops; it does not prove visual quality, browser layout, actual audio, or physical-device touch behavior. Earlier desktop-equivalence checks were temporary development scripts, not a complete committed regression suite.

Missing framework capabilities include versioned asset schemas, editable source art, a music/level/cutscene editor, generic character/action contracts, a build/export pipeline, reusable scene lifecycle disposal, and a permanent multi-game test suite. These are proposed work, not hidden features already present.

## 9. Recipe for another agent building a similar game

1. Define the core loop, role goals, win/loss rules, viewport, and logical units before making art. Start with one encounter and one role.
2. Implement a fixed-step simulation and named screen flow. Add a seed, direct encounter launch, and headless step command early.
3. Build placeholder sprites with a known foot anchor. Separate appearance, collision, and movement. Add a second skin immediately to expose hardcoded body assumptions.
4. Build world geometry, valid spawning, movement, and collision before decoration. Keep UI-safe space separate from the playable region.
5. Model each move with activation conditions, startup/active/recovery, costs, target rules, collision checks, and cancellation. Attach animation and SFX to the resulting events.
6. Give AI the same action entry points as the player, with explicit policy differences. Test blocked targets, simultaneous hits, death, and state transitions.
7. Add menus and onboarding from action metadata. Mouse and touch should produce the same semantic actions, with press/release/cancel distinguished.
8. Compose a sparse title cue and a separate active-play arrangement. Reuse motif and instruments while changing rhythm, articulation, density, and intensity layers.
9. Add short storyboards using the same character identities. Optional high-resolution portraits supplement shared sprites. Define skip outcomes and input cleanup.
10. Add feedback, progression, saves, and further encounters after the core loop works. Test the built HTML offline as well as in development, then publish that artifact.

For a direct extension of this exact game, inspect `CFG`, the relevant role/encounter update, its draw functions, and all associated damage/input paths together. For a new game, use the architectural plan rather than copying the entire Terminator file and renaming globals.
