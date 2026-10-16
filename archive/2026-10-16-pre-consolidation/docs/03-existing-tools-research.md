# Research: a JavaScript studio for standalone one-page games

Research date: October 16, 2026. This is a focused architecture survey, not a benchmark or an exhaustive engine inventory. The recommendations below are inferences from the cited official documentation; no candidate engine was installed or performance-tested during this research.

Reference project: [play Terminator](https://mstefanko.github.io/terminator-game/) · [source repository](https://github.com/mstefanko/terminator-game).

## Main finding

The requested ingredients already exist separately: compact JavaScript game runtimes, visual level editors, sprite-sheet metadata, music transports, animation timelines, and single-HTML publishing. The useful new product would join those ingredients through a small, stable project format that both people and agents can edit. It should not start by rebuilding a general-purpose engine.

Treat one HTML file as the **publication format**, while keeping source projects modular and readable. Separate the authoring application from the runtime shipped to players. Establish asset and behavior contracts before building large editors: an animation timeline cannot reliably reuse arbitrary sprites until those sprites agree on animation names, facing, origins, and attachment points.

## Runtime and authoring comparisons

“Custom packaging” below means the engine's documented workflow does not itself guarantee one self-contained HTML file. It does not mean one-file export is impossible. A page that loads a library or assets from a CDN is not self-contained.

| Candidate | Verified strengths | Export and licensing facts | Architectural use here |
|---|---|---|---|
| **LittleJS** | Small API, automatic object lifecycle, fixed 60 Hz update, Canvas/WebGL rendering, tile collision, particles, touch support, procedural audio | MIT; repository describes no dependencies for the core. Documented publishing uses a game folder or Vite `dist` folder; assets and engine must be inlined by our exporter. Optional plugins can add dependencies. | First compact-engine candidate to prototype. Good reference for a deliberately narrow runtime. |
| **Phaser** | Named assets shared across scenes; loader supports atlases, sprite sheets, JSON, audio, and base64 image input | Framework MIT; Phaser Editor is a separate product with separate licensing. Custom one-file packaging still needed for a complete game. | Broader alternative when mature scene/asset facilities outweigh runtime footprint and integration complexity. |
| **Excalibur** | TypeScript engine with actors/scenes; graphics/animations are separate from actor identity; animation completion/frame events | BSD-2-Clause. Official hosting guide describes a built ZIP and static hosting, not a native single-HTML exporter. | Strong typed API reference. Evaluate if integrated actor, collision, and action facilities save more work than a tiny runtime. |
| **KAPLAY** | Game objects composed from small components; custom components have lifecycle hooks and explicit IDs | MIT. Publishing guide uses `index.html`, JS, and asset folders, while permitting an already assembled single HTML upload. | Excellent API ergonomics reference for reusable abilities and agents. Keep composition explicit and avoid global namespace APIs. |
| **ct.js** | Existing integrated level/UI editor, sprite animation, behaviors, asset packing, modular JS extensions | Repository MIT; runtime built on its framework plus PixiJS. Web export produces a ZIP of game files. | Closest visual-studio architecture example: editor and runtime separate, shared behaviors, import/build pipeline. Adopting it wholesale also adopts its project model. |
| **GDevelop** | Visual creator with a JS/TS runtime; object behaviors and scene/object variables; custom JS events | Core, runtime, IDE, and extensions MIT in the official repository. Documented local HTML export is a folder. | Proof that visual editing and code escape hatches coexist. A complete alternative if speed of authoring matters more than owning the format. |
| **Bitsy** | Small, bounded editor with plaintext game data and a focused game model | Official editor saves a playable `.html` and can import that HTML back for editing. | Best direct precedent for editable, self-contained games. Its deliberately constrained game model is not a replacement for action-combat gameplay. |
| **PICO-8** | Integrated code, sprite, map, sound-effect, and music editors; text cartridges; command-line export | Commercial fantasy console, Lua rather than JavaScript. Official “stand-alone html” export creates `mygame.html` **and** `mygame.js`; optional WASM adds another artifact. | Best product-design inspiration: shared assets, small vocabulary, fast edit/play loop. Do not describe its default export as one file. |

Sources: [LittleJS API](https://killedbyapixel.github.io/LittleJS/docs/Engine.html), [LittleJS repository](https://github.com/KilledByAPixel/LittleJS), [LittleJS publishing FAQ](https://github.com/KilledByAPixel/LittleJS/blob/main/FAQ.md); [Phaser loader](https://docs.phaser.io/phaser/concepts/loader), [Phaser framework license](https://phaser.io/download/license), [Phaser Editor license options](https://phaser.io/news/2026/02/new-flexible-licensing-options-now-available); [Excalibur animation](https://excaliburjs.com/docs/animation/), [Excalibur repository/license](https://github.com/excaliburjs/Excalibur), [Excalibur hosting](https://excaliburjs.com/docs/hosting/); [KAPLAY components](https://kaplayjs.com/docs/guides/components/), [custom components](https://kaplayjs.com/docs/guides/custom_components/), [publishing](https://kaplayjs.com/docs/guides/publishing/), [license](https://github.com/kaplayjs/kaplay); [ct.js architecture](https://github.com/ct-js/ct-js), [ct.js builds](https://docs.ctjs.rocks/building-your-game.html); [GDevelop JS runtime](https://docs.gdevelop.io/), [GDevelop repository/license](https://github.com/4ian/GDevelop), [local HTML export](https://wiki.gdevelop.io/gdevelop5/publishing/html5_game_in_a_local_folder/); [Bitsy HTML save/import](https://make.bitsy.org/docs/zh-Hans/tools/game/save/index.html); [PICO-8 manual](https://www.lexaloffle.com/dl/docs/pico-8_manual.html), [PICO-8 FAQ](https://www.lexaloffle.com/pico-8.php?page=faq).

The combination of requirements is the differentiation, rather than the existence of any one editor. This survey did not establish that no other product provides the exact combination.

## Reusable patterns by layer

### 1. Project documents are the common language

LDtk stores definitions separately from level instances and includes a JSON-format version. It publishes schema and deprecation guidance; external level files are an explicit option. Tiled supports typed properties, named object classes, and reusable templates with per-instance overrides. These are useful precedents for human-readable assets that tools can validate and agents can edit without opening an editor. [LDtk format overview](https://ldtk.io/docs/game-dev/json-overview/), [LDtk importer guidance](https://ldtk.io/docs/game-dev/loading/), [Tiled custom properties](https://doc.mapeditor.org/en/stable/manual/custom-properties/), [Tiled templates](https://doc.mapeditor.org/en/stable/manual/using-templates/).

Recommended application:

- Store a manifest plus separate sprite, level, score, cutscene, and archetype documents. Reference stable IDs rather than paths or array indexes.
- Include `schemaVersion`, `runtimeVersion`, coordinate conventions, and units. Keep editor-only panel positions and selections out of runtime data.
- Use JSON Schema as the public validation contract, TypeScript for implementation, and a versioned migration pipeline. Ajv supports validation with TypeScript type narrowing; it can serve the CLI and studio with the same validator. [Ajv TypeScript support](https://ajv.js.org/guide/typescript.html).
- Run structural validation first, then semantic checks: missing sprite clips, dangling entity references, impossible start points, overlapping cutscene ownership, or invalid musical loops.
- Import LDtk/Tiled into the canonical format at build time. Do not initially force every published game to carry their full editors or parsers.

### 2. Sprite interchange needs a contract, not just a PNG

Aseprite exports sprite-sheet JSON, named frame tags, slices, and pivots. Those are practical inputs for an importer. Excalibur demonstrates the useful distinction between an actor and the replaceable graphic/animation that presents it. [Aseprite command-line export](https://www.aseprite.org/docs/cli/), [Aseprite slices](https://aseprite.com/docs/slices/), [Excalibur graphics base](https://excaliburjs.com/api/class/Sprite/).

Recommended sprite contract:

```text
SpritePack
  id, version, nativeSize, pixelsPerUnit
  frames: source rectangles, duration, trim offset
  animations: idle, walk, hurt, attack, die ...
  facing: available directions + mirror policy
  origin: ground-contact point
  sockets: hand, head, muzzle, speech
  palettes: named optional color roles
  capabilities: humanoid.walk, humanoid.aim ...
```

Behavior should request `play("walk")` or `attach("weapon", "hand")`; it should not know atlas cell 47 or a particular character's pixel height. A compatibility validator can explain why a replacement is incomplete and preview fallback clips. Keep gameplay collision shapes in archetypes/abilities rather than deriving them from opaque pixels: replacing art should not silently change combat balance.

There are two distinct kinds of reusable movement. Whole-character movement—path, jump arc, scale, shake, fade—is broadly reusable. Limb-level animation needs a shared rig or authored frames and cannot be inferred from any arbitrary sprite. The first release should promise frame clips plus whole-character transforms. Add a small optional segmented rig only after a second art style proves the requirement.

### 3. Abilities should share execution and presentation

KAPLAY's components make behavior composition concrete: small named pieces with lifecycle hooks attach to objects. GDevelop similarly separates runtime objects and behaviors. State-machine transitions provide a useful pattern for explicit ability phases. [KAPLAY custom components](https://kaplayjs.com/docs/guides/custom_components/), [GDevelop runtime](https://docs.gdevelop.io/), [XState transition actors](https://stately.ai/docs/transition-actors).

Use abilities such as `shove`, `shoot`, `hide`, and `dash` as registered modules with typed configuration and a few standard phases: windup, active, recovery, cooldown, interrupted. Specify targeting, resource use, and damage independently from visual clips. Human input, enemy AI, and authored scenes issue the same semantic commands. Cutscenes should normally request presentation-only ability playback so a scripted muzzle flash does not accidentally damage gameplay entities.

Use state machines where phases and interruption rules matter. Do not introduce a full entity-component-system framework or statechart library into every exported game solely for architectural symmetry. A small explicit state machine can implement the same useful pattern.

### 4. Music authoring and audio playback should use the same score

Tone.js provides a transport, tempo-relative notation, synthesis, effects, and audio-clock scheduling; its README explicitly warns that ordinary JavaScript callback timing is imprecise. It requires audio startup in a user gesture and is MIT-licensed. [Tone.js documentation and license](https://github.com/Tonejs/Tone.js), [transport scheduling](https://github.com/tonejs/tone.js/wiki/Transport).

Recommended score format:

```text
Score
  instruments: oscillator/noise/sample + envelope + effects
  patterns: ticks, pitch, duration, velocity, optional automation
  arrangement: pattern instances by track and bar
  tempoMap, meter, loop markers
  cues: menu, exploration, combat, boss, victory
  transitions: next beat/bar, fade, shared-stem continuity
```

Use integer musical ticks for the document and the audio clock for playback. Keep the gameplay simulation clock separate. The editor's piano roll, step sequencer, instrument inspector, and arrangement lanes all manipulate this score; preview uses the production audio backend. Cancelling a preview, hiding the tab, changing songs, and restarting playback must clean up scheduled events and voices.

For the first release, extract a compact Web Audio backend comparable in scope to the current game's synth and support a limited instrument vocabulary. Tone.js is a strong alternative if advanced transport/effect features justify its measured bundle cost. Avoid an editor that previews using Tone but exports a vaguely equivalent custom synth: differences in envelopes, scheduling, and effects would undermine trust. Either share the backend or formally define and test the supported subset.

### 5. Cutscene editing is a timeline over real scene entities

Theatre.js separates authoring (`@theatre/studio`) from runtime playback (`@theatre/core`) and exports project state as JSON. Its core can animate ordinary JS values. Its repository specifies Apache-2.0 for core and AGPL-3.0 for Studio; use the split when evaluating integration, rather than assuming the entire editor has the core's license. The repository currently notes private development toward its next version, so pin and validate any adopted release. [Theatre core API](https://www.theatrejs.com/docs/latest/api/core), [Theatre repository and licensing](https://github.com/theatre-js/theatre).

Borrow this separation even if building a purpose-made timeline. Tracks should bind to stable actor IDs and semantic properties: position, facing, clip, prop socket, camera, dialogue, sound cue, palette flash. Reuse the actual sprite renderer and animation player in the cutscene editor.

Scrubbing must be a first-class operation. Continuous tracks can evaluate directly at time `t`; discrete events need explicit policy. Seeking should not repeatedly play sounds, award items, or damage enemies. Define initial state plus pure track evaluation, and use a separate forward-play event cursor. Give timeline-controlled properties one owner while a cutscene is active; suspend competing AI or movement systems and restore control on complete, skip, or interruption.

### 6. Studio and runtime must have separate lifecycles

ct.js demonstrates a visual editor around a separately built runtime and module system; Theatre demonstrates excluding authoring UI from the published bundle. Those are the boundaries to copy, regardless of whether the studio UI uses React or another framework. [ct.js repository architecture](https://github.com/ct-js/ct-js), [Theatre production state loading](https://www.theatrejs.com/docs/latest/api/core).

Recommended editor model:

- A document store holds authored data; a separate session store holds selection, zoom, playback, and open panels.
- Typed commands such as `MoveEntity`, `ReplaceSprite`, `SetNote`, and `InsertClip` change documents and produce undoable edits. Both agent tooling and GUI buttons call these commands or the same validators.
- Preview runs the real runtime in an isolated frame using an in-memory project snapshot. It does not mutate authoring data while playing.
- Start with local files/import/export and autosave. Add collaboration and cloud storage only when required.
- An inspector should derive most form fields from schemas, with specialist controls for sprites, music, and timelines.

### 7. One-file publishing is a compiler target

esbuild supports bundling, browser-oriented `iife` output, asset loaders such as `dataurl`, and build metadata for dependency contributions. Its `legalComments: "inline"` or `"eof"` options retain notices without producing a separate legal-text file. These are building blocks, not a complete single-HTML exporter. Vite's normal production output is a static application bundle and likewise does not promise one file. [esbuild API](https://esbuild.github.io/api/), [Vite production builds](https://vite.dev/guide/build).

Use Vite for the studio's development server and normal application build. Its asset graph supports explicitly inlined imports and raw-text imports, but files in `public` are copied separately. The game exporter therefore needs its own explicit resource manifest and a final no-external-resource check; merely increasing Vite's asset-inline limit does not prove self-containment. [Vite asset handling](https://vite.dev/guide/assets).

Recommended export pipeline:

```text
validate project
  → migrate/import authoring data
  → resolve reachable assets and registered behaviors
  → build runtime entry with pinned dependencies
  → inline JS/CSS/data/images/audio into HTML
  → retain required license notices
  → verify no external resource requests
  → publish one index.html
```

Compile modules to an inline script appropriate for the supported browsers; handle literal `</script>` safely when embedding code/data. Preload and decode embedded assets before the start screen. Base64 images/audio trade simplicity for size and memory; generated pixels and procedural music can remain compact data. Set budgets based on measured example games rather than guessing a universal maximum.

Make two tests release gates: a game loaded directly from the artifact with network blocked, and the same artifact served from a GitHub Pages subdirectory. A single file does not remove browser audio-unlock rules or guarantee every mobile OS will open local HTML from its file manager. HTTPS-hosted play remains the primary mobile distribution path.

## Recommended first implementation experiment

Build a narrow vertical slice before committing to an engine or a large editor. Use a new original mini-game, not an immediate rewrite of the working Terminator game. Include two actors, one reusable shove/shoot ability, one level, one short score, and one ten-second cutscene using those same actors.

Prototype the slice with a small adapter around the existing Canvas runtime or LittleJS. Compare a second candidate only if a concrete requirement exposes a weakness; Phaser or Excalibur are sensible alternatives. The acceptance test is the workflow, not an impressive engine demo:

1. An agent creates a valid project using documented data and one behavior module.
2. A person replaces the hero's sprite pack without touching behavior code.
3. A person moves an obstacle in a level view, changes a musical pattern, and retimes a cutscene clip.
4. Desktop and touch actions drive the same semantic input commands.
5. Preview and exported playback agree.
6. The exporter produces one HTML that plays with external networking disabled.
7. A second, visually different game is created from the same runtime without editing its core.

Prefer one supported backend initially. Keep the project format independent of renderer-specific objects, but do not build and maintain multiple engine adapters before there is a second consumer. The framework's defensible value is reliable interchange, editing, validation, and publishing—not the number of rendering backends.

## Decisions to leave explicit in the review

| Decision | Recommended default | Evidence needed to change it |
|---|---|---|
| Build own engine or authoring layer? | Authoring/data/export layer over a compact existing or extracted runtime | A prototype proves the available runtime cannot express the intended game mechanics cleanly |
| Sprite replacement scope | Frame clips, facing, origins, sockets; whole-body transforms | Multiple games require limb-level retargeting and share an actual rig contract |
| Audio dependency | Shared compact Web Audio backend first; evaluate Tone for richer needs | Measured editor complexity or musical requirements exceed the small supported vocabulary |
| Level editor | Small placement/collision/trigger editor plus LDtk/Tiled import | Larger projects demand advanced tile tooling already provided by external editors |
| Cutscene editor | Purpose-made timeline using runtime entities; borrow Theatre's model | Direct Theatre integration materially reduces work and fits product/license constraints |
| Source layout | Modular project documents and TS/JS modules | No reason to make one source file a product requirement |
| Release format | One self-contained HTML plus separate editable project source | A game exceeds practical payload/memory budgets and the user explicitly permits a multi-file alternative |

Unverified items: real-world bundle sizes, comparative mobile performance, importer compatibility with particular tool versions, and editor integration cost. These should be measured in the vertical slice. License observations identify upstream declarations and distinctions; dependencies and bundled sample assets need their own notices when an actual implementation is selected.
