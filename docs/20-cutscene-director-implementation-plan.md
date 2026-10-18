# Cutscene director: consolidated implementation plan

Revised October 18, 2026 after mockup review and the agent/style/weather workflow requests. **Status: implementation in progress against the final S01–S14 revision.** This is the authoritative director execution plan, replacing its earlier D0–D7 ordering and the provisional A0–A5 sequence in [the agent research](23-agent-assisted-director.md).

Read with [framework contracts](02-framework-plan.md), [repository/asset strategy](03-repository-and-asset-strategy.md), [initial research](19-cutscene-director-research.md), [mockup critique](22-director-mockup-review.md), and [Claude integration research](23-agent-assisted-director.md). The [final Claude Design prompt](24-director-final-claude-design-prompt.md) asks for one implementation-ready synthesis and its missing screens; the [first five-concept prompt](21-cutscene-director-claude-design-prompt.md) is historical exploration.

## 1. Product decision and release boundary

Build an agent-assisted, shot-based 2D cutscene director. The main journey is **describe → assemble a playable draft → inspect → direct revisions or edit manually → keep → use in game**. The complete manual workflow remains available without an agent, account or model connection. Both paths use the same documents, commands, validation and runtime.

Use Director's Desk's story structure, Stagecraft's large stage and direct manipulation, Pocket Timeline's optional timing precision, Story Script's brief/dialogue, and Scene Kit's reusable assets and compatibility. Do not mount five competing editors or make chat the only way to change generated output.

The primary output is editable scene data and its complete dependency pack. The same evaluator/render host must play it in the director, a standalone HTML player and a game. Video export is a later review artifact. An exported one-page game includes no agent, credentials, generator, personal-library connection or external asset fetch.

### What v1 promises

- Three-shot or longer scenes using real game or standalone actors, layered sets, semantic animations, reusable motions, camera, dialogue, recorded voice, music, SFX and bounded effects.
- An external-Claude-Code route and an integrated local-agent route; browser-only users retain manual editing, packs and connection instructions.
- Reusable style families and explicit environment profiles, with instant preview swaps when compatible variants are already available.
- A bounded original acceptance fixture with prepared **8-bit-inspired, 16-bit-inspired and realistic 2D** appearances, plus clear/rain/storm environment variants. These labels describe art direction, not hardware emulation. Realistic means detailed 2D art and frame sequences, not a 3D/physics engine.
- Agent-assisted preparation of missing assets through configured services or imports, limited to affected dependencies. Missing media/animation capability remains visible until resolved.
- Candidate review, enforced preservation locks, revision-safe merging with manual work, undo, local library versions and explicit project installation.

The fixture proves changing appearance without restaging the scene. It does not promise arbitrary still images become walking characters, automatic skeletal retargeting, perfect style conversion, new camera angles from flat art, physically correct relighting or universal game-code import. Rich branching dialogue, full pixel-art authoring, 3D, cloud collaboration, marketplace and final-video encoding remain later work. Imported voice and manual/simple mouth animation are required; automatic voice generation and mouth analysis are optional adapters.

## 2. User workflow and final interface

### Start and compose

Enter through a game's scene slot, a standalone brief, a starter or an imported scene pack. Preserve Pocket Score's distinction between selected content, current game context, working draft and pinned assignment. **Edit original**, **Edit assigned** and **Start fresh** create guarded working copies; none changes the game until **Use in game**.

The primary entry asks for story beats, cast, style/reference, environment, target duration and required dialogue, with sensible defaults from the game. The agent inspects actual assets/capabilities, shows a compact shot plan and assembles a rough playable sequence. Missing art can be a labeled placeholder. Do not wait for every polished asset before exposing pacing. Routine decisions proceed within the user's configured scope; material ambiguities and out-of-scope spending surface explicitly.

### Three workspaces, one scene

| Workspace | Layout and purpose |
| --- | --- |
| **Direct** — default | Narrow game/scene navigator; large stage; compact shot ribbon and transport; right dock with Direction / Inspect / Changes. Prompt context includes selected object, shot, time range and protected properties. |
| **Edit** | Same stage/selection/playhead, contextual manual tools, expandable grouped timeline and optional Lines view. Full keyboard/numeric alternatives. Agent dock may be closed completely. |
| **Assets** | Search/preview/import, style families, sets, props, motions, voices and effects. Compatibility filters and character fitting room; matrix diagnostics only when useful. Return to the same editing context. |

Asset drawer, expanded inspector and long conversation should not all compete for stage width. At 1280px use drawers/tabs; at 1440px preserve a large stage. Phone support initially means readable playback and touch advance/skip, not a complete phone editor. Use restrained light/warm UI chrome, a dark stage, ordinary readable UI fonts and semantic status colors; art style changes must not restyle the application's controls.

**Storyboard:** thumbnail, shot name, duration, reading-gate indicator, issue count; reorder/duplicate and collapse. Support more than three shots without shrinking all cards. Distinguish scene time and shot-local time.

**Stage:** move actors/props, path endpoints and camera crop; reveal only selection-relevant guides. Ground/speech/hand anchors, safe area, parallax and occlusion have inspection modes. Label the active operation **Shot starting pose**, **Action endpoint**, or **Key at playhead**; do not overload all drags with a binary pose/animate toggle. A ghost selected key is distinct from the current playback pose.

**Timeline:** compact by default; expand actor Motion / Animation / Dialogue, shared Camera / Music / SFX / Effects / Text lanes. Seconds with 60 Hz frame stepping; beat grid is explicitly derived from music. Drag is one undo transaction. Motion trim/retime, frame-loop speed/repeats, audio trim and text duration have separate clear semantics.

**Timing relationships:** support selected typed links such as `motion.end = dialogue.start` and `dialogue.start = turn.end + offset`. Links form a validated acyclic graph. Each link declares whether its dependent action shifts intact or stretches against a fixed opposite endpoint. Locked timing conflicts produce a diagnostic; no implicit cycle resolution, arbitrary expressions or silent retiming of other scenes.

**Dialogue:** start with text, speaker and playback. Expand voice/reveal/mouth settings on request. Inline stage editing and Lines view operate on the same data. Compare edited text with a supplied/transcribed transcript only when its origin is known; label stale voice and use **Keep existing recording anyway** for an acknowledged mismatch. Character mouth capability is explicit.

### Iterations and acceptance

A run creates a candidate against an immutable base. Stream only validated snapshots into that candidate preview. Keep the main draft editable; compare base→candidate with base→current before acceptance. Merge disjoint changes, surface conflicts by object/property, and never overwrite intervening human work.

The Changes dock shows what changed, stayed fixed and remains unresolved; each item selects its object/time span. Provide synchronized before/after play and scrub, labeled variants, Keep / Revise / Discard, and one undo operation per accepted revision. Accept dependency-complete groups rather than raw fields; mixed variants must validate together. For retimed shots compare by shot/local time, and label when absolute-time synchronization is no longer possible.

Ordinary edits affect this scene instance. **Save as reusable…** and **Update shared asset…** are separate actions. Candidate acceptance, library versioning, local saving and installing in a game remain different operations with clear status.

### Music and game continuity

Keep one mounted game across layout changes. Preview at trigger may reset an adapter-authored checkpoint; it does not rewind arbitrary gameplay. **Play shot**, **Play scene** and **Preview in game** have distinct scopes.

Open a music clip in Pocket Score through the existing guarded copied-draft workflow. Record scene/shot/clip/playhead return context, pause cinematic playback, and return to audition the new music. **Use this version in scene** explicitly updates the reference; tempo changes review beat-linked markers. Preserve the selected shot and game instance.

When paused, scene edits silently re-evaluate current time. During playback queue a valid revision to the next shot boundary; **Preview changes now** restarts the current shot. Structural edits may stop/re-evaluate rather than guess how to preserve event state.

## 3. Layered assets and reusable sets

Use **semantic asset families → compatible appearance variants → assembled sets → shot recipes → scene instances**. A flat image remains a valid asset; it is not automatically a layered set.

| Content | Contract and reuse |
| --- | --- |
| Actor family | Stable character identity/capabilities; no health, collision or AI changes through appearance |
| Appearance variant | Sprite/portrait pack, frames, facings, scale mapping, origins/sockets, semantic clips, optional mouth shapes |
| Motion | Paths, facing requests, semantic actions, visual offsets, timing and ease; editable parameters |
| Prop/set family | Semantic slots such as station facade, door, platform, lamp and stand markers; style-specific artwork maps into stable layout |
| Set instance | Nodes/groups, depth, masks, parallax, markers, lighting anchors and environment response capabilities |
| Effect recipe | Versioned typed implementation and finite parameters; seed, bounds, lifecycle; no arbitrary JS in asset JSON |
| Style profile | Art references, palette/material rules, detail/pixel density, perspective, line/shading treatment, presentation sampling and approved variant mappings |
| Environment profile | Weather/lighting/surface/audio channel defaults and response requirements; authored transitions separate from static profile |
| Dialogue/audio | Text/style, recorded voice/transcript/cues, scores/patches/SFX; independent from visual style by default |
| Shot recipe | Named cast/set/audio slots, camera/motion/dialogue layout and timing requirements |

### Set composition order

1. Distant sky/skyline and far scenery, often baked images with parallax.
2. Architecture and rear props, with separable doors/windows where useful.
3. Ground/platform/rails/decals and presentation movement markers.
4. Actors and actor-depth props in an explicit depth/Y-sort group.
5. Foreground occluders, including separate front portions of columns/railings.
6. Lighting/masks/local effects in declared passes; lantern light follows its socket.
7. Weather layers at explicit depths, with bounds/exclusion masks.
8. Screen-level text, captions, fades and accessibility presentation.

Render passes are explicit; lights and rain are not always simply drawn on top. A roof can mask rain; a foreground pillar can hide an actor. Set ground markers guide staging and are not automatically gameplay collision data. Coordinate space is logical world units, with local transforms, camera crop and per-variant pixels-per-unit. Pixel snapping is a renderer policy, not a destructive rewrite of paths.

A `SetDocument` contains stable nodes, asset-family references, parent transforms, render group/depth, masks, markers, parameterized light/effect instances, environment capabilities and dependencies. Validate parent cycles, missing masks, depth ties and unsupported renderer operations. Editing a shared set defaults to a scene-instance override, not a global mutation.

### Library/import/production rules

Reuse game assets, then coherent library sets/style kits, then approved source imports or configured media creation. Preserve source/author/license, original bytes, provider/recipe metadata and derivation. Custom PNG sheets, Aseprite PNG+JSON, ordinary images/audio and framework packs are first-class. Native `.aseprite` decoding can wait. Confirm suggested animation tags, untrimmed coordinates, per-frame durations, facing/mirroring, origin and sockets in a fitting room.

A static image can move, fade or bob. Missing walk/talk or hand anchors gets a precise remedy: map valid frames, select a compatible pack, prepare missing art, or choose an explicit permitted fallback. Never silently substitute idle sliding for required locomotion.

Generate a blockout and a small contact sheet before broad art production. Keep editable weather/glow/doors outside flattened backdrops. New raster layers share layout/reference/perspective, transparent edges and camera overscan; inspect actual alpha and composition. Splitting a flattened picture needs imperfect segmentation/inpainting, so show that preparation task honestly.

Preserve the score-only library/backups through additive migration or a compatible sidecar catalog. Asset identity, immutable content revision and optimistic draft revision are distinct. Imported collisions fork/remap the full dependency closure. Store binaries separately while authoring; portable packs include documents/media/locks/notices. Pinned projects work after their originating library is removed.

## 4. Style and weather changes without restaging

### Separate the durable layers

| Layer | Contains | Changes when style changes? |
| --- | --- | --- |
| Story | Shots, dialogue, outcomes, intended actions | No, unless explicitly requested |
| Staging | Actor/prop identity, logical layout, paths, timing links, camera choreography | No; incompatible art produces a repair proposal |
| Appearance bindings | Family→variant choices, frames/portraits, materials/fonts when opted in | Yes |
| Environment | Weather, light, time of day, wetness, ambience | No by default; independent controls |
| Presentation | Pixel sampling, texture density, effect appearance, caption skin | Only declared style channels; readable UI/caption content remains |
| Compiled output | Resolved media, atlas data, render caches and offline bundle | Only affected derivatives rebuilt; final HTML is repackaged when exported |

**No complete rebuild** means no restaging/recreating unaffected source or regenerating approved media. A new single-HTML export still validates and packages changed content. A prepared variant can switch without a model call; missing art needs preparation and may take time/cost. The UI must distinguish these states.

### Semantic identity and appearance compatibility

Use a stable family such as `appearance-family:courier`, with pinned variants `courier-8`, `courier-16`, `courier-realistic`. The scene targets actor `courier`, never a bitmap's array position. A compatible variant supplies required `idle`, `walk`, `turn` clips/facings, ground/hand/speech sockets and coordinate mapping. Keeper also supplies the fixture's talk capability. Keep collision, timing and gameplay anchors outside appearance.

Different frame counts/dimensions are allowed. Evaluate semantic animation by normalized action phase; each pack maps phase into its own frames. Walk cadence/stride metadata must match path speed within the supported range, or report foot-sliding risk and offer a visual-only repair. Frame-specific sockets follow the selected frame. Do not silently change scene duration to fit new frames.

Preserve a logical height/anchor envelope and adapt source pixels through pixels-per-unit, trim and pivot metadata. Changing artistic proportions may still break framing, attachments, occlusion or silhouette readability. Validate representative shots and show alignment adjustments as a candidate. A hand anchor that moves does not move authoritative gameplay hit geometry.

Set families work similarly: stable slots for facade/door/platform/lamp/occluders and markers, with style art aligned to those slots. A radically different building layout is a **set/layout variant**, not a safe style swap. Preserved marker relationships take priority; unresolved mappings block a “ready” label.

### Style resolution and coverage

Resolve style through explicit pinned mappings: project default → scene override → shot override → object override, with the most specific binding winning. No fuzzy runtime search or mutable “latest.” Object overrides and preservation locks remain visible. A scene-wide restyle lists exceptions; offer preserve them or explicitly include them, never silently discard them.

A style change plans the closure of visible actors, portraits, set nodes, props, fonts/caption skins when selected, and effect render variants. Classify each item as **Ready**, **Needs mapping**, **Needs new art/frames**, **Unsupported**, or **Kept unchanged**. Inventory required clips across the affected shots, not just the current frame. Do not show a realistic character as complete if only its idle frame exists.

Ready items switch immediately in a candidate. Missing items can be sourced/imported/generated through agent tools. Show a labeled partial preview with placeholders or retained mismatched art; never call it a finished style. Store prepared output as a new immutable variant, so subsequent switches reuse it. Retain the original unchanged.

Realistic 2D requires detailed compatible art and masks, not a smoothing filter on pixel art. Existing 2D framing can remain; a new perspective or 3D camera angle is separate scope. The v1 curated realistic fixture must include its required animations, sufficient overscan and measured decoded-memory/export size. Arbitrary user assets may remain incomplete until prepared. Multi-angle/skeletal/3D conversion is deferred.

Caption *content and accessibility metrics* are protected by default. Offer caption visual styling separately. Preserve spoken recordings, music, SFX and timing on visual restyle unless selected explicitly. No unexpected voice regeneration or soundtrack substitution.

### Environment as coordinated channels

Expose **Weather**, **Time of day**, **Lighting**, **Surface state**, and **Ambience** as distinct channels. Convenient presets can propose coordinated values:

| Preset | Typical channel changes | Required response |
| --- | --- | --- |
| Clear | Rain/fog off, chosen ambient light, dry or user-retained surface | Clear sky/background support when sky is visible |
| Sunny daytime | Clear sky, daytime palette/lighting, optional sun/shadow treatment, daytime ambience | Day/clear-compatible art; explicit time-of-day change |
| Rain | Rear/front rain, subdued light, wet decals/reflections, rain ambience | Rain masks and optional wetness response |
| Storm | Cloud/sky variation, stronger wind/rain, wet surfaces, optional lightning/thunder | Storm response and bounded effects; lightning off/reduced under accessibility settings |

Sunny is not a synonym for “no rain.” If time of day is locked to night, propose **Clear night** or ask to include a daytime change. Do not silently invalidate a night-scene brief. Lighting and weather can differ by shot; transitions are authored over time with explicit easing and pinned profile endpoints, not abrupt background changes unless requested.

Environment presets touch only declared channels; manual lamp intensity and protected actor/staging properties persist. Define precedence as profile defaults → scene parameters → shot parameters → object response overrides → evaluated authored keys. Replacing defaults does not remove authored keys; display their overrides and offer explicit reset/include choices. A property protection lock prevents changes at every layer.

Weather appearance depends on style, but its semantic values do not. One rain-density/wind specification can select pixel droplets or detailed streaks through a style-specific effect renderer. Record the seed and implementation version. Wind only moves assets declaring a sway response; flags cannot animate just because the preset says storm.

A building with a sunny sky or rain baked into its image needs a compatible alternative, mask or new background. A dark tint is not a convincing relighting solution. Show the dependency instead of adding rain over contradictory sunny art. Wet ground/reflections use supported masks/decals; do not claim general physical reflection/shadow computation.

Weather does not introduce gameplay hazards, alter collision or change outcomes. Thunder, rain audio and music ducking use bounded audio buses; the user can preserve ambience while changing visuals. Reduced motion/flash settings affect presentation without retiming story events.

### Incremental work, caches and variants

Maintain an explicit dependency graph from scene/shot→binding→variant→media/recipe→compiled derivative. Every accepted edit emits changed IDs/property paths and invalidates only dependent previews, atlas/effect caches and compiled nodes. Cache keys include relevant source hashes, profile/recipe versions, parameters, seeds and renderer/toolchain versions. Moving a lamp invalidates composition/preview, not the building source; changing weather parameters rerenders its effects, not actor art. A style change may legitimately replace most visible art, but still preserves story/staging.

Generation-job keys include family, base references, target profile, required clip/frame set and provider recipe/version/options. Use idempotency keys to avoid duplicate paid jobs on retry. Cache completed bytes as the authority; a seed is not a promise a remote generator will reproduce them. Failed/stopped jobs retain completed validated assets and can resume only missing work. Alternative variants use isolated candidate directories/manifests, never the same writable scene files.

Compile only the selected runtime variant closure by default. An editable source pack may include selected alternatives explicitly; label source-pack versus game size. Do not ship every style in the library. A game that intentionally switches styles/weather at runtime must declare a finite supported variant set so pruning retains it. Default style switching is an authoring capability, not a new runtime gameplay mechanic.

## 5. Documents, editing contracts and package ownership

TypeBox remains schema authority; preserve Score schema v1. Every enabled new kind needs complete validating fixtures, reference/semantic checks, migration rules and typed commands. No arbitrary functions/expressions in persisted data.

| Document | Required fields/relationships |
| --- | --- |
| Cinematic | ID/version, 60 Hz rate, viewport/world units, cast, ordered shot IDs/durations/initial states/tracks, pinned set/style/environment bindings, music policy, dialogue gates, complete/skip outcome policy |
| Set | Logical bounds, stable nodes/family slots, transforms/depth/groups/masks, stand/entry/camera markers, response capabilities and dependencies |
| Asset family / appearance variant | Semantic identity, required/offered capabilities, pinned style mappings, frames/facings/phase map, origin/sockets, scale, masks, provenance |
| Style profile | Explicit art/presentation constraints and compatible pinned binding/effect mappings; no vague runtime prompt |
| Environment profile | Typed channel values, response requirements, transition-compatible parameters, seed/recipe references |
| Motion / dialogue / audio | Existing planned semantic action/path, line/text/style/voice/cue and score/SFX contracts |
| Creative brief | Intent, references, style constraints, target duration, accepted decisions; independent of provider transcript |
| Candidate/run metadata | Base/candidate revision, scope/locks, command batches, dependencies, diagnostics, provider session/job references, usage and recovery state; not runtime data |

Use `cinematics/`, `sets/`, `appearances/`, `styles/`, `environments/`, `motions/`, `dialogue/` and `assets/`; manifest registry maps stable IDs to contained relative paths. `assets.lock.json` pins resolved origin revisions; flow documents connect installation slots. Candidate/run metadata belongs in a local ignored working area and is excluded from public export by default. Shareable creative brief content is opt-in in recovery/source packs; no credentials or sensitive chat transcripts.

Shot intervals are half-open, cinematic time is integer 60 Hz ticks and media offsets can use integer samples with defined conversion. Music PPQ is separate. Every shot's initial state resolves explicitly; “continue pose” compiles into a concrete state. One writer owns a property at an interval unless a named blend is supported. Root transform and cosmetic offsets are separate. Commands include expected revision, scope and writable property paths; a drag/batch is one undo step. Direct valid JSON editing remains supported with reload/conflict checks.

| Package | Responsibility |
| --- | --- |
| `packages/project` | Schemas, commands, locks, migrations, semantic validation and typed dependency rules |
| `packages/cinematic-core` — new on first slice | DOM-free compile/evaluate, timing links, variant resolution, dependency planning, event cursor and outcomes |
| `packages/runtime` — planned | Chosen shared renderer, sprite/font/set/effect presentation, leases/input/audio lifecycle |
| `packages/cinematic-editor` — new with UI | Direct/Edit/Assets, stage/timeline/dialogue, brief, candidate review and transformation previews |
| `packages/cinematic-io` — new with portable slice | Import normalization/loss reports, packs and standalone player export |
| `packages/asset-library` | General catalog/blobs/families/revisions/closure and derived-media caches, preserving music storage compatibility |
| `packages/music-*` | Existing score editing and synthesis behind a cinematic audio adapter; no duplicate synth |
| `packages/studio-server` — planned | Local revision-safe project service, candidate isolation, file watching, credential references, run supervisor and provider adapters |
| `packages/cli`, `exporter` — planned | Agent/tool surface, transaction install, self-contained build/recovery and verification |
| `apps/director`, `apps/studio` | Standalone/shared shell and game context; mount the same feature |

Add packages only with executable slices. Runtime/core cannot depend on React, agent SDKs, importers, Node storage, cloud SDKs or personal-library services. The Canvas-versus-LittleJS experiment remains required before selecting the general runtime backend; detailed 2D assets do not inherently require a second engine.

## 6. Playback and game ownership

`evaluate(scene, time, bindings, seed)` returns visual state without side effects. Frame/mouth choice, text reveal, camera, weather and other effects derive from time and seed. Repeated/backward/random seek agrees with sequential evaluation. Precompute deterministic particle spawn/lifetime data or derive it directly; do not advance a mutable random stream by render order.

A separate playback cursor emits events crossed in `(previousTime, currentTime]`, plus a defined tick-zero pass. Seek is silent and emits no progression or accumulated SFX. Starting playback mid-scene starts ongoing voice/music at a defined offset without replaying old events. Dispose sources/listeners and invalidate callbacks on stop/restart/cancel. Page hide pauses audiovisual progression together; resume uses a new audio-clock anchor rather than wall-clock catch-up.

Scene time coordinates presentation and audio, anchored to the audio clock when available. Silent playback still works. Music persists across shots only through a declared scene-bed policy; other cues have explicit transitions. Beat-linked keys convert from pinned BPM/PPQ, never equate score ticks with cinematic ticks.

At a reading gate, hold scene time/poses and finished speech, allowing explicitly looping ambience. First advance reveals remaining text; next releases the gate. Scrub previews gate state without requiring clicks. Display base duration plus player reading time, not false exact playthrough duration.

Speech separates text, imported audio, transcript and optional mouth cues. A semantic talk loop is distinct from recorded phoneme alignment; a character with no mouth art uses captions/portrait. Bubble anchors follow frame sockets and stay in safe area. Editing text marks voice/cues stale. Extending or trimming a line for voice length is explicit. Captions/transcript need an accessible DOM path in addition to canvas presentation.

Use presentation proxies by default. Live-entity cinematics need property leases that suspend competing AI/input and define restore/commit behavior. Complete/skip emits exactly one outcome; skip applies declared final state without replaying intermediate commands. Cancel restores and does not count as completion. Gameplay root movement/final endpoints use authoritative fixed-tick/fixed-point commands, not visual easing. Appearance/weather edits cannot change collision, damage or progression.

Clear held/queued input at entry/exit, consume advance/skip and require release before resumed gameplay can fire. Keyboard, pointer and touch share semantic actions. Reduced-motion/flash policies preserve story timing and readable text.

## 7. Claude, services and iteration infrastructure

### Connections

Use the patterns and dated primary-source evidence in [the Claude research](23-agent-assisted-director.md#4-claude-access-recommended-routes). Add **Settings → Agents & services** to the authoring shell, not the exported game.

1. **External Claude Code:** user connects their existing session through CLI/MCP. The agent retains native auth/billing; director tools expose a constrained candidate workspace.
2. **Integrated local agent:** local companion runs a supported unmodified Claude Code path or an API-key-backed Agent SDK adapter. The browser displays the same run/status/review UI. Do not impersonate Claude's sign-in, copy subscription tokens or assume every distribution/auth route is interchangeable.
3. **Manual/browser-only:** full editing/packs remain; companion-unavailable state provides setup/reconnect. Do not put long-lived keys in static JavaScript or browser project storage.

Provider keys go in an OS credential vault or explicit session-only/environment configuration; settings store credential references. Existing agent credentials remain managed by that agent. Show effective provider/model/billing source, connected/capability status, test/reconnect/clear. Disconnecting this app does not log out Claude globally. Recheck current provider terms/interfaces before shipping, using the documented native/API distinction.

Image generation, speech generation, asset search and mouth analysis are separate service capabilities. An agent may request them only within the configured policy. Missing image generation still allows existing assets/procedural assembly and import; show a resumable missing-media task, not failure of the entire scene.

### Shared tool surface and context

Expose typed `inspect_project`, `read_scene`, `read_selection`, `search_assets`, `inspect_family`, `plan_style_change`, `plan_environment_change`, `create_candidate`, `apply_scene_commands`, `import_asset`, `request_media_job`, `render_frames`, `validate_scene`, `diff_candidate`, and `propose_result` operations. CLI is authoritative; MCP is a thin wrapper. Avoid a general shell for normal scene edits. ACP can be a later external-agent host adapter, not a substitute for document tools.

Context includes compact structured scene/catalog data, current revision, selected IDs/time, brief/style profile, locks, recent human changes, relevant screenshots and diagnostics. Render actual runtime frames to inspect results; text claims or schema validation alone do not prove visual quality. Effects/asset metadata/imported files are data, not instructions. New executable extensions require a separate trusted code workflow.

### Durable runs and safe iteration

Track `queued → inspecting → planning → assembling → sourcing → validating → ready`, with `needs-input`, `failed` and `cancelled` exits. Each run stores exact provider session ID, base/candidate revision, scope, lock snapshot, command/job idempotency keys, completed assets, cost/usage, diagnostics and accepted decisions. Session resume always re-reads current source; conversation forks do not isolate files. Reconstruct from project data if transcript history disappears.

Workers mutate isolated candidates through validated atomic command batches. A lock forbids changing protected data through direct edits or indirect parent/profile changes; validation checks resolved effective state as well as authored fields. Parent deletion, binding replacement and layout/style changes that would alter a protected child must be rejected or surfaced as conflicts. Scope presets: selected object, shot, scene; game-wide changes need explicit selection.

On Keep, three-way compare base/current/candidate; merge independent changes, surface same-property or dependency conflicts and validate the resulting closure. One accepted iteration is one undo transaction. Do not apply inverse patches to a different base or equate file checkpointing with full library/media/install rollback.

Cancellation stops new work, invalidates late messages/writes and retains completed validated candidate data; paid remote jobs may be non-cancellable, so mark them and retain results when they return without applying them. Retry only missing/failed work. Bound turns, repair loops, media jobs and cost. A run cannot repeatedly regenerate all art to fix one incompatible socket.

Authorize project root/tool/network/spend scope once; routine draft work continues without per-layer prompts. Show actionable requests only for material ambiguity or exceeding configured scope. Cost displays distinguish known usage, estimates and unavailable subscription remaining limits; media jobs have separate estimates. Normal Keep is a creative decision, not a recurring system-permission gate. Actual game installation remains an explicit action.

The companion binds loopback, validates Origin/session token, contains paths/symlinks, and keeps secrets out of logs/prompts/packs. Label local execution and remote model/media data transfer honestly. Hosted agents/accounts/secrets/quota storage are later scope, not an implicit static-site feature.

## 8. Game integration, installation and export

A versioned cinematic bridge shares transport helpers with music but negotiates separate scene capabilities. Catalog/start/seek/preview/assign/assets are explicit; unsupported controls are unavailable with a remedy. Validate origin/source/session and bounded payloads; correlate requests, reject stale replies and dispose cleanly. Transfer media once per hash rather than embed binaries in every drag/scrub message.

The game reports context, scene/shot/time and active preview revision. `seekScene` seeks presentation; `startContext` resets a known checkpoint. The current Terminator music bridge implements start checkpoints, not general cinematic seek or production flow placement.

Proposed commands, not available today:

```sh
gamekit cinematic inspect ./game --json
gamekit cinematic validate ./scene-pack --json
gamekit cinematic install ./scene-pack --project ./game --slot opening --dry-run --json
gamekit cinematic install ./scene-pack --project ./game --slot opening --expected-revision 12 --json
gamekit preview ./game --scene cinematic:arrival --shot arrival-wide
gamekit build ./game --format single-html --out dist/index.html
gamekit verify dist/index.html --offline
```

Use in game shows slot, scene revision, changed dependencies, compatibility/blockers, size and complete/skip outcomes. Routine details may collapse; scope cannot. Dry run returns add/change files, remaps, pinned hashes, slot/flow edges and expected revision. Installation stages the full selected closure, manifest/lock/flow changes, rechecks revision and commits one recoverable transaction. Missing placement returns valid slots rather than guessing. Reject traversal, unresolved bindings, incompatible schemas and undeclared code.

Packs include editable documents, required media, provenance/notices and a machine/human handoff with runtime version, scene IDs, placement and outcomes. Compile selected runtime data plus optional explicit recovery data; inline fonts/media and runtime with script-safe JSON/JS escaping. Test no attempted network requests, direct-file and nested-host operation, recover/rebuild parity and custom-module limitations. Runtime bundles contain neither unselected styles nor agent/editor dependencies unless a finite runtime variant set was declared.

Terminator remains a separate trusted local import. Its named `ciShot` drawing branches and live in-stage sequences do not automatically become reusable tracks. Extract known catalog/timing/text with source fingerprint; reconstruct one simple scene and compare frames/audio/inputs/outcomes. Mark unsupported procedural material reference-only or use a versioned game-specific adapter. Keep franchise assets and generated imports out of public starters; retain original campaign continuations rather than copying the preview's return-to-title behavior.

## 9. Dependency-ordered delivery and acceptance

These R milestones are the sole current execution order. They supersede the earlier D/A tables while retaining their runtime and offline gates.

| Step | Dependencies | Deliverable and completion gate |
| --- | --- | --- |
| **R0 — Fixture and canonical contracts** | None | Three-shot original station fixture, consistent cast capability manifest, separated set layers, typed commands/locks, style/environment schemas and validating examples. Define invariant versus mutable properties. |
| **R1 — Evaluator and offline baseline** | R0; renderer experiment | Pure seek/event evaluation, shared sprite/set/effect/audio host, captions/reading/skip/outcomes, offline player and tiny scene→game flow. Direct/backward seek agrees with play; no network or leaked input. |
| **R2 — Library, variants and dependency planner** | R1 | Additive media/family storage, imports, ready-variant resolution, style/environment plans, cache invalidation, packs. Original song backups survive; style changes preserve staging; clear/rain transitions touch only declared channels. |
| **R3 — External agent vertical slice** | R1–R2; minimal local project service | CLI/MCP, isolated candidates, enforceable locks, structured inspection and runtime frame render. Existing Claude Code makes a playable draft, then changes weather in one shot without engine edits or unrelated regeneration. |
| **R4 — Final hybrid editor and review** | R2–R3 | Direct/Edit/Assets, brief, large stage, compact storyboard, timeline/Lines, fitting room, missing media, style/weather planner, before/after and conflicts. User creates/edits fully manually and accepts/undoes an agent revision. |
| **R5 — Integrated Claude and media adapters** | R3–R4 | Companion supervisor, supported native-agent/API paths, credential handling, separate media capabilities, budget/cancel/resume/retry. First functional image-preparation adapter or explicit import path; provider failure preserves work and retries reuse assets. |
| **R6 — Style/environment proof and context integration** | R4–R5 | Complete curated 8-bit/16-bit/realistic 2D fixture variants, sunny/clear/rain/storm responses, partial/preparation UX for custom assets, music drill-in and persistent game context. Measure memory/export cost and prove invariants across all supported combinations. |
| **R7 — Game installation and portability** | R2–R6; transactional project/export services | Install/dry-run/source watch/conflicts, dependency lock and flow registration, offline build/recovery. Agent and manual scenes work after disconnecting Claude/library; selected variant closure only. |
| **R8 — Content and hardening** | R7 | Starter recipes, one local Terminator reconstruction, browsers/device/accessibility QA, performance report, recovery/error documentation and release evidence. |

R3 comes before a large manual editor; it proves the primary workflow. Do not assume planned server/CLI packages exist: implement the needed narrow services with each milestone. V1 is incomplete without R7. Realistic appearance may consume far more content memory than pixel art; measure it explicitly rather than claim all variants meet a tiny pixel-demo budget.

### Verification matrix

- **Schema/semantics:** valid/invalid examples, version migrations, references/cycles, timing links, property ownership, missing clips/sockets/masks, facing/trim mapping and protection inherited through parents/profiles.
- **Presentation:** repeated/random/backward seek, tick-zero events, seeded weather, phase mapping with different frame counts, ground contact/equipment, caption-safe space, camera overscan/occlusion across variants.
- **Lifecycle:** exactly-once skip/complete, no side effects on scrub, reading gates, pause/hide/resume voice sync, cancellation/disposal and input release before gameplay.
- **Style invariants:** compare story/staging/gameplay hashes before/after. Dialogue text/voice, shot order/durations, paths, camera choreography, collision and outcomes remain unchanged unless explicitly included. Validate all required clips, not one screenshot.
- **Environment invariants:** rain/storm/clear affects only planned channels; locked night rejects silent sunny-day changes; baked incompatible art is flagged; accessibility suppresses flashes without retiming; authored overrides remain visible.
- **Incremental processing:** instrument counts/hashes proving weather did not regenerate actor/building art, lamp edits did not regenerate set sources, retries did not duplicate media jobs, and switching back reused pinned assets. HTML repackaging is allowed and reported separately.
- **Agent iteration:** first draft, selected-shot revision, lock conflict, concurrent manual edit merge/conflict, distinct variant storage, correct session resume, stale response rejection, cancellation with late media result, quota/auth failure and idempotent retry.
- **Workflow:** context→copy→edit→candidate→Keep→explicit assignment; persistent game instance; music edit/return; import/version/update/recovery; no change to shared libraries or installed game without the corresponding action.
- **Portability:** folder→pack→install→HTML→recovered-source equality/hashes with declared custom-code limits; dependencies remain available after library removal; no secrets, private run histories, editor SDKs or remote fetches in game.
- **Accessibility/device:** keyboard/numeric alternatives, focus/names, color-independent status, readable subtitles/transcript, reduced motion, 1280px editor and 390px player; Chromium/Firefox/WebKit plus one named phone.
- **Performance:** preserve framework review gates for the tiny reference (runtime ≤250 KiB gzip excluding media; tiny HTML ≤2 MiB raw; recorded phone input-ready ≤2 s; normal p95 update+draw ≤12 ms). Report per-style raw/compressed bytes, decoded texture/audio memory, ready-switch latency and cache reuse. Realistic fixture exceptions need an explicit reviewed budget before release, not hidden downscaling or silent waivers.

## 10. Decisions and remaining bounded choices

Adopt now: one canonical scene/command system; agent-first assembly plus full manual correction; layered sets; semantic appearance families; separate environment channels; prepared-variant swaps; candidate-only missing-media preparation; explicit scope/locks; local companion/external-agent/API options; library dependency closure; offline game output.

Reject as defaults: a full NLE fork; a new scene format per AI provider; arbitrary JavaScript in imported pieces; flattened-image-only scenes; assuming realistic art can be produced by a filter; changing collision/timing to accommodate a skin; mutating shared libraries during ordinary revisions; repeated whole-scene generation; agent services in the exported game.

Bounded spikes: custom timeline versus editor-only MIT timeline component; final Canvas/LittleJS host; Agent SDK versus a small Client SDK loop within the API adapter; optional image/voice providers and exact codecs. Pick and pin versions with measured fixtures. Provider authentication/terms must be checked at distribution time; credentials and selection stay outside portable source regardless of that choice.

Largest risks are cross-style art/animation compatibility, false instant-conversion promises, incremental dependency correctness, indirect lock violations, audiovisual timing, candidate concurrency and content-size inflation. R0–R3 prove the underlying contracts before the polished UI; R6 makes the actual three-style/weather promise measurable.

## 11. Final revision and asset-pack implementation amendment

The latest `Design system and delivery plan (1).zip` is the accepted visual reference. Its warm shell, shared Direct/Edit/Assets document, scoped Direction/Inspect/Changes dock, layered set inspector, synchronized candidate review and fitting room are retained. The attached HTML is a simulated prototype. Local preview rendering must not depend on a model provider; no fabricated connected states, prices, completed frames or installation receipts ship. See [the build contract](25-director-build-contract.md) for concrete package ownership and integration APIs.

### Packs, including fighter and external sprite packs

Introduce Pack → Family → Appearance variant → Clip/frame/media, with stable namespaced identities. A pack contains related assets; it does not guarantee a compatible whole-scene look. Keep its source URL, author, license per entry where necessary, source revision, original file membership and import adapter version. Normalize frames, trim/pivot, rotation, facing, durations, actions and sockets. Pack names and metadata are untrusted content. A fighter pack's attack/hit/block/jump frames may be used for cinematic actions; importing them never adds hitboxes, damage, combat rules or new game behavior.

Assets gains a Packs view and pack detail panel: preview entries, search/filter characters/sets/props, select assets to import, map actions in batches with per-entry overrides, validate in the fitting room, inspect provenance and see scene usage. Importing a pack need not place anything on the stage. The user chooses which family is bound to a role. A mapping suggestion (run → walk) stays a suggestion until confirmed. Existing sprites are preferred over regeneration.

Store normalized immutable pack revisions and media separately from scene placement/overrides. Collision handling remaps the entire selected closure or reuses an identical record; never replace an unrelated same-name asset. Updates show added/changed/removed capabilities and create a new version; current scenes stay pinned. Removing a source pack cannot delete referenced pinned content. Export only used variants and transitive media, with license notices, never unrelated fighters/source archives. A saved old appearance remains reusable without generating it again.

First adapters: framework JSON scene/asset packs; PNG or PNG+Aseprite JSON with explicit mapping. External ZIP ingestion must bound entry count, decompressed and per-file bytes, compression ratio and paths; reject traversal/symlinks and executables. Unknown proprietary formats get a manifest/mapping workflow rather than a universal-import claim. Native Aseprite, PSD, Unity and arbitrary executable pack formats are deferred adapters.

### Implementation order and honest release boundary

Commit canonical contract/package foundation first. Parallel workers own core, editor, and runtime/I/O; the integrator owns companion, app/tool integration and end-to-end validation. Shared TypeScript contracts precede implementation; no parallel incompatible scene formats. Build a functional vertical slice with manual authoring, candidate merge, layered preview, imported packs, persistent drafts, native Claude/API companion routes and offline scene output. The broader R0–R8 gates remain release requirements; the delivery report must explicitly identify any incomplete media-provider, game-adapter, realistic-art or device validation work.
