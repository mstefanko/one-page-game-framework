# Game framework v1 implementation spec

October 19, 2026. **Authoritative v1 plan; M1 is implemented, later milestones remain planned.** Read this file for implementation. The decision record and future RPG/networking plans are optional background, not additional tasks. This replaces the implementation instructions formerly combined in `31-game-framework-v1-plan.md`.

## 1. Outcome and scope

Build small, original, browser-playable games with reusable tested rules, Pocket creative tools and direct scenario-based playtesting. Use **TypeScript + PixiJS 8.22.0**, with pure authoritative simulation and one browser scheduler. Ship one static URL; additionally support a bounded self-contained HTML export.

| Included in v1 | Explicit boundary |
| --- | --- |
| Top-down action | AABB walls/sliding, interaction, bounded projectiles, shove/dash, basic patrol/chase/attack AI |
| Classic platformer | Axis-aligned terrain, coyote/jump buffering, one-way platforms and horizontal moving platforms |
| Local fighter / beat-'em-up | Hit/hurt/push shapes, startup/active/recovery, blocking/stun, knockback, participant hit-stop and simultaneous trades |
| Grid/turn puzzle | Discrete legal commands, occupancy, goals, undo/restart; no physics simulation |
| Small RPG/adventure | Two or more finite maps, dialogue/interaction, simple inventory, health/basic integer stats, quest/progression flags and durable campaign saves |
| Authoring/testing | JSON + trusted pure TS rules, focused inspectors, schema diagnostics, scenarios, replay and a Playtest Lab |

**User-approved exclusions:** physics-driven puzzles are out for now, with no Planck/Rapier dependency or scheduled reintroduction. Full RPG systems remain a long-term product direction; only the compatibility seams in §10 are v1 requirements. Actual networking, competitive rollback, complex cancels/throws/input motions, slopes/loops, rotating platforms, stacks/joints, 3D, massive seamless worlds, dynamic remote plugins and a general visual scripting language are outside v1.

## 2. Immediate milestone: a playable tiny objective

M1 ends with a playable two-room platform/combat microgame: move/jump, one enemy or local opponent, two authored strikes, reach an exit, lose/restart, and inspect/restore a named scenario. Use placeholder original art. This is a useful game loop before an engine/editor platform. M2 replaces the placeholders and adds the complete creative-tool path.

M1 content is **validated JSON parsed into typed immutable definitions**, not a compile/bake pipeline. Use direct imports of implemented mechanics; no behavior registry. Keep a simple rules/build ID and content fingerprint so checkpoints cannot silently run against changed rules. Defer asset compilation, dependency lock/reporting and advanced content digests until integration needs them.

Follow [CONTRIBUTING.md](../CONTRIBUTING.md), package conventions and current git status. No applicable `AGENTS.md` was found during this review; read one only if it exists when implementation starts. Preserve existing tools, unrelated work and the isolated proofs/benchmark. The proof is reference behavior, not a production API. Correct deliberate changes with fixtures rather than editing the proof to hide differences.

## 3. Responsibilities and allowed dependencies

| Boundary | Responsibility | Initial location / exclusions |
| --- | --- | --- |
| `game-project` | Types, bounded codecs, enabled JSON definitions and references | Separate pure/runtime exports from authoring schemas; no Pixi/DOM. Do not repurpose `@onepage/project`, which is the Score schema |
| `game-simulation` | Owned mutable state, inputs, fixed-step rules, observations, snapshots | Pure project types/helpers only; no clocks, storage, network, Pixi or authoring validators |
| `game-runtime` | Single browser scheduler, devices, Pixi view, UI, audio/Director/save adapters | No editor/server imports; no independent gameplay state in display objects |
| `game-tools` | Validation, scenario/replay CLI, build/export, later asset resolution | M1 can use focused scripts instead of a package. Create the package when integration/build work makes it useful |
| `apps/studio` | Later focused content inspectors and Playtest Lab | Consume the same player/services. Its existing scaffold is not a delivered game editor |

Create packages only with runnable code. Plain typed records/arrays plus stable IDs are sufficient; no general ECS or backend-neutral rendering layer. M3 may extract a small internal behavior catalog after two profiles establish a real shared contract. There is one production gameplay renderer.

## 4. Concrete runtime decisions

### State, numbers and time

- Real-time simulation: **60 integer ticks/second**. Grid games apply ordered command transactions; a resting board does not need simulation ticks.
- `step(world, frame)` mutates a world exclusively owned by its runner and returns tick events. Do not clone the entire world each tick. `observe(world)` produces a detached/read-only presentation value; prior observations must survive the next step unchanged. Snapshots use the codec, never a shallow copy.
- Position/velocity units: **1/256 logical pixel**, represented by safe JS integers. Authoring converts values to these units once. Normalize negative zero; reject NaN, infinity, fractions in integer fields and unsafe integers.
- One active map: coordinates/bounds in `[0, 65,536]` pixels; transient motion below/above bounds must remain within `abs(position) <= 2^24` fixed units or trigger a declared respawn/error before commit. The numeric limit is not a promise to load a map that large. Content-size caps below still apply.
- Movement cap per tick: actors 32 px, moving platforms 4 px, projectiles 128 px. Validate configured maximum velocity/displacement and each computed result. A projectile uses swept contact; high speed is never permission to tunnel.
- No bitwise operations or `Math.imul` on coordinates. Division for motion/scaling truncates toward zero; tile indexing floors; collision clamps to exact integer boundaries. Document other rounding in named helpers. Bounded coordinate differences and squared-distance sums must remain below `2^53`; validate compound arithmetic separately rather than assuming one world-size cap proves all formulas safe.
- Seeded uint32 RNG state is serialized; bitwise operations are allowed only in its reviewed helper and non-authoritative hashing. Separate RNG streams for rules and cosmetics. A future-facing state counter uses a safe integer and fails explicitly before overflow; no wrap/reuse of entity IDs.
- M1 needs no trig. When aimed steering/projectiles arrive, use a committed **256-direction integer lookup** (scale 65,536), stable tie-breaking and integer scaling. Do not generate it with runtime trigonometry. Prefer squared-distance comparisons. If a length is necessary, put `Math.sqrt` plus explicit final quantization in one tested helper.

Basic Number arithmetic is specified; fixed point is chosen for explicit quantization, bounds and canonical state, not because all JavaScript floating point varies across browsers. Transcendental approximations are a distinct concern. Verify the supported builds through replay fixtures. [ECMAScript math specification](https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-math.sqrt).

### Collision and combat

Static tile collision is a finite row-major array (`0=empty, 1=solid, 2=one-way`) with a declared 16 px default tile size. Permit 8/16/32 px sizes per level. Decorative tile layers are separate. Also allow authored static AABBs indexed in the same spatial buckets for non-grid walls; do not force future RPG objects into tile-sized geometry. Moving platforms use a bounded independent list.

M1 limits: at most 1,048,576 collision cells, 1,024 indexed static rectangles, 32 moving platforms, 256 actors and 256 projectiles per active map. These are validation ceilings, not performance claims. Query only cells/buckets intersecting the swept AABB; deduplicate candidate IDs and sort ties stably. Resolve X then Y; for equal-distance contacts use collider ID order. A one-way surface blocks downward crossing from above, not ascent. Test fractional fixed-point positions, exact edge contacts, corners and terrain seams. Do not scan all terrain at each pixel of displacement.

Horizontal platforms validate swept paths and static rider clearance. At runtime propose platform/carry movement before committing. If carrying would embed a rider, retain the previous platform/carry poses, record `blocked`, do not advance path phase and retry once next tick. Support dismount/resume with stable rider order. This bounded check is not a universal reachability proof for custom rules. No crush damage, vertical platforms, drop-through or arbitrary platform rotation in the initial profile.

Combat gathers eligible contacts before applying outcomes, so symmetric attacks can trade. Unguarded damage interrupts the victim's active execution after contact gathering; a stunned actor cannot initiate new attacks. Guarded contacts retain their own freeze/knockback policy. Body, push, hurt and hit shapes are distinct. Each execution ID records already-hit targets; active frames do not repeatedly damage a target unless the ability explicitly declares a bounded multi-hit policy. Art dimensions never determine reach or collision.

Default controller tuning remains content: coyote and jump/attack buffers **6 ticks**; first strike startup/active/recovery **6/4/14 ticks**; hit-stop **4 ticks**. A second strike changes these values through JSON. Damage, speeds and sizes are level/archetype/ability data.

**Hit-stop freezes participants**, not the whole world. Store per-actor `freezeTicks`; the global tick and other actors/projectiles continue. Freeze participant AI, self-driven motion, ability/stun timers and buffer expiration; accept new input edges into bounded buffers. Kinematic carry/separation still keeps frozen bodies out of terrain. Do not initiate new contacts from a frozen attack; its execution hit ledger persists. The hit tick completes gather/apply, then the following N ticks freeze participants. A separate global-freeze mode is deferred until a real fighter needs it.

Tick order: consume actions/commands → update buffers/AI for eligible actors → propose platforms/carry → advance eligible abilities and movement → gather contacts → resolve trades/damage/deaths/objectives → commit flow commands → emit observations/events. Name and test ordering changes. No timers/callbacks outside state may influence a later outcome.

### Inputs, replays and discontinuities

Device input maps to semantic actions, not physical keys in the core. Axes use integers `[-127,127]`; default dead zone is 16 quantized units. Opposing digital directions resolve neutral. Record quantized aim/world target before simulation; cosmetic camera shake does not alter it.

Poll `navigator.getGamepads()` once per RAF **before** fixed steps. Queue device changes until a tick consumes them; held state persists across catch-up steps, but edges occur once. If a RAF has no step, retain the edges. Handle evented keyboard/pointer/touch through the same queue. Missing/disconnected pads, blur, lost capture, pause and visibility/orientation changes generate **cancel**, never release-to-fire. Multiple pointer IDs are independent. [Gamepad polling](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API).

Replay encoding is change-only **for persistent values**, with explicit ordered transient edges:

```ts
{ tick, slot, sequence, heldPatch: { attack: true }, axesPatch: { moveX: 127 },
  edges: [{ action: 'attack', kind: 'pressed' }] }
```

Omitted held/axis values persist; edges never persist. Same-tick press/release/cancel remain ordered, including a tap that begins and ends between steps. Validate agreement between transitions and resulting held state. A decoder creates complete frames; scenarios and device input use that same core path. Limit each slot to 32 transitions per tick, 4 player slots in v1 (M1 exercises 2), and cap imported replay logs at 16 MiB UTF-8 / 200,000 records; live input overflow cancels controls with a diagnostic rather than dropping a release. Grid logs use turn revision plus ordered command sequence. A complete starting checkpoint includes decoder held/axis state.

Observation includes an actor `motionEpoch`, incremented on teleport/respawn, plus a host `viewEpoch` incremented on restore/scene load. Interpolate only when entity identity and both epochs match. The view epoch is presentation state outside canonical simulation; restoring a checkpoint must not alter its authoritative bytes just to reset interpolation. Remove the proof's distance-threshold teleport heuristic.

### Snapshots and validation

Canonical JSON encodes explicit ordered keys, stable entity ordering and integer numeric fields. Include timers, buffers, input state, contacts/rider state, RNG, AI, active execution/hit ledgers, ID counters, pending commands, flow and campaign state that affect future outcomes. Exclude textures, voices, callbacks and host clocks. Validate into a new world and replace atomically; failed restore leaves the old world intact.

Each checkpoint/replay carries `snapshotVersion`, `gameId`, `rulesBuildId`, `contentId` and initial player/scenario identity. M1 content identity is SHA-256 of canonical validated gameplay definitions, computed once outside the simulation; rulesBuildId is a versioned SHA-256 of the reviewed runtime-source closure (repository-relative paths, source bytes and protocol/target), not a compiler-output proxy or editable version string. Restore requires exact rules-source and content identities. Separately, each production build emits an artifact manifest hashing the actual emitted files and recording compiler provenance. Archive that manifest and build for replay; source compatibility alone does not prove compiler equivalence, so supported toolchains must pass full-byte replay. This explicit policy replaces the original exact-build wording after M1 review; see docs/36-m1-review-resolution.md. Full asset resolution remains M2 work.

Compare **complete canonical bytes** at test checkpoints and report the first differing component path. The proof's FNV32 may remain a diagnostic fast signal; neither it nor a new 53-bit hash decides correctness. SHA-256 artifact fingerprints may be computed asynchronously by tools/host outside stepping. Do not add a custom hash algorithm merely to avoid comparing state.

Player snapshot/campaign codecs are bounded, CSP-safe hand-written validators with schema-parity tests. TypeBox/JSON Schema validation lives in authoring/tool exports. No runtime `TypeCompiler`, Ajv compilation, `eval` or `new Function` in the player. Alternatively, a future build can ship generated static validators after equivalence tests. Limit imported save/checkpoint JSON to 2 MiB UTF-8, nesting depth 32 and schema-specific collection caps before expensive processing. Reject unknown fields/versions and malformed references; content caps are separate from binary media sizes.

### Enforcing purity

Add `scripts/check-sim-purity.mjs`; wire it into `npm run check` and CI, and a focused staged-code pre-commit check. The repo currently has no linter. Use an esbuild metafile for dependency allow-lists, plus esbuild TS transformation and a small pinned JS AST parser for prohibited syntax/globals. A regex or metafile alone is insufficient. [esbuild metadata](https://esbuild.github.io/api/#metafile).

Inspect every simulation/helper module before tree-shaking. Reject runtime imports outside the pure allow-list, dynamic import, async/await/Promise, browser/Node globals, clocks/timers, Math.random, crypto, eval/Function and runtime transcendental math. Allow only declared Math members; reject computed/aliased Math access that evades the rule. Include fixtures for direct, bracket, destructured and helper-import escapes, comments/strings and allowed RNG operations. `sqrt` is confined to its named quantizing helper. Use type-only project imports or pure value exports. Run a DOM-free Node import test. This is a regression guard for trusted code, not a sandbox for adversarial plugins.

## 5. Presentation, tiles and lifecycle

Default per-game profile: **320×180 logical pixels**, pixel art, renderer resolution 1, antialias off, nearest texture filtering and integer CSS upscaling with letterboxing. A game may explicitly choose 256×176 or another viewport. Snap final camera-relative sprite positions to logical pixels; never round authoritative bodies. If the available viewport is smaller than the logical size, use a documented nearest-filtered fractional fit and show the scale in the lab. Do not silently crop or claim integer scaling is possible at every screen size. Smooth art is a separate manifest profile with DPR capped at 2. [Pixi texture settings](https://pixijs.com/8.x/guides/components/textures).

Start with visible atlas sprites for tiles. For dense static layers, cache only visible chunks plus one margin ring, **16×16 tiles/chunk**, at resolution 1. Limit chunk dimensions to 512×512 and the resident static tile cache to **32 MiB of RGBA storage**; evict non-visible chunks and draw uncached visible sprites if necessary. Never bake a whole large map into one texture. Animated tiles/actors stay separate. Use pinned Pixi `cacheAsTexture`/render texture APIs, invalidate edited chunks and dispose on scene exit/context recovery. Add seam/filtering/resource fixtures. No tilemap dependency in M1; compare one later if measured authoring/rendering needs justify it. Caching is an optimization, not a first-playable blocker. [Pixi caching and memory tradeoff](https://pixijs.com/8.x/guides/components/scene-objects/container/cache-as-texture).

Use a static or follow-and-clamp camera, stable depth tie-breaks and simple fades. Shake/particles are bounded cosmetic recipes with separate RNG. Animation samples semantic action/facing clips from observations; it cannot decide damage or flow completion. Teleport/restore resets interpolation and reconstructs the view, suppressing old effects.

Menus, pause/settings, dialogue choices, help and touch controls use accessible DOM. In-play pixel HUD uses Pixi `BitmapText` with an original/licensed bundled bitmap font; supply a DOM status mirror, announcing important changes at most twice per second, not every frame. Maintain keyboard focus and readable text/contrast, and test the letterboxed layout. [BitmapText](https://pixijs.com/8.x/guides/components/scene-objects/text/bitmap).

The host owns one RAF accumulator; stop Pixi's ticker. Allow at most **5 catch-up steps per RAF**. If debt exceeds that bound, pause, clear held input/debt, show a resume indication and preserve the last committed tick. Never skip unrecorded gameplay ticks. Offline replay advances explicit ticks without RAF. Hide/blur pauses local play; resume cannot fire an old charged action.

Mount: validate → load resources → create world/view/input → signal ready → schedule. Use generation tokens/abort handling so late loads cannot attach to a disposed session. Unmount: stop scheduling, reject commands, cancel controls/capture, detach listeners, stop audio/cinematics, cancel loads, release owned resources and UI. Mount/unmount/dispose are idempotent. Twenty scene restarts and late-promise tests are release gates; resource counters alone are not memory-leak measurements.

## 6. Documents, flow and creative integrations

M1 uses `game.project.json`, level, archetype, ability and scenario JSON plus trusted pure TS mechanics. Stable document IDs survive file renames; paths stay contained in the project. Manifest fields include schema version, unique game ID, viewport/profile, initial level/scenario, rules identity and referenced document IDs. A fresh cloned game gets a new game ID. Unknown document kinds fail; do not scaffold schemas for future systems.

Level owns collision/spawns/triggers/platform paths; archetype owns controller/body/base stats/abilities; ability owns guards, phases, teams, damage/hit policy and feedback IDs. Appearance and art anchors cannot modify gameplay geometry. M1 uses direct module IDs for supported rules. M3's catalog adds schema/defaults/profile compatibility/state codec/phase/fixtures only for implemented behaviors.

M2 adds a minimal flow document:

```ts
{ entry: 'title', nodes: {
    title: { kind: 'title' }, room: { kind: 'play', levelId: 'room' },
    scene: { kind: 'cinematic', sceneId: 'exit-scene' }, result: { kind: 'result' }
  }, edges: [
    { from: 'title', outcome: 'start', to: 'room' },
    { from: 'room', outcome: 'goal', to: 'scene' },
    { from: 'scene', outcome: 'complete', to: 'result' },
    { from: 'scene', outcome: 'skip', to: 'result' },
    { from: 'result', outcome: 'restart', to: 'room' }
  ] }
```

Outcomes are declared enums validated per node, with one deterministic edge for each supported outcome. Define lose/retry/cancel behavior too. Pause is a host overlay, not a second running gameplay scene. No executable expressions in JSON. Grid logic resolves before its visual tween. Host actions and simulation outcomes use validated commands with idempotent transition tokens.

**Assets:** reuse families/variants/actions/directions/frames and pinned installations; resolve capabilities, frame timing, facing/mirroring, trim and socket anchors centrally. Gameplay anchors remain independent of art anchors. Reject missing capabilities with diagnostics. Begin asset baking/resolution only in M2; the build must contain its dependencies and need no personal library. Do not replace Assets/Director's explicit conversion boundary. Assets prerequisite APIs are documented in `packages/assets-core/README.md` and `packages/assets-io/README.md` when that separately reviewed work is committed; they are not included in the isolated M1 delivery.

**Score:** reuse `AudioEngine`, with one audio coordinator for music/SFX/dialogue buses, energy changes, mute and ownership. Unlock on a real gesture; errors are visible. Musical PPQ=480, game/scene ticks=60 Hz and audio seconds are different units. Restore/seek resynchronizes transport and suppresses old SFX; do not overlap editor audition and runtime music. Listen to the emitted game as well as checking events. [Audio backend](../packages/music-web-audio/src/index.ts), [preview ownership](../packages/music-editor/src/preview-bridge.ts).

**Director:** full-screen Canvas cinematic first, with gameplay paused and input canceled. Drive its controller from the host's cinematic clock, bind appearance/media, deduplicate complete/skip per active slot, and dispose before restoring control. Scene preview seek does not commit outcomes. Cinematics cannot silently move bodies; only a declared outcome changes spawn/progression. [Director runtime](../packages/director-runtime/src/index.ts).

Do not create exact checkpoints during an active cinematic in v1; save before/after the slot. Record entry and complete/skip as ordered host commands with slot instance/flow epoch, host sequence, gameplay tick, cinematic tick and outcome token. Node replay processes those same commands without rendering, including timing while gameplay is frozen. Test duplicate callbacks, skip and restore-before-entry. Campaign saves use stable authored checkpoints. Mid-scene saves or in-world root motion require a later explicit state/ownership design.

## 7. Agent loop and playtest tools

M1 scripts provide validate, scenario-run and replay-verify; `gamekit` is the eventual command name, not an existing command. All diagnostics use `{code,severity,file,jsonPointer,message,repair}` and stable exit codes. Named scenarios contain a seed or compatible checkpoint, player slots, bounded actions and assertions.

Add dev middleware/watch validation: debounce JSON edits **150 ms**, validate the changed file and dependent references, publish file/JSON-pointer errors in overlay/console, and retain the last valid runnable state. A partial invalid write never destroys the running scene. A valid rules/collision edit restarts the named scenario and explains why; an opt-in compatible art swap releases old resources. File/UI writes use revision checks and atomic updates; no overwriting dirty concurrent edits. M1 can restart the scenario on all valid edits; fine-grained art hot reload is later.

M4 lab capabilities: load named scenario, pause/reset, one-tick step, observe, hitbox/contact overlay, checkpoint, record/replay and seek. Seek restores a checkpoint and replays actions with effects suppressed; do not implement test-only coordinate cheats. Bridge messages have exact origin/session and capabilities, and exist only in development builds. Production must lack them even with `?benchmark`/debug query strings.

Bug report: exact build/content identities, seed/initial checkpoint, ordered inputs including cancellation, checkpoint bytes/hashes, first divergence path, environment/frame schedule, console errors, screenshot at logical resolution and optional clip/tick-stamped notes. Bound artifacts and omit credentials. Expected snapshots change only after a reviewed behavior change.

Agent loop: inspect available schema/behavior → edit minimal content/rules → validate → focused scenario → real visual playtest → regression/replay/export checks → evidence note. From M1, record shared-core lines changed and why new content needed each change; this is architectural feedback, not a target to game by compressing code.

## 8. Milestones and exit evidence

| Gate | Build | Exit |
| --- | --- | --- |
| **M1: tiny playable slice** | Validated JSON, mutable pure platform/combat core, local host, simple enemy/goal/restart, second room/strike as data; minimal scenario scripts/dev validation | Actually playable; second room/strike need no host/input/codec changes; purity/import checks; restore during jump/attack/freeze/carry; 10,000-tick Node/Chromium/Firefox/WebKit exact fixtures for implemented mechanics; real input cancel; logical-resolution screenshots |
| **M2: one short complete game** | One level, one enemy type, two moves, short Director slot, title/result/restart; Assets skin/socket swap; Score two energy levels; bounded asset build integration | Production build uses same core; skins leave gameplay identical; audio ownership/listening; complete/skip once; human playtest passes before widening |
| **M3: reuse and RPG seam** | Distinct top-down arena, grid puzzle, local duel fixture, and small adventure with two maps/dialogue/item/quest/save | Common host/input/creative plumbing reused; no edits to existing scheduler/collision/codec infrastructure merely to add content. New profile modules with codecs/fixtures are expected. Adventure quest/item/map identity survives save/return/load; see §10 |
| **M4: agent tooling** | Schema/catalog/inspect/build/export tools, Playtest Lab and focused inspectors; optional finite orthogonal Tiled importer | Another agent reproduces/fixes a supplied bug from its artifact; revision conflicts and diagnostics work; bridge excluded from production; unsupported import cases fail clearly |
| **M5: export/save/mobile** | Static subpath URL, tiny offline HTML, campaign migrations, storage fallbacks, touch/browser/resource hardening | Budgets below; no-network HTML; corrupt/old save recovery; physical devices; 20 restarts and memory evidence |
| **M6: release** | Versioned editable templates and documented profile limits | Two distinct complete games, including the M2 game and an adventure or other complete profile, ship without changes to existing shared mechanisms; all hard release gates have evidence |

Keep M2's content box fixed; if work grows, remove optional content before adding systems. Human playtest: at least two people other than the implementer each complete the short loop unaided, attempt retry/skip, and assess movement/combat readability, audio and controls. Record observations, not just a rating; fix blocking controls/comprehension defects. If people are unavailable, report that gate pending and do not call feel validated or automatically expand to M3.

Fixtures as mechanics arrive: wall/corner/ground ties, one-way ascent/landing, moving/blocked rider/dismount, coyote/buffer boundary, freeze with unrelated actors/projectiles, rapid press/release/cancel, simultaneous hits/trades/guard, multi-tick hit dedup, death/goal priority, respawn epochs, save during active mechanics, skin/socket/mirroring, cinematic skip/re-entry, audio restore, grid undo, adventure cross-map quest/save migration, and in-process delayed-input resimulation. Test different display schedules with the same action log.

CI currently installs only Chromium. Add a separate game-runtime job as M1 lands: install pinned Playwright **Chromium, Firefox and WebKit with system dependencies**, run purity/schema/core and built-player scenarios, and upload evidence on failure. Update CONTRIBUTING's game-specific commands. Preserve the existing creative-tool checks. Do not rely on unsupported linter/compiler combinations; the purity script is standalone.

Verification should be performed independently of the implementation when another agent/reviewer is available; otherwise rerun a separate verification pass and disclose that the same agent did both. Include a headed visual check. Browser emulation does not substitute for physical phones or human playtests.

## 9. Fixed release targets and persistence

The following are **engineering acceptance targets in this revised plan**, not measured achievements. Record any later change as an explicit scope/target decision before testing; do not quietly lower a gate after a failure.

| Budget | Measurement |
| --- | --- |
| Runtime JS ≤250 KiB gzip | Sum all emitted runtime JS chunks, excluding media/content and development hooks; include renderer/audio/Director code required by the chosen build |
| Tiny single HTML ≤2 MiB raw | Complete emitted file including its media/font, load with network disabled; separate larger static-URL target |
| Phone input-ready ≤2 s | Median of 5 cold-cache navigations, measured navigation to controls/first render-ready on physical iPhone 12 Safari and Pixel 6a Chrome (or record agreed comparable baseline before measuring), controlled 10 Mbps down/1 Mbps up/50 ms RTT |
| Phone normal update+render-submit p95 ≤12 ms | 40 actors/20 projectiles; 10 s warmup + 60 s samples; report RAF drops, long tasks and heat behavior separately. Submission is not GPU completion |
| Node step p95 ≤1 ms normal, ≤4 ms stress | 40 actors/20 projectiles and 100/100 stress; Apple M4, pinned Node version, 2,000 warmup +10,000 measured ticks, 5 isolated runs; no rendering or checkpoint encoding inside the step timer |
| Static tile cache ≤32 MiB | Account resident RGBA chunks; also report atlas/total texture usage and measured browser memory separately |

M1 measures its actual small fixture and captures an initial baseline; the 40/20 and 100/100 gates activate once those mechanics exist in M2/M3. An uncalibrated CI VM reports timing trends, not pass/fail against M4 milliseconds. A designated reference machine runs the absolute performance gate; correctness remains mandatory in shared CI. Physical-phone availability is a release evidence requirement, not a reason to fabricate a pass.

Phone QA includes safe areas, two simultaneous touches, orientation, audio unlock/resume, background/foreground, canceled holds, GPU context recovery, readable HUD and actual thumb comfort. Static builds work under a repository subpath. Self-contained export bundles verified bytes and notices, needs no personal library, contains no React/editor/service/schema compiler/test hooks, and is tested without `unsafe-eval` (use appropriate static script hashes for inline CSP). Record direct-file browser limits. PWA/cache-update and Capacitor/native-store delivery are separate later projects.

Keep three formats distinct:

- **Campaign save:** stable game/character/map/checkpoint/item/quest IDs, persistent progression and settings, schema version, compatible rules/content range. Pure migrations with fixtures, backup and rollback-on-failure; preserve unsupported originals for export. Prefer authored checkpoints over transient entity positions.
- **Exact checkpoint:** all future-affecting active state with exact reviewed rules-source/content identity and separately archived emitted-build identity; reject mismatch before mutation. Campaign migration does not make a running attack checkpoint compatible.
- **Replay:** compatible initial state plus semantic action/host-command log and checkpoints. Retain the old build for archival replay; no silent rules migration.

Namespace storage by game ID/save kind/version. Handle denied/quota/private storage with visible in-memory play and import/export. Storage failure never crashes play. Local saves are not authoritative online rewards. On map changes, apply persistent outcomes and load the new map as one logical transition; on load failure retain the previous committed campaign/checkpoint and show retry.

## 10. Required seams for larger RPGs

Implement these small rules in v1; the detailed future RPG roadmap is not a prerequisite read:

1. Separate immutable definitions, durable campaign state and active-map simulation. Never make the lifetime of a spawned actor the lifetime of a character, item or quest.
2. Stable definition IDs and durable instance IDs are distinct. Map ID + authored placement ID identifies persistent pickups/doors/NPC changes. Runtime entity IDs are local execution identity.
3. Interaction/dialogue/quest actions are validated typed commands producing transactional outcomes. Grant an item and advance its quest together with an execution token; retries/restores cannot duplicate rewards. Do not evaluate JSON strings as code.
4. A minimal inventory has item-definition IDs, quantities and unique IDs for non-stackable items; defaults of 100 inventory slots and 999 units per stack, with lower per-item limits allowed; validate all capacities before commit. Progression uses declared flags/basic integer stats, not a bag of arbitrary undocumented fields. Settings and art remain independent of gameplay stats.
5. Movement profile does not select the combat model. Grid turns, real-time abilities and exploration are internal modules sharing identity/commands/state contracts, not one universal tick-dependent combat script. V1 need not implement party/tactical combat.
6. Multiple finite maps transition at authored entrances/checkpoints; serialize durable deltas, not every unloaded NPC's live timers. Numeric/active-entity bounds apply per loaded map, not to the lifetime size of a campaign.
7. M3 demonstrates two maps, one persistent pickup, branching dialogue condition and a quest reward; save/load/return and rename-with-stable-ID fixtures preserve state. Reject duplicate reward and missing-definition imports. This proves the seam without implementing equipment, crafting, skill trees or world streaming.

## 11. New-session instruction

> Implement M1 only from `docs/32-v1-spec.md` in `/Users/mstefanko/Documents/New project/one-page-game-framework`. Read CONTRIBUTING and current repository instructions/status; preserve unrelated tools and both isolated experiments. Produce the tiny playable platform/combat objective using validated JSON, pure mutable state, bounded indexed collision, participant hit-stop, semantic input/replay and a minimal pixel-art Pixi host. Add the second room/strike as data, focused dev validation, Node scenario/replay tools and exact 10,000-tick browser fixtures for the implemented mechanics. Create packages only with useful code. Do not build asset baking, registries, networking, full RPG systems, competitive fighters or broad editors in M1. Report screenshots, checks, shared-core changes and remaining gates. If new evidence materially changes the renderer recommendation, stop and explain before switching.
