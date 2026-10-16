# Research: a studio for one-file JavaScript games

**Decision record, October 16, 2026.** This is the authoritative research synthesis. The companion [architecture and implementation plan](02-framework-plan.md) contains the proposed contracts, milestones, and the source-linked Terminator anatomy. No framework or editor described here has been implemented.

Reference: [play Terminator: Liquid Metal](https://mstefanko.github.io/terminator-game/) · [pinned source](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html).

Follow-on decisions: [repository and reusable assets](03-repository-and-asset-strategy.md) and [standalone composer research/design](04-chiptune-composer-plan.md). The latter verifies MIDI/BeepBox and export candidates in more detail and advances a composer-first track without removing the framework's validation gates. Workspace scaffolding is now present; product implementations remain future work.

## 1. Conclusion and evidence scope

Build a project format, a small runtime, a local authoring server with browser editors, and a compiler that exports one HTML file per game. Use existing libraries for schemas, undo, bundling, and narrowly defined runtime facilities. Share rendering, music playback, animation evaluation, and validation between tools and games. Agents and people must edit the same source folder.

Existing products cover substantial parts of this idea. The distinctive requirement is the combination of agent-editable documents, interchangeable sprite contracts, adaptive score authoring, game-actor cutscene direction, and recoverable single-file publication. The research does **not** establish that no existing product can do this; it supports a focused integration strategy for this workflow.

This synthesis reviewed the earlier anatomy, plan, tool survey, and both supplied reports, and rechecked material disputed claims against primary documentation, repository code, compatibility data, and license text. The earlier “47 claims / none wrong” tally is not an independently reproduced result and is not adopted here. Several summaries needed correction. All original documents and reports remain in the [dated archive](../archive/README.md).

Verified upstream facts, design decisions, and future acceptance tests are different kinds of evidence. No engine benchmark, physical-device audio test, new visual comparison, or framework implementation was performed for this consolidation. Package versions and installed license notices must be pinned and checked when implementation begins.

## 2. What to adopt from existing systems

| Layer | Reference and useful pattern | Decision |
| --- | --- | --- |
| Small runtime | [LittleJS](https://github.com/KilledByAPixel/LittleJS): input, rendering, collision, sound, lifecycle, and authoring facilities | Compare a narrow integration against our small Canvas baseline before selecting one backend. Current upstream also advertises built-in level editors; do not characterize it as runtime-only. |
| Larger engine | [Phaser scenes](https://docs.phaser.io/phaser/concepts/scenes), [Excalibur graphics](https://excaliburjs.com/docs/graphics/) and [animation](https://excaliburjs.com/docs/animation/) | Borrow explicit lifecycle and appearance separation. Reconsider adoption if subsequent games need broader engine services. Do not infer delivered bundle size from package size. |
| Full authoring product | [ct.js](https://github.com/ct-js/ct-js), [GDevelop](https://github.com/4ian/GDevelop) | Useful alternatives if adopting another product's content/workflow is acceptable. Building our own studio is a workflow choice, not proof these tools lack game editors. |
| Project/level data | [LDtk JSON overview](https://ldtk.io/docs/game-dev/json-overview/), [Tiled templates](https://doc.mapeditor.org/en/stable/manual/using-templates/) | Stable definitions, instances, identifiers, typed properties, explicit layers. Own canonical level document and editor; import these formats with loss reports. |
| Sprite interchange | [Aseprite CLI](https://www.aseprite.org/docs/cli/), [slice metadata](https://aseprite.com/docs/slices/) | Import exported art and metadata; normalize to semantic clips and per-frame sockets. Do not embed the editor's source. |
| Re-editable publication | [Bitsy save/import](https://make.bitsy.org/docs/tools/game/save/), [Twine HTML output specification](https://github.com/iftechfoundation/twine-specs/blob/master/twine-2-htmloutput-spec.md) | Published games can preserve editable data. Our inert JSON payload is our design; Twine uses its own story elements, not this JSON schema. |
| Musical authoring | [BeepBox](https://github.com/johnnesky/beepbox), [Tone.js](https://github.com/Tonejs/Tone.js) | Study pattern/arrangement UI and transport behavior. Keep one custom score and one shared playback backend initially. |
| Short sound effects | [ZzFX](https://github.com/KilledByAPixel/ZzFX), [jsfxr](https://github.com/chr15m/jsfxr) | Use established parameter recipes and a preset/parameter audition panel. Avoid inventing a new general SFX synthesizer/editor. |
| Timeline authoring | [Motion Canvas](https://github.com/motion-canvas/motion-canvas), [flow primitives](https://motioncanvas.io/docs/flow/) | Study sequencing, parallel motion, playback, and inspection. Build a smaller JSON timeline evaluator/editor; Motion Canvas's generator programs are not a drop-in declarative scene format. |
| Schema and commands | [TypeBox](https://github.com/sinclairzx81/typebox), [Ajv](https://ajv.js.org/guide/typescript.html), [Immer patches](https://immerjs.github.io/immer/patches/) | TypeBox as schema/type authority, Ajv at document boundaries, Immer for local undo transactions. |
| Build | [esbuild](https://esbuild.github.io/api/), [vite-plugin-singlefile](https://github.com/richardtallent/vite-plugin-singlefile) | Thin esbuild + HTML compiler by default; Vite plugin is a credible fallback. |

The prototype comparison in the plan is required. LittleJS's current advertised feature set is broader than the older draft described. That makes it worth evaluating, but does not establish compatibility with our headless deterministic simulation or project documents. Keep the comparison small and publish measured results before committing.

## 3. Storage, agent editing, undo, and migrations

**Accept the local-server workflow.** `gamekit studio <folder>` should serve the studio and read/write that folder through a local API. The CLI and editor use the same command/validation packages. Filesystem watching and revision-checked writes prevent an agent and a human from silently overwriting each other. Browser-private autosave alone would leave agents editing a different copy of the project.

The browser folder picker is an optional enhancement, not a portable foundation. MDN marks [showDirectoryPicker](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker) as limited availability. The Safari statement needs precision: compatibility data lists Safari 26 for `FileSystemFileHandle.createWritable`, but earlier Safari support for worker-based `createSyncAccessHandle`. “Safari could not write files before 26” is too broad. [MDN compatibility source](https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/FileSystemFileHandle.json).

For a hosted demo, use [OPFS](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system) with feature detection and an IndexedDB fallback, folder upload as an import snapshot, and ZIP import/export. OPFS is browser-private storage, not the user's normal project directory. Quotas, eviction, and permissions still require visible save/recovery state. Folder upload does not grant continuing write access to the uploaded folder.

**Accept Immer undo.** Enable its patches facility, retain forward/inverse patches per editing transaction, and track the base revision. A drag is one undo step. Patches are not collaborative merge semantics; external file changes need conflict handling and an explicit history reset or rebase. Immer's array paths also should not be mislabeled as ordinary JSON Patch without conversion. [Immer documentation](https://immerjs.github.io/immer/patches/).

**Accept TypeBox.** Its checked-in [license text](https://raw.githubusercontent.com/sinclairzx81/typebox/master/license) explicitly grants the MIT license; an automated GitHub “unrecognized” classification is not a contrary license. Use TypeBox to generate JSON Schema and infer TS types. Hand-write version-to-version migrations with fixtures and backup/dry-run support. Versioned formats such as [LDtk](https://ldtk.io/docs/game-dev/loading/) and [Godot's scene format](https://docs.godotengine.org/en/4.6/engine_details/file_formats/tscn.html) are references for version-aware loading, not evidence that automatic migration generation would solve our semantic changes.

## 4. Export and recoverable source

**Accept JSON source embedding by default, with an important limit.** Include versioned authored JSON in an inert `application/json` script element. Reuse the same embedded binary asset table for runtime and recovery. `gamekit import game.html` should recover those documents/assets without running the game.

This recovers project **data**, not arbitrary original TypeScript. A game using only pinned built-in behaviors can be rebuilt from its recovered data and the matching toolchain. A game containing custom code must additionally retain its source repository/ZIP; a bundled/minified script cannot reliably reconstruct original modules, comments, or dependencies. Include a recovery manifest listing missing source modules. JSON size is not always negligible, so measure and report it rather than promising that embedding is free.

**Correct the Vite argument.** [vite-plugin-singlefile](https://github.com/richardtallent/vite-plugin-singlefile) is MIT and can inline a Vite application's JS/CSS into HTML. Its documented constraints include a single entry and no automatic inlining of `public/` assets. Vite is not inherently incapable of producing one file. We prefer a thin compiler for explicit reachability, shared binary packing, source recovery, predictable errors, and build reporting. The plugin is an alternative bundling stage, not a replacement for asset validation or network verification.

Either route needs a declared asset graph, handling for runtime-selected IDs, no unresolved imports/chunks, inline fonts/media, license notices, and tests that count attempted requests as well as failures. Loading successfully with requests blocked can conceal an accidentally external optional asset. Export acceptance must exercise title, levels, audio unlock, scenes, and endings, not only the first frame.

## 5. Sprites, sound, and cutscenes

**Accept per-frame sockets.** A hand point changes during walking and attacks. Store sockets in each frame's untrimmed local coordinates; allow declared defaults only as authoring convenience. Validate required sockets across every relevant frame and direction, and mirror them with the art. Keep authoritative collision and projectile origins in gameplay data so a visual skin replacement cannot change combat.

**Keep the custom score, correct the rationale.** BeepBox has JSON serialization and parsing in its [synth source](https://raw.githubusercontent.com/johnnesky/beepbox/main/synth/synth.ts), including `toJsonObject` and `fromJsonObject`. No separately published JSON Schema was established by this review; that is different from “no song format.” We retain our model because it directly expresses the reference game's unusual phrase lengths, cue routing, intensity layers, and chosen instruments. We have not proven that every existing tool lacks these capabilities. Optional BeepBox/MIDI import should report unsupported instruments and timing instead of promising sonic equivalence.

Use **480 musical ticks per quarter note**, with exact representability tested as `480 × a / b` being an integer for a duration of `a/b` quarter notes. Common binary divisions, triplets, and quintuplets fit; septuplets do not. Extremely fine or compound subdivisions may also fail, such as a dotted 128th note (22.5 ticks). Unsupported positions need rejection or an explicit, reported quantization choice. [Tone's transport source](https://raw.githubusercontent.com/Tonejs/Tone.js/dev/Tone/core/clock/Transport.ts) defaults to 192 PPQ; this matters only if integrating Tone. It does not dictate our format.

Use a pinned ZzFX recipe backend initially, with named, validated parameters and audition controls; jsfxr is another reference/import candidate. Recipe version, seed, normalization, and gain belong in the SFX document. The custom music backend and small SFX generator are separate responsibilities. Preview and export must use the same respective backends.

**Accept a purpose-built cutscene timeline.** Theatre's public default-branch [history](https://github.com/theatre-js/theatre/commits/main/) ends in April 2024 at the time checked. Its [repository](https://github.com/theatre-js/theatre) distinguishes Apache-2.0 core from AGPL-3.0 Studio. A README about private next-version work is not evidence of a maintained public release; conversely, default-branch inactivity does not prove all private development stopped. Use Motion Canvas as the main workflow reference and keep our runtime evaluator independent of either editor.

## 6. Mobile, saves, and repeatable simulation

**Accept audio-session and interruption handling, with device testing.** Feature-detect experimental [AudioSession](https://developer.mozilla.org/en-US/docs/Web/API/AudioSession), request `playback` when the user enables sound, and handle audio/context state changes. iOS Safari can put a context into an [interrupted state](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/state). Do not portray the experimental setting as a universal silent-switch fix or an autoplay bypass. Test the switch, backgrounding, calls/headphones, resume, and explicit mute on actual iOS hardware.

**Accept save namespaces.** GitHub Pages project paths on the same account generally share an origin, so path names do not isolate `localStorage`. Use a stable game ID and save version. MDN explicitly describes [file-URL localStorage behavior](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) as undefined; support unavailable storage and offer save download/import rather than promising local-file persistence.

**Accept an enforceable deterministic math profile.** ECMAScript permits implementation-approximated results for numerous [Math functions](https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-math-object). Ban host trig/transcendental functions, unseeded randomness, and wall clocks from authoritative simulation. Use bounded integer/fixed-point operations and tested helpers. Merely replacing `sin` and `cos` is insufficient: normalization, collision order, input quantization, RNG consumption, and content versions also matter. Rendering/audio may use ordinary floating-point math. The reference game is not asserted to already satisfy these stricter rules.

Require DOM-free simulation, state snapshots, tick inputs, and cross-engine state-hash fixtures. Visual screenshot equality and identical synthesized audio bytes are different goals and should not be conflated with gameplay determinism.

## 7. Dependency and license decisions

These are choices for a reusable, permissively distributed framework. They are not a claim that external art made with a GPL tool inherits its code license, nor a prohibition on using those tools independently.

| Candidate | Evidence and decision |
| --- | --- |
| TypeBox | Actual [MIT text](https://raw.githubusercontent.com/sinclairzx81/typebox/master/license) checked. Accept; preserve notice. |
| Immer, esbuild, vite-plugin-singlefile, LittleJS, Motion Canvas | Permissive upstream projects; suitable candidates subject to the exact installed versions and transitive notices. See their linked repositories/docs above. |
| ZzFX / jsfxr | [ZzFX](https://github.com/KilledByAPixel/ZzFX) uses MIT; [jsfxr](https://github.com/chr15m/jsfxr) identifies Unlicense. Prefer one pinned implementation, not two mandatory synth dependencies. |
| tldraw SDK | [Production licensing](https://tldraw.dev/community/license) requires a license key. Do not depend on it for undo/editor infrastructure. |
| Theatre | Core and editor have different licenses. Avoid Studio embedding and the public-maintenance uncertainty. |
| Spine runtimes | [Runtime terms](https://raw.githubusercontent.com/EsotericSoftware/spine-runtimes/4.2/LICENSE) reference an alternative under the [Editor License](https://esotericsoftware.com/spine-editor-license). “Every player must buy Spine” is not a correct blanket summary. Exclude from the default framework because integration/distribution conditions do not fit the intended dependency policy. |
| Aseprite | [Source license](https://github.com/aseprite/aseprite/blob/main/EULA.txt) is not a permissive engine dependency. Import its exported format; external authoring remains useful. |
| LibreSprite / Lospec Pixel Editor | [LibreSprite](https://github.com/LibreSprite/LibreSprite) and this specific [Lospec editor repository](https://github.com/lospec/pixel-editor) carry GPL licensing. Avoid copying/bundling their editor code into the proposed permissive studio. This does not classify every Lospec resource or generated artwork as GPL. |
| GSAP | Its [standard license](https://gsap.com/community/standard-license/) is custom and includes restrictions relevant to visual animation builders. Do not adopt it as the studio timeline dependency merely because commercial use is generally advertised as free. |
| Strudel | [Official project documentation](https://strudel.cc/technical-manual/project-start/) links the project on Codeberg and discusses AGPL obligations. An archived GitHub mirror is not proof the project is abandoned. Exclude as a bundled dependency for licensing/scope, not that incorrect maintenance claim. |

Keep tools used only during development separate from code shipped in games. Include dependency notices in the relevant deliverable, and preserve asset provenance independently. Original framework examples should not redistribute Terminator characters or melodies as generic starter content.

## 8. Remaining review gaps, now assigned decisions

| Gap | Resolution in the architecture plan |
| --- | --- |
| Phase 1 too large | Separate schema/headless core, backend comparison, input/combat, audiovisual slice, and export/recovery gates. Each has fixtures and a runnable artifact. |
| Missing document formats | Add SFX, feedback, tuning, upgrades, fonts, and camera contracts, including units, ownership, and validation. |
| Headless operation | Required from the first simulation milestone; no DOM/Canvas/Audio mocks permitted as a substitute. |
| Live tuning | Revision-checked source transactions and immutable runtime snapshots; classify immediate presentation edits, tick-boundary gameplay changes, and restart-required changes. Record tuning events or invalidate replays. |
| Runtime choice | Equal-workload Canvas/LittleJS experiment with mandatory correctness gates, measured size/performance, and a maintenance-work comparison. No predetermined benchmark winner. |

Testing tools remain appropriate: [Playwright](https://playwright.dev/docs/network) for browser/network behavior; [pixelmatch](https://github.com/mapbox/pixelmatch) for controlled screenshots; [@napi-rs/canvas](https://github.com/Brooooooklyn/canvas) for tooling thumbnails; [axe-core](https://github.com/dequelabs/axe-core) for automated DOM accessibility checks. Server-rendered thumbnails do not establish browser pixel identity; automated accessibility checks do not replace keyboard/touch review. Keep these out of the exported runtime.

The CLI precedes any MCP integration. A later MCP server should expose the same validated commands, revisions, and diagnostics; it should not become an alternate implementation of project editing.

The earlier incorrect Bitsy locale and Excalibur citation are replaced above. The embedded anatomy in the plan now links the audio scheduler at line 7851 and routing at line 7871, rather than labeling the tempo table at line 7833 as the scheduler.
