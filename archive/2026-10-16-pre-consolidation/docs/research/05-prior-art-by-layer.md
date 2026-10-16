# Prior art by layer for the one-page game framework

Research date: 2026-10-16. Licenses and dates were checked against GitHub API, LICENSE files, and npm by four parallel researchers; anything unconfirmed is tagged "unverified" in the layer sections. The original 01/02/03 docs are unchanged. Layers are grouped: 1-3, 4-6, 7-9, 10-12.

## Executive summary

1. **No existing music editor should replace the music workbench.** BeepBox (MIT) is mature with a standalone synth, but its canonical format is a URL string with no published JSON schema, forks (JummBox, UltraBox) drift, and it has no intensity-layer concept. Keep the planned score and patch JSON, modeled on the Sonant-style layout (tracks, one instrument parameter array each, pattern sequence). Use ZzFX (MIT, under 1 KB) and jsfxr (Unlicense) for SFX. Treat BeepBox as an optional import path. Avoid Strudel (AGPL-3.0, GitHub repo archived June 2025).
2. **Embed the source project inside the exported HTML.** Bitsy and Twine both store data in a typed, non-executing element in the output; Twine's format is formally specified. Add a project-JSON block with `schemaVersion` plus an import-from-HTML command. Pyxel's app2html also freezes the runtime version into the export.
3. **The exporter needs no dependency beyond esbuild plus a template.** vite-plugin-singlefile (MIT) is mainly a list of pitfalls (no worklets, no History API routing, no sourcemaps). Skip Roadroller and RegPack for v1.
4. **Schema layer: TypeBox 1.x is the best fit** (JSON Schema plus static types, no generator). Confirm its LICENSE text first (GitHub says NOASSERTION; README and npm say MIT). Migrations stay custom: borrow LDtk (keep old and new fields for two minor versions), Tiled (separate format and tool versions), Godot (numeric version plus migration chain). Use Tweakpane or lil-gui for parameter panels; skip JSON Forms and RJSF.
5. **Undo: use Immer (MIT, v11.1.21, 2026-10-02) inverse patches** rather than a hand-built system; one drag is one transaction. Borrow tldraw's store/migration pattern but not the SDK (license key and watermark). Local dev server file sync beats the File System Access API for human plus agent co-editing because of file-change notifications. Yjs and Automerge can wait.
6. **License traps:** Spine runtimes require each end user to hold a Spine license; Aseprite source is not redistributable; LibreSprite and Lospec are GPL; GSAP's license is free-for-commercial but not OSI; Theatre.js has had no release since May 2024. Import Aseprite CLI sheet/JSON with MIT ase-parser; pack atlases with MIT free-tex-packer-core. Make sprite sockets per-frame (Aseprite slice keys), not per-sprite as the plan has them.
7. **Level editor stays custom.** Use LDtk and Tiled as import adapters only. Borrow LDtk's definitions/instances split, UUID `iid`s, and per-level files. Ogmo is dormant.
8. **Verification tooling already exists:** Playwright (offline artifact check), pixelmatch (ISC, v8.0.0), @napi-rs/canvas or skia-canvas (MIT) for CLI previews, axe-core for accessibility, clig.dev for CLI conventions. Still custom: replay recorder (fixed step, one seeded RNG, run-length-encoded inputs, state-hash checkpoints; Math.sin/cos can differ across engines), canvas hit-testing with a hidden DOM mirror, flow interpreter. Game MCP servers (Godot, Unity, Unreal) are heavy or stale; build the CLI first, wrap in MCP later, and copy Aseprite's --batch/--preview pattern. Moves and abilities are patterns (MUGEN AIR frame lists with separate hit properties, GAS-style tags and effects), not libraries; inline a small PRNG and FSM instead of XState or Yuka.

---

# Part A: Prior art for layers 1-3 (compact runtimes, single-file export, schema/types/migrations)

Research date: 2026-10-16. Licenses, push dates, and release dates come from the GitHub API and the npm/PyPI registries unless marked otherwise. "Unpacked" npm sizes are tarball contents (sources, maps, typings), NOT bundle cost; real bundle sizes were not measured. Items marked UNVERIFIED come from search snippets or memory only.

Scope note: this covers only layers 1-3. Tools already covered in 03-existing-tools-research.md (LittleJS, Phaser, Excalibur, KAPLAY, ct.js, GDevelop, Bitsy, PICO-8, LDtk, Tiled, Aseprite, Tone.js, Theatre.js, esbuild, Vite, Ajv, XState) are only referenced where a new fact matters.

---

## Layer 1: Compact runtimes and fantasy consoles

| Name | What it is | License | Maintenance (verified) | Size / embeddability | URL |
| --- | --- | --- | --- | --- | --- |
| TIC-80 | Fantasy console (240x136, 16 colors, 4 sound channels); editors built in; cartridge = chunked binary `.tic` | MIT | Active. Last push 2026-10-16; v1.3.1 release 2026-10-05 | Native/WASM player; release `html.zip` is ~3.0 MB (WASM runtime, so not a tiny single file). Pro build can export without editors | https://github.com/nesbox/TIC-80 |
| microStudio | Browser game IDE (sprites, maps, sounds, code in MicroScript/JS/Lua/Python) | MIT | Active repo (push 2026-10-12); last tagged release 24.01.29 (2024-01-29) | HTML5 export is a ZIP (index.html + sprites + JS), not one file (per docs, search snippet, UNVERIFIED for current build). Standalone app has fewer export options | https://github.com/pmgl/microstudio |
| Pyxel | Python retro engine (16 colors, 4 channels, built-in editors). Latest PyPI 2.9.9, uploaded 2026-08-12 | MIT (per project page; PyPI license field empty; GitHub API for `kitao/pyxel` returned 404 from this environment, so repo status UNVERIFIED) | PyPI release 2026-08-12 | `pyxel app2html` turns a `.pyxapp` into a self-contained HTML with the runtime pinned at conversion time (docs via search). Issue #616 reports CORS failure on `file://` in Chrome/Edge | https://pypi.org/project/pyxel/ |
| melonJS | Full lightweight 2D engine (Tiled-centric, WebGL/canvas) | MIT | Active. Push 2026-10-16; npm 20.8.0 on 2026-10-06 | Unpacked npm 9.5 MB (includes sources/maps); real bundle much smaller but not measured | https://github.com/melonjs/melonJS |
| Kontra.js | Micro 2D game library for js13k, tree-shakeable modules | MIT | Slow. v10.0.2 on 2024-08-25; last push 2026-01-30 | npm unpacked 545 KB (sources, not bundle). Designed for 13 KB zips; per-module imports | https://github.com/straker/kontra |
| Pixel Vision 8 | C#/Lua fantasy console | MS-PL | Archived; last push 2023-01-04, last release v1.0.18 2021-08-08 | Not browser-first | https://github.com/PixelVision8/PixelVision8 |
| WASM-4 | Fantasy console for WebAssembly (160x160, 4 colors); cart is a single `.wasm` | ISC | Active-ish. Last push 2026-09-11 | Carts bundle to a standalone HTML via `w4 bundle --html` (from memory, UNVERIFIED); cart is tiny | https://github.com/aduros/wasm4 |
| js13k patterns | Competition conventions: 13 KB zip limit, one index.html, Terser + Roadroller + ZIP | n/a | Competition recurs yearly | See Layer 2 for packers | https://js13kgames.com |

### Patterns worth copying

- TIC-80 `.tic` chunk layout: 4-byte header (bank number 3 bits + chunk type 5 bits, 16-bit little-endian size, 1 reserved byte) followed by data, repeated per chunk. The idea to copy is typed, bank-addressed chunks with a reserved byte for forward evolution. (Spec: https://github.com/nesbox/TIC-80/wiki/.tic-File-Format)
- TIC-80 Pro saves carts as text so any editor and VCS can diff them. This validates our "human and agent readable project" decision. The README explicitly pitches it for version control.
- Pyxel's three-artifact split: authoring format (`.pyxres` resource), distribution archive (`.pyxapp`), and exported HTML (`app2html`) with the runtime version frozen at export. Freezing the runtime into the export means old games never break when the framework changes. We should do the same (embed runtime version + project `schemaVersion` in the output).
- Pyxel's virtual gamepad enabled by default in the HTML export, removable via a config flag in the exported file: a good precedent for touch controls toggled from a manifest field.
- Fantasy consoles ship a fixed budget (palette, resolution, channels). Declaring limits in the manifest and validating assets against them (not as a hard runtime limit) gives agents a clear target.
- Edit-play loop: all of TIC-80, PICO-8, Pyxel, and microStudio embed the editors with the player in one window and hot-run with one key. Our studio preview should reload the runtime from the same compiled project the exporter emits to avoid parity drift.
- Kontra's per-module tree-shakeable imports show how a Canvas runtime can stay small: exporter can drop unused modules (cutscenes, music) when the project does not use them.

### Implication for our plan

- TIC-80 / Pyxel / microStudio: BORROW PATTERN, do not adopt. They are complete products with fixed editors; the plan's custom JSON format and studio are not made unnecessary by any of them. TIC-80 text cart + chunk bank idea and Pyxel's frozen-runtime export are the two concrete takeaways.
- melonJS: IGNORE as a runtime unless the LittleJS vertical-slice test fails; it is another full engine and does not change the exporter or studio.
- Kontra: BORROW PATTERN (module-level tree-shaking, js13k budget discipline). It is slow-moving, so do not depend on it.
- Pixel Vision 8: IGNORE (archived, MS-PL, not web-first).
- WASM-4: IGNORE (WASM-only cart format does not fit a JS/TS Canvas runtime).

---

## Layer 2: Single-file export and bundling

| Name | What it is | License | Maintenance (verified) | Size / embeddability | URL |
| --- | --- | --- | --- | --- | --- |
| vite-plugin-singlefile | Vite plugin inlining JS and CSS into dist/index.html; one file, no other outputs | MIT | npm 2.3.3 published 2026-04-17 (GitHub latest release tag v2.3.0, 2025-07-02); push 2026-04-17 | ~25 KB unpacked, 1 dep. README: works on `file://` for localStorage, FileSystem API; not History-API routing, cookies, worklets, sourcemaps | https://github.com/richardtallent/vite-plugin-singlefile |
| vite-plugin-singlefile-compression | Variant that gzip-compresses the inlined payload | MIT | Push 2026-10-09 | UNVERIFIED size and decompression approach | https://github.com/bddjr/vite-plugin-singlefile-compression |
| esbuild (already covered) | Bundler with a JS API; can emit one JS file you template into HTML yourself | MIT | v0.28.2, 2026-08-08 | ~147 KB unpacked npm package (binary shipped separately), 0 deps | https://github.com/evanw/esbuild |
| inline-source | Inlines `<script inline>`/`<link inline>` marked assets into HTML | MIT | npm 8.0.3, 2023-11-17 | ~47 KB unpacked | https://www.npmjs.com/package/inline-source |
| html-inline | Streaming HTML inliner | MIT | npm 1.2.0, 2015-10-02 (stale) | n/a | https://www.npmjs.com/package/html-inline |
| remy/inliner | CLI inliner (images, CSS, JS to data URIs) | MIT | Last push 2022-10-02 | n/a | https://github.com/remy/inliner |
| Terser | JS minifier (standard js13k first step) | BSD-2-Clause (npm) | npm 5.51.2, 2026-08-27 | ~2.3 MB unpacked (dev-time only) | https://github.com/terser/terser |
| Roadroller | Context-mixing JS packer; up to ~15% smaller than best zip recompressors per its README | MIT (npm; GitHub API reports NOASSERTION) | Stale. v2.1.0 2021-09-13, last push 2022-07-24 | Adds a JS decoder stub and is CPU/memory heavy at decode; intended for 4 KB+ demos | https://github.com/lifthrasiir/roadroller |
| RegPack | Regex-based JS packer for size-coded demos | NOASSERTION per GitHub (custom license file; check before use) | v5.0.4, 2022-07-10 | Tiny stub | https://github.com/Siorki/RegPack |
| Bitsy (export) | Editor exports one HTML; game data in `<script type="text/bitsyGameData" id="exportedGameData">` | MIT. GitHub repo is a read-only archive; development moved to codeberg.org/adamledoux/bitsy | Archive notice; last push 2026-07-22 | One self-contained HTML; data editable by pasting above that tag (docs/FAQ via search) | https://github.com/le-doux/bitsy |
| Twine 2 publish format | Published story is an HTML with `<tw-storydata>`; passages as `<tw-passagedata>`; separate story-format JS inlined | GPL-3.0 (Twine app) | Active. 2.12.1 on 2026-10-07 | One HTML. Public spec exists | https://github.com/iftechfoundation/twine-specs |
| PuzzleScript (export) | Export button writes a standalone HTML bundling engine + compiled game | MIT | Active (push 2026-10-16) | One file; `buildStandalone.js` + `standalone_inlined.txt` template (DeepWiki, UNVERIFIED). Docs note exports misbehave when run from disk in some builds | https://github.com/increpare/PuzzleScript |
| Pyxel app2html | See Layer 1 | MIT | See above | Self-contained HTML; one reported `file://` CORS failure (issue #616) | https://github.com/kitao/pyxel |

### Patterns worth copying

- Bitsy and Twine both embed the SOURCE DATA in the output as a typed, non-executing element (`<script type="text/bitsyGameData">`, `<tw-storydata>`). Re-import means "find that element, parse it". Twine's output is formally specified in the twine-specs repo, which is a model for documenting our own embed. Recommendation: put the full project JSON in `<script type="application/json" id="game-project">` with a `schemaVersion`, and have the runtime read it from there at boot. This gives re-import and an agent-readable artifact for free.
- Bitsy data starts with a title line and a `BITSY VERSION x.y` line, so the file declares its own format version in the first lines. Copy the idea: top-level `format` and `schemaVersion` keys first in our JSON.
- vite-plugin-singlefile's documented limits are our checklist for the exporter: avoid History API routing, cookies, worklets (matters for AudioWorklet music), sourcemaps (emit separately). The Worklets limit is directly relevant to a synthesized-music runtime: use ScriptProcessor-free approaches such as precomputed buffers or an inlined Blob URL worker, and test on `file://`.
- Binary assets (sprites, rendered audio) should be base64 inline or a packed Uint8Array in the JSON script block; consider optional deflate via the browser `DecompressionStream` (verify support targets) as the cheap alternative to Roadroller. Roadroller is stale, adds CPU cost at load, and only pays off at js13k-scale constraints, which we do not have.
- js13k order of operations: bundle (esbuild) then minify (Terser or esbuild minify) then optional pack, then zip. For our product, bundle + minify is enough; add packing only behind an opt-in flag.
- PuzzleScript's explicit "source extraction from standalone HTML" tool shows users will demand round-tripping; plan it as a first-class command (`export` and `import-from-html`).
- Offline CORS gotchas (Pyxel #616, PuzzleScript FAQ): never `fetch()` sibling files or load ES modules by URL; all code and data inline; avoid `type="module"` external src. Add a `file://` smoke test to the exporter test suite.

### Implication for our plan

- vite-plugin-singlefile: ADOPT only if the studio is Vite-built. For the game exporter, a ~50-line custom esbuild script that reads the bundled JS and templates one HTML is simpler, avoids a Vite dependency in the runtime path, and uses fewer moving parts. It is still a good reference implementation (config: `assetsInlineLimit` huge, `cssCodeSplit` off). Note the plan already lists Vite and esbuild; the exporter does NOT need a separate plugin if esbuild alone is used.
- inline-source / html-inline / inliner: IGNORE (generic, stale or redundant with our own template step).
- Terser: IGNORE unless esbuild's minifier misses a size target (esbuild minify is built in).
- Roadroller / RegPack: IGNORE for v1 (stale, license ambiguity for RegPack, CPU cost); revisit only for a "13 KB mode".
- Bitsy/Twine/PuzzleScript embed-and-reimport: BORROW PATTERN (embedded typed project block + import-from-html command). This makes a custom "re-import" component small instead of hard.

---

## Layer 3: Schema, types, validation, forms, migrations

| Name | What it is | License | Maintenance (verified) | Size / embeddability | URL |
| --- | --- | --- | --- | --- | --- |
| TypeBox (`typebox` 1.x) | Builds JSON Schema objects that also infer static TS types; has a built-in validation engine; claims Draft 3 to 2020-12 | MIT (npm and README; GitHub API reports NOASSERTION because of a non-standard license filename) | Very active. npm 1.4.1 on 2026-10-16; legacy `@sinclair/typebox` 0.34.52 on 2026-07-11 | 1.57 MB unpacked, 0 deps. Name changed from `@sinclair/typebox` (1.0 migration guide exists). Bundle cost not measured | https://github.com/sinclairzx81/typebox |
| Zod v4 | TS-first schema/validation; native `z.toJSONSchema()` (default draft 2020-12; also draft-07, draft-04, OpenAPI 3.0) | MIT | Very active. v4.6.7 on 2026-10-12 | 6.1 MB unpacked, 0 deps. `z.fromJSONSchema()` is documented as experimental. Has codecs (`decode`/`encode`) and metadata registries | https://zod.dev/json-schema |
| zod-to-json-schema | Legacy converter for Zod v3 | ISC | Archived; last release 3.20.3 (2023-02-10) per GitHub, README says not for v4 | n/a | https://github.com/StefanTerdell/zod-to-json-schema |
| Valibot | Modular, tree-shakeable validator | MIT | v1.5.0 on 2026-09-09 | 1.87 MB unpacked, 0 deps. JSON Schema output is via a separate package (not checked) | https://github.com/open-circle/valibot |
| Ajv (already covered) | JSON Schema validator; compiles to code | MIT | v8.20.0 on 2026-04-24 | 1.0 MB unpacked, 4 deps. Code generation uses `new Function` unless using standalone code | https://github.com/ajv-validator/ajv |
| @cfworker/json-schema | Validator that avoids code generation (works under CSP/edge) | MIT | 4.1.1 on 2025-01-31 | 174 KB unpacked, 0 deps | https://www.npmjs.com/package/@cfworker/json-schema |
| json-schema-to-typescript | JSON Schema to `.d.ts` generator | MIT | 16.0.0 on 2026-08-28 | 294 KB unpacked | https://github.com/bcherny/json-schema-to-typescript |
| ts-json-schema-generator | TS types to JSON Schema | MIT | v2.5.0 on 2026-02-04 | n/a | https://github.com/vega/ts-json-schema-generator |
| JSON Forms | Schema + UI-schema forms (React/Angular/Vue renderers) | MIT | v3.8.0 on 2026-06-16; push 2026-10-16 | `@jsonforms/core` 1.17 MB unpacked; needs a renderer set (Material/Vanilla) | https://github.com/eclipsesource/jsonforms |
| RJSF (`@rjsf/core`) | React JSON Schema Form | Apache-2.0 | v6.11.0 on 2026-09-29 | 2.5 MB unpacked, React required | https://github.com/rjsf-team/react-jsonschema-form |
| Tweakpane | Compact tweak/control panel; bindings to plain objects | MIT | v4.0.5 on 2024-11-03; last push 2026-03-15 | 448 KB unpacked, 0 deps | https://github.com/cocopon/tweakpane |
| lil-gui | Small drop-in successor to dat.GUI | MIT | 0.21.0 on 2025-10-12 | 226 KB unpacked, 0 deps | https://www.npmjs.com/package/lil-gui |
| Leva | React-only GUI controls | MIT | v0.10.1 on 2025-10-31; last push 2025-11-09 | React/Zustand dependency tree | https://github.com/pmndrs/leva |
| jsondiffpatch | JSON diff/patch with readable deltas | MIT | 0.7.6 on 2026-05-14 | 163 KB unpacked | https://www.npmjs.com/package/jsondiffpatch |
| Immer | Draft-based immutable updates | MIT | 11.1.21 on 2026-10-02 | 962 KB unpacked | https://www.npmjs.com/package/immer |
| LDtk JSON | Versioned level format with published JSON Schema (draft-07), `jsonVersion` field | MIT | v1.5.3 released 2024-01-15; repo push 2026-10-15 | Schema file is ~76 KB | https://ldtk.io/docs/game-dev/json-overview/ |
| Tiled JSON/TMX | `version` + `tiledversion` stamped into every file | Mixed (GitHub reports NOASSERTION; GPL/BSD split per component, check before reuse) | v1.12.2 on 2026-05-27 | Format docs only | https://doc.mapeditor.org/en/stable/reference/json-map-format/ |
| Godot scene format | Text resources with a `format=` integer in the header (current is 3, from memory; UNVERIFIED here: my docs fetch returned an empty page) | MIT (engine) | Active | Concept only | https://docs.godotengine.org/en/stable/contributing/development/file_formats/tscn.html |

### Patterns worth copying

- Single schema source, three outputs. With TypeBox, schema objects ARE JSON Schema, so one definition gives (a) TS types via `Static<>`, (b) JSON Schema for agents/docs/editors, (c) runtime validation, with no generator step. With Zod v4, `z.toJSONSchema()` gives the same through a conversion step, with documented gaps: bigint, date, map, set, transform, and custom throw by default (option `unrepresentable: "any"` degrades to `{}`). Output defaults to the OUTPUT type; use `io: "input"` for input. For a format that must be handed to AI agents as JSON Schema, avoid transforms and keep schemas pure data.
- Do not use zod-to-json-schema with Zod 4 (archived, v3 only).
- Because schemas are plain JSON Schema either way, `json-schema-to-typescript` is only needed if the schema is authored as hand-written `.json` (which is what the plan appears to prefer for human editing). Choose ONE direction: hand-written JSON Schema + generated `.d.ts`, or TS-first (TypeBox/Zod) + emitted `.schema.json`. Do not maintain both.
- Validate with Ajv or TypeBox's own engine in Node (CLI, studio); in the exported HTML, skip schema validation entirely (validate at build time) to avoid shipping a validator and avoid `new Function`.
- Form generation: JSON Forms (schema + separate UI-schema) and RJSF (React, Apache-2.0) will render basic property panels but need React or framework renderers and heavy theming; our editors (sprite grid, piano roll, flow graph) are custom anyway. Tweakpane or lil-gui are the right weight for tuning panels (ability numbers, speeds, colors): plain-object binding, 0 deps, tiny. Leva is React-only, skip.
- LDtk: stamps `jsonVersion` in the project and publishes a JSON Schema, plus a documented DEPRECATION CYCLE: a breaking change keeps both old and new fields in output for two minor versions (x.y until x.y+2), then drops the old. This is directly copyable for our "agent-edited" files: agents and external tools get a two-version grace window.
- Tiled: every file records both a format `version` and the editor `tiledversion` that saved it. Copy both, distinguishing "schema version" (compatibility) from "tool version" (diagnostics).
- Godot: header carries an integer `format=`; loaders upgrade on load and write back at the newest format. Copy: a numeric `schemaVersion`, an ordered list of pure migration functions `vN -> vN+1`, applied in a chain on load, always writing the latest version on save.
- Bitsy: `BITSY VERSION` line at the top of the data block (see Layer 2).
- Migration implementation: store migrations as `migrations/NNN-description.ts` exporting `(doc) => doc`; golden-file tests with an old fixture per version; use Immer (or structuredClone) to keep migrations pure; `jsondiffpatch` is optional for showing agents what a migration changed in a PR-friendly form.
- Run migrations in the CLI (`framework migrate`) and the studio loader, never inside the exported runtime (the exporter embeds only the latest version).

### Implication for our plan

- Schema authoring: ADOPT TypeBox 1.x (`typebox`) as the default, because a TS-first schema that IS JSON Schema removes the need for a separate generator and keeps agent-facing schemas faithful. Zod v4 is an equally viable alternative if the team prefers its ecosystem; its `toJSONSchema` is official but lossy for transforms. Valibot: IGNORE (smaller runtime does not matter in the build-time-validated path). Flag: TypeBox's repo license shows NOASSERTION on GitHub while npm/README state MIT; confirm the LICENSE text before adopting.
- json-schema-to-typescript: IGNORE if TS-first; ADOPT only if the plan keeps hand-written `.schema.json` as source of truth.
- Validation: Ajv (already in plan) or TypeBox's engine at build/CLI time only. Existing tools make a custom validator unnecessary.
- Property-panel forms: ADOPT Tweakpane or lil-gui for tuning panels. JSON Forms / RJSF: IGNORE (React and theming overhead, editors are custom).
- Migrations: no off-the-shelf library to adopt; BORROW the LDtk deprecation window, Tiled dual versions, and Godot numeric-format chain. A custom migration runner is ~100 lines and is justified. The key plan decision: never let migration code ship in exported HTML.
- Planned custom components that existing tools make unnecessary: (1) a custom JSON-to-types generator (TypeBox/Zod already emit both); (2) a custom generic form renderer for parameter panels (Tweakpane/lil-gui); (3) a bespoke HTML inliner (a small esbuild-based template step suffices, and vite-plugin-singlefile documents the pitfalls).
# Part B: Prior art for layers 4-6 (editor document model, sprite tooling, level editors)

Research date: 2026-10-16. Verification key: **[V]** = verified this session from a primary source (GitHub API / LICENSE file / npm registry / vendor docs); **[U]** = from background knowledge, not verified this session. "Last push" is the GitHub `pushed_at` or latest default-branch commit; release dates are from GitHub releases. Sizes are npm `unpackedSize` (not minified/gzipped bundle size, which was not measured) or GitHub repo size in KB.

Not re-covered here (already in doc 03): LittleJS, Phaser, Excalibur, KAPLAY, ct.js, GDevelop, Bitsy, PICO-8, LDtk/Tiled/Aseprite at survey level, Tone.js, Theatre.js, esbuild, Vite, Ajv, XState. They appear below only where they bear on these layers.

---

## Layer 4: Editor document model, undo, commands, folder sync

| Name | What it is | License | Maintenance (verified date) | Size / embeddability | URL |
|---|---|---|---|---|---|
| Immer | Draft-mutate producer with `produceWithPatches` giving forward and inverse JSON patches | MIT [V] | Release v11.1.21, 2026-10-02 [V] | npm unpacked ~962 KB (includes dist variants; bundled core is small, not measured) | https://github.com/immerjs/immer |
| Mutative | Immer-compatible API, claims faster; patches supported [U on perf claims] | MIT [V] | v2.0.0, npm modified 2026-10-12 [V] | npm unpacked ~951 KB | https://github.com/unadlib/mutative |
| rfc6902 | RFC 6902 JSON Patch apply/diff/create | MIT [V] | v5.3.0, 2026-07-23 [V] | ~98 KB unpacked | https://www.npmjs.com/package/rfc6902 |
| fast-json-patch | Older JSON Patch lib | MIT [V] | v3.1.1, last publish 2022-06 [V]; stale | ~159 KB unpacked | https://www.npmjs.com/package/fast-json-patch |
| jsondiffpatch | Structural JSON diff/patch (not RFC 6902) | MIT [V] | v0.7.6, 2026-05-14 [V] | ~163 KB unpacked | https://www.npmjs.com/package/jsondiffpatch |
| Excalidraw | Whiteboard; history stores deltas per scene element; elements carry `version`/`versionNonce` for reconcile | MIT [V] | Pushed 2026-10-15 [V] | Large app; `@excalidraw/excalidraw` is embeddable but React-bound | https://github.com/excalidraw/excalidraw |
| tldraw (`@tldraw/store`, `@tldraw/state`) | Record store with typed schema, migrations, history diffs, reactive signals | Store/state packages MIT per npm [V]; the main tldraw SDK is under a custom "tldraw license": no production use without a license key, watermark enforced, usage data may be sent [V, LICENSE.md] | Release v5.5.2, 2026-10-02 [V] | `@tldraw/store` ~1.6 MB unpacked, `@tldraw/state` ~0.6 MB | https://github.com/tldraw/tldraw |
| Zustand | Tiny state store (+ community temporal/undo middleware) | MIT [V] | v5.0.15, 2026-08-13 [V] | ~95 KB unpacked | https://github.com/pmndrs/zustand |
| Yjs | CRDT for shared types, built-in `UndoManager` | MIT (LICENSE file confirmed; GitHub API shows NOASSERTION) [V] | v13.6.33, 2026-09-23 [V] | ~2.3 MB unpacked | https://github.com/yjs/yjs |
| Automerge | CRDT JSON document with history and change log | MIT [V] | Release js/automerge-3.5.0, 2026-09-16 [V]. npm `latest` dist-tag shows 2.0.0-alpha.3; `automerge-repo` 2.6.0-alpha.3 on 2026-10-13. Dist-tag layout is confusing; verify before depending | WASM core; size not verified | https://github.com/automerge/automerge |
| Theatre.js Studio | Animation studio whose state is a JSON file committed to the repo and loaded by the runtime | Apache-2.0 [V] | Latest default-branch commit 2024-04-11 [V]; low activity | Studio is dev-only, stripped from production build | https://github.com/theatre-js/theatre |
| Motion Canvas | Canvas animation in TS with a browser editor that writes back to source/meta files | MIT [V] | v3.17.2 2024-12-14; last commit 2026-07-02 [V] | Dev-time editor; output is a player bundle | https://github.com/motion-canvas/motion-canvas |
| Decap CMS | Git-backed CMS, browser admin edits files in a repo | MIT [V] | decap-cms@3.17.1, 2026-10-14 [V] | Single-page admin; React | https://github.com/decaporg/decap-cms |
| TinaCMS | Git-backed CMS with local dev GraphQL server writing files | Apache-2.0 [V] | Pushed 2026-10-16 [V] | Heavy; needs local server | https://github.com/tinacms/tinacms |
| File System Access API | `showDirectoryPicker` and handles; persistent handles in IndexedDB | Web standard | MDN documents it as secure-context only; browser support table not verified this session. Commonly understood to be Chromium-only for the pickers, with Firefox/Safari lacking them [U] | Zero bytes | https://developer.mozilla.org/en-US/docs/Web/API/File_System_API |
| idb-keyval | Tiny IndexedDB key-value wrapper | Apache-2.0 [V] | v6.3.0, 2026-07-08 [V] | ~56 KB unpacked (library itself under 1 KB min [U]) | https://github.com/jakearchibald/idb-keyval |
| fflate | Tiny ZIP/deflate in JS | MIT [V] | v0.8.3, 2026-07-20 [V] | ~800 KB unpacked, tree-shakeable | https://github.com/101arrowz/fflate |
| Storybook | Dev server plus browser UI; "controls" write args back to code only via a manual or add-on step [U] | MIT [V] | Pushed 2026-10-16 [V] | Not embeddable | https://github.com/storybookjs/storybook |

### Patterns worth copying

- **Immer patches as the command substrate.** `produceWithPatches(doc, draft => ...)` returns `[next, patches, inversePatches]`. Store `{label, patches, inversePatches}` per undo entry. This gives typed-command ergonomics (write a normal mutation) with automatic inverses, and the patch list is directly serializable for the CLI and for "this batch changed these JSON pointers" diagnostics. Patches use JSON-pointer-like paths, matching the plan's diagnostic style (`/clips/walk`).
- **Transaction coalescing.** Excalidraw and tldraw both treat a pointer drag as one history entry via begin/commit (tldraw: `history.batch` / marks). Plan already says "a drag is one undo transaction"; implement as `beginTransaction(label)` / `commit()` over a patch accumulator, with merge keys for repeated slider or text edits within a time window.
- **tldraw store shape**: records keyed by typed IDs (`shape:abc`), a schema with per-type migration sequences, and `store.listen` emitting `{added, updated, removed}` diffs with a source tag (`user` vs `remote`). Copy the source tag so agent/file-originated changes can be excluded from or tagged in the undo stack. Copy per-type migration sequences for the versioned project format.
- **Stale-write rejection**: Excalidraw's per-element `version` + `versionNonce` and Figma-style last-writer-wins per property. For the plan's "expected document revision in command batches", a per-file content hash plus a monotonic `rev` is enough; no CRDT needed.
- **Theatre.js model**: the editable state lives in a plain JSON file checked into the repo, the studio is only loaded in dev, and the runtime consumes the same JSON. This is exactly the plan's separation of project format from editor history. Motion Canvas uses `.meta` sidecar JSON files next to source files for editor-owned state; sidecar files per asset is a useful boundary for small diffs.
- **Local sync tiers**:
  1. Baseline: open/import ZIP, edit, autosave to IndexedDB, export ZIP (plan already says this). fflate is sufficient for ZIP.
  2. Enhancement: File System Access API directory handle, stored in IndexedDB, with a permission re-prompt after reload; write via `createWritable()` (atomic swap on close). Poll `getFile().lastModified` or content hash to detect external (agent) edits; show a reload/merge prompt rather than overwriting.
  3. Alternative for non-Chromium: a tiny local dev server (`gamekit studio`) serving the studio and exposing `GET/PUT /files/*` plus an SSE or WebSocket channel for file-changed events. Tina and Vite-based editors work this way; the CLI and the studio then share one writer and one watcher. This also removes the browser-support question entirely and is the lowest-risk path for agent round-trips.
- **Decap/Tina lesson**: Git-backed editors avoid owning persistence; the file tree is the database. They also show the cost: schema config is a second source of truth. Generating inspectors from the same JSON Schema as the validator (already planned) avoids that.

### Implication for our plan

- **Immer (or Mutative): adopt.** Replaces a hand-written command/inverse system; keep named commands as thin wrappers that run a producer. Reason: automatic inverse patches, MIT, very actively maintained. Mutative is a drop-in alternative; pick one by measuring bundle size. Patches also make a hand-written `MoveEntity`-style inverse unnecessary.
- **tldraw store: borrow pattern, do not adopt.** The store/state packages are MIT per npm, but the SDK license is restrictive and the architecture is oriented to a canvas editor; the migration-sequence and diff-with-source ideas are what we need.
- **Yjs / Automerge: ignore for now.** Plan already defers real-time collab. If needed later, Automerge's change log matches a "documents are JSON" model better than Yjs types, but its npm dist-tag state is confusing; re-verify then.
- **JSON Patch libs: ignore** unless we want an on-disk patch format for agents. Immer patches are not strictly RFC 6902 (path is an array), so an agent-facing patch format would need a conversion; if the CLI accepts RFC 6902, `rfc6902` is the maintained choice.
- **File System Access: adopt as enhancement only; add a local dev-server tier.** The dev server (Theatre/Tina/Vite pattern) is likely more valuable than FSA because agents and humans must edit the same files concurrently and FSA gives no push notifications for external changes.
- **Planned custom component made unnecessary:** hand-rolled undo/redo inverse logic.

---

## Layer 5: Sprite and pixel-art tooling

| Name | What it is | License | Maintenance (verified date) | Size / embeddability | URL |
|---|---|---|---|---|---|
| Aseprite | Commercial pixel editor and animation tool; CLI exports sheet + JSON (frames, `frameTags`, slices with pivot) | Source-available under the Aseprite EULA: you may only compile/modify source for personal purposes or contributions, and may not distribute copies [V, EULA.txt]; some bundled modules MIT | Release v1.3.18.6, 2026-09-22 [V] | Desktop app; cannot be embedded or redistributed | https://github.com/aseprite/aseprite |
| LibreSprite | GPL fork of the last GPL Aseprite | GPL-2.0 [V] | Release v1.3, 2026-10-02 [V] | Desktop (and an experimental web build [U]); GPL blocks bundling into a permissive tool | https://github.com/LibreSprite/LibreSprite |
| Piskel | Browser pixel editor, `.piskel` JSON file, GIF/PNG export | Apache-2.0 [V] | Last release v0.15.0, 2018-11-25; last commit 2026-09-20 [V] | Plain JS web app; could be embedded as an iframe or forked; not designed as a library | https://github.com/piskelapp/piskel |
| Lospec Pixel Editor | Browser pixel editor with palette focus | GPL-3.0 [V] | Last commit 2024-06-29 [V] | Web app; GPL blocks copying code | https://github.com/lospec/pixel-editor |
| Pixelorama | Godot-built pixel editor (desktop and web export) | MIT [V] | v1.2.3, 2026-09-15 [V] | Godot web export is multi-MB WASM [U]; not embeddable in a single small HTML | https://github.com/Orama-Interactive/Pixelorama |
| pixel-art-react | React pixel-art editor | MIT [V] | Pushed 2026-02-05 [V] | React app | https://github.com/jvalen/pixel-art-react |
| ase-parser | JS parser for `.ase`/`.aseprite` binary files (frames, layers, cels, tags, slices, palette; Node `Buffer` based per its README [U]) | MIT [V] | v0.0.19, 2026-09-04 [V] | ~43 KB unpacked | https://github.com/TheCyberRonin/ase-parser |
| free-tex-packer-core | Atlas packer (MaxRects, etc.), exports several atlas formats incl. Phaser/Pixi JSON | MIT [V] | Last commit 2026-07-24; npm v0.3.9 [V] | ~113 KB unpacked; Node/browser | https://github.com/odrick/free-tex-packer-core |
| Spine runtimes | Skeletal animation runtimes (e.g. `@esotericsoftware/spine-canvas` 4.3.13) | Spine Runtimes License (Apr 5, 2025): integrating runtimes is allowed only per Section 2 of the Spine Editor License; each end user of the product must hold their own Spine Editor license, and redistribution must carry the notice [V, LICENSE] | spine-runtimes pushed 2026-10-12; spine-canvas 4.3.13 on 2026-08-30 [V] | spine-canvas ~3.5 MB unpacked | https://github.com/EsotericSoftware/spine-runtimes |
| DragonBones JS | Open skeletal runtime and format | MIT [V] | Last commit 2025-05-24 [V] | Moderate | https://github.com/DragonBones/DragonBonesJS |
| upng-js | Small PNG encode/decode with palette support | MIT [V] | Last publish 2022-06 [V] | Small | https://www.npmjs.com/package/upng-js |
| gifenc | Fast GIF encoder | MIT [V] | Last publish 2022-05 [V] | ~173 KB unpacked | https://www.npmjs.com/package/gifenc |

### Patterns worth copying

- **Aseprite export JSON as the interchange contract.** `aseprite -b file.aseprite --sheet s.png --data s.json --format json-array --list-tags --list-slices --split-layers [V]`. The data has `frames[]` (frame rect, `spriteSourceSize`, `sourceSize`, `duration`), `meta.frameTags[]` (name, from, to, direction), and `meta.slices[]` with per-frame `keys[]` containing `bounds`, optional 9-patch `center`, and `pivot` [V for slices shape]. Mapping: slice named `hand` with a 1px bounds or a pivot = socket; slice `origin`/pivot = ground origin; tag names = semantic clips. Sheet types supported by the CLI: horizontal, vertical, rows, columns, packed [V].
- **Slice-as-socket convention** (Aseprite slices, similar to Godot `Marker2D` children or Spine bone/point attachments): socket per frame is keyed, so a weapon hand point can move across frames. The plan's single `sockets: {hand:[13,15]}` per sprite is too coarse for animated clips; make it per-frame with an optional pack-level default, keyed by frame index.
- **Trim-aware coordinates.** The Aseprite/TexturePacker JSON pair `spriteSourceSize` + `sourceSize` lets you restore untrimmed space; sockets and pivots must be stored in untrimmed coordinates (plan already requires this).
- **Palette-indexed pixel data.** `.piskel` files store layers as base64 PNG inside JSON [U]; Aseprite indexed mode keeps a palette plus index per pixel [U]. For a one-file game, a compact format of `palette: ["#rrggbb"...]` plus run-length or base64 index bytes per frame lets recolor and palette-role swaps be a lookup-table change at runtime, with no re-pack.
- **Animation JSON style**: Piskel-like `fps` plus per-frame hold; Aseprite per-frame `duration` in ms. Prefer ms (or ticks) per frame as the plan states.
- **Onion skin and grid UX**: Piskel and Pixelorama (both open) are good UX references for onion skin, layer/frame timeline, palette swatch row, and tool set (pencil, bucket, line, rect, select, mirror/tile mode). Use as reference only for GPL ones (Lospec, LibreSprite).
- **Atlas packing**: MaxRects bin-pack with padding and optional trim/extrude is the standard; export JSON in either hash or array form. For a single HTML export, packing is a build step, and the output can be one PNG data URL plus a small frame table.
- **Segmented rig tier (later)**: Spine and DragonBones both separate skeleton (bones, slots, attachments), skins (swap attachments per slot), and animations (timelines per bone/slot). The "skin" concept maps directly to the plan's "appearance binding". Spine's JSON/binary format and runtimes are not freely redistributable in a shipped game unless every end user of our framework owns a Spine license, which conflicts with a one-HTML free-distribution goal.

### Implication for our plan

- **Aseprite export JSON + ase-parser: adopt as importers.** The plan already lists an Aseprite importer. Prefer consuming the CLI's sheet+JSON (stable, documented, no binary parsing) as primary and `ase-parser` (MIT, small, but 0.0.x versioning and Buffer-based, so Node-side or polyfilled) as optional direct `.aseprite` import in the CLI. Aseprite itself cannot be bundled; document it as an optional external tool.
- **Piskel / Pixelorama / Lospec: borrow UX patterns only.** Embedding any is impractical (Piskel is not a library; Pixelorama is a Godot export; Lospec is GPL). A minimal indexed pixel grid with onion skin, as the plan already scopes, remains custom, but keep it deliberately tiny and lean on "import from Aseprite/Piskel PNG" for serious art.
- **free-tex-packer-core: adopt (or borrow the MaxRects algorithm)** for the exporter's atlas step rather than writing a packer. Note it is a 0.3.x package maintained by one person; vendoring its MaxRects logic is a low-risk fallback.
- **Spine: ignore for the product; DragonBones or a custom minimal bone format only when the segmented-rig tier is actually needed.** Spine's license makes it unsuitable as a bundled dependency. DragonBones is MIT but its last commit is 2025-05-24 and the editor ecosystem is thin, so prefer a small custom bone/slot/skin schema modeled on Spine's separation.
- **Planned custom component partly unnecessary:** a full pixel editor (plan already rejects this) and an atlas packer.
- **Plan correction suggested:** make sockets per-frame (Aseprite slice keys), not per-sprite.

---

## Layer 6: Level editors

| Name | What it is | License | Maintenance (verified date) | Size / embeddability | URL |
|---|---|---|---|---|---|
| LDtk | Modern 2D level editor (Haxe/Electron); JSON project with `defs` and `levels`, auto-layers, entity fields | MIT [V] | Latest GitHub release v1.5.3, 2024-01-15; repo commits as recent as 2026-10-06 [V] (so releases are slow, development continues; check whether a newer build exists outside GitHub releases) | Editor is a separate desktop/web app; format has a published JSON schema [V from docs nav] | https://github.com/deepnight/ldtk |
| Tiled | Long-standing general tile map editor; TMX/TMJ (JSON) | Mixed: editor GPL, `libtiled` BSD-2-Clause, other pieces BSD [V, COPYING] | v1.12.2, 2026-05-27 [V] | Desktop Qt app; format is documented and stable | https://github.com/mapeditor/tiled |
| Ogmo Editor 3 (CE) | Project-defined level editor; project file defines layers, entities with typed values, tilesets | MIT [V] | Last release 3.4.0, 2020-12-31; last commit 2022-01-19 [V]; effectively dormant | Electron desktop app | https://github.com/Ogmo-Editor-3/OgmoEditor3-CE |
| Sprite Fusion | Web-based tilemap editor, exports JSON/Tiled-like | Not verified; third-party loaders are MIT [V for those loaders only] | Not verified | Hosted web app [U] | https://www.spritefusion.com |
| tiled-types | TypeScript type definitions for Tiled JSON | MIT [V] | v1.3.0, 2022-05 [V] | ~11 KB | https://www.npmjs.com/package/tiled-types |
| `ldtk` (npm) | Community LDtk helper types/loader | MIT [V] | v0.8.7, 2022-05 [V]; stale | ~86 KB unpacked | https://www.npmjs.com/package/ldtk |
| `@excaliburjs/plugin-tiled` | Tiled loader for Excalibur | BSD-2-Clause [V] | v0.32.0, 2025-12-23 [V] | ~7.2 MB unpacked (ties to Excalibur) | https://www.npmjs.com/package/@excaliburjs/plugin-tiled |
| pixi-tiledmap | Tiled loader for Pixi | MIT [V] | v2.11.0, 2026-09-25 [V] | ~1.4 MB unpacked | https://www.npmjs.com/package/pixi-tiledmap |

### Patterns worth copying

- **LDtk definitions vs instances.** Project JSON has a header `__header__`, `jsonVersion` (example shows "1.2.2"), `iid`, `worldLayout`, `defs` (layers, entities, tilesets, enums, externalEnums, levelFields) and `levels[]` carrying `layerInstances` [V]. Entity definitions own typed fields; entity instances carry field values. Instance IDs are UUID `iid`s distinct from definition integer `uid`s [partly V: `iid` UUIDs visible in the example; uid usage [U]]. This matches the plan's "definitions vs instances" and "preserve IDs when moving, fresh IDs when duplicating".
- **LDtk derived fields prefixed with `__`** (e.g. `__identifier`, `__grid`, `__worldX`) are redundant, denormalized values for easy loading; the canonical data is the non-prefixed fields [U]. Pattern: keep canonical data minimal and have the exporter emit denormalized convenience fields for the runtime.
- **Separate level files.** The "Separate level files" option moves layer content into per-level files while the project file keeps defs and level metadata [V]. For agent and human diffs, one JSON per level (plan already has `levels/loading-yard.level.json`) is the right granularity.
- **Format evolution discipline.** LDtk publishes a JSON schema, a changelog of JSON changes, and an explicit deprecation cycle (breaking changes announced ahead) [V from docs]. Tiled marks maps with `version` (string since 1.6) and `tiledversion`, and the JSON format has been additive across releases [V field list; stability claim U]. Copy: `formatVersion` in each file, a schema per version, an additive-change rule, and a deprecation window; the CLI should have `migrate`.
- **Entity templates and overrides.** Tiled templates (already linked in the plan) and LDtk presets: instance stores only overridden fields. Match the plan's "typed, declared override" rule.
- **Auto-layers.** LDtk IntGrid layer plus rule-based auto-layer renders tiles from collision/terrain values, so authors edit semantic values and visuals follow [V from docs nav: IntGrid layers, Auto layers, Rules]. For a game with few tilesets, a simple "solid grid -> bitmask autotile" rule set (4-neighbor or 8-neighbor) is a small port of the idea and keeps collision independent of decoration, which the plan wants.
- **Typed entity fields**: LDtk supports int, float, bool, string, enum, color, point, tile, entity-reference, file path, and arrays [U; docs page for this was not fetched]. Ogmo 3 project-defined values are similar [U]. Entity-reference fields with validation is the hard, valuable one.
- **"Play here"**: LDtk has no built-in game runner [U]; Tiled has none either [U]. Engine editors (Godot, Unity) do. Implementing it in a Canvas studio is easy because the runtime is the same code: build a snapshot, start at a spawn marker chosen in the editor.
- **Ogmo**: project file defines entity "values" and layers; levels are plain JSON with an `ogmoVersion` [U]. Useful as evidence that schema-in-project plus level JSON is a viable minimal design.

### Implication for our plan

- **LDtk/Tiled editor: ignore as our editor, adopt as optional import adapters (already planned).** The plan's custom level editor is justified: both external tools are desktop apps that cannot share the studio's renderer, play-here, command model, or JSON Schema inspectors, and neither can validate our gameplay rules (spawn validity, encounter modules). The plan correctly defers import until the canonical shape is stable.
- **LDtk JSON structure: borrow pattern.** Defs/instances split, `iid` UUIDs, separate per-level files, denormalized `__` convenience fields on export, JSON schema plus deprecation policy.
- **LDtk's published JSON Schema: adopt for the import adapter only** (validate incoming `.ldtk`), not for our canonical format. Use `jsonVersion` to gate support and warn about unsupported features, as the plan states.
- **Tiled JSON: adopt via our own minimal reader** (the format is a flat, documented field list; `layers`, `tilesets`, `objectgroup` objects with `properties`). Community loaders are tied to engines (Excalibur, Pixi) and not worth bundling; `tiled-types` (MIT, tiny) is a reasonable type reference. Tiled's GPL applies to the editor only; libtiled is BSD [V].
- **Ogmo, Sprite Fusion: ignore.** Ogmo is dormant (last release 2020, last commit 2022); Sprite Fusion license and activity were not verified.
- **Planned custom component partly unnecessary:** none fully; the level editor stays custom. Auto-layer rules can be a small v2 feature copied from LDtk's concept rather than built as a generic rule engine.

---

## Cross-layer notes

- The strongest "do not build" findings: undo inverse logic (Immer patches), atlas packing (free-tex-packer-core / MaxRects), `.aseprite` import (CLI JSON + ase-parser).
- License traps confirmed: Spine runtimes (per-end-user Spine license required), Aseprite source (personal use only, no redistribution), tldraw SDK (production use requires a license key and watermark), LibreSprite and Lospec (GPL). Tiled's GPL covers only the editor; its JSON format is documented and implementable independently.
- Unverified items to resolve before commitment: File System Access browser support table (not extracted), Sprite Fusion license/status, LDtk entity-field type list and `uid` semantics (docs page not fetched), Mutative's performance claims, Automerge npm dist-tag state, bundled/minified sizes of any library (only npm unpacked size was checked).
# Part C: Layers 7-9 prior art (abilities/AI, music/SFX, cutscene/dialogue)

Research date: 2026-10-16. License/date data was pulled from the GitHub API and npm registry on this date (primary sources) unless tagged. Tags: **[V]** verified from registry/API/primary page; **[S]** from web search snippets only; **[M]** from memory, unverified. "Last push" is GitHub pushed_at (can include non-release commits); "npm" is latest published version date. Sizes are npm `unpackedSize` (includes sources, typings, maps) and are NOT bundle sizes unless stated.

---

## Layer 7: Abilities, moves, AI

### 7a. State machines, AI, RNG libraries

| Name | What it is | License | Maintenance | Size / embeddability | URL |
|---|---|---|---|---|---|
| XState v5 | Statecharts (hierarchy, parallel, guards, actors) | MIT [V] | Active; npm 5.33.2 on 2026-09-15; push 2026-10-16 | 2.3 MB unpacked; real min+gz bundle not measured. Heavyweight for a one-file export | https://github.com/statelyai/xstate |
| Robot (robot3) | Tiny functional FSM | BSD-2-Clause [V] | Active; npm 1.4.0 2026-10-05 | 29 KB unpacked (claims ~1 KB gz [M]) | https://github.com/matthewp/robot |
| javascript-state-machine | Classic FSM w/ transitions + history | MIT [V] | Dormant; npm 3.1.0 2018-07-12, push 2025-06-01 | 91 KB unpacked | https://github.com/jakesgordon/javascript-state-machine |
| Mistreevous | Behavior tree lib; trees defined in MDSL text or JSON [M] | MIT [V] | Active; npm 4.3.1 2025-07-24, push 2026-10-11 | 492 KB unpacked (incl. typings) | https://github.com/nikkorn/mistreevous |
| Yuka | Game AI: steering, FSM, goal-driven (Think/Goal), fuzzy logic, perception | MIT [V] | Light: npm 0.7.8 last published 2022-09-17; repo push 2026-10-04 | 1.0 MB unpacked; 3D-vector oriented, overkill for 2D | https://github.com/Mugen87/yuka |
| pure-rand | Seedable, serializable PRNGs (xoroshiro128+, Mersenne, etc.) | MIT [V] | Active; npm 8.4.2 2026-07-10 | 64 KB unpacked, tree-shakeable | https://github.com/dubzzz/pure-rand |
| seedrandom | ARC4 seeded `Math.random` replacement | MIT (npm) [V] | Dormant; npm 3.0.5 2019-09-17, push 2024-04-25 | 374 KB unpacked (mostly tests); ~1 KB code | https://github.com/davidbau/seedrandom |
| mulberry32 / sfc32 snippets (bryc "code" repo) | 5-10 line PRNG functions; state is one or four uint32 | Repo license NOASSERTION [V]; algorithms are public-domain style snippets, author states so [M] | Repo push 2026-01-31 | ~200 bytes; trivially inlined | https://github.com/bryc/code/blob/master/jshash/PRNGs.md |

### 7b. Fighting-game frame data conventions

| Name | What it is | License | Maintenance | Size / embeddability | URL |
|---|---|---|---|---|---|
| M.U.G.E.N AIR format + CNS | Text format: animation actions as frame lists (sprite group/image, x/y offset, tick duration, flip) with per-frame `Clsn1` (attack boxes) and `Clsn2` (hurtboxes), `Clsn2Default` for shared boxes; hit properties live separately in CNS `HitDef` | Docs freely readable; format is a de facto standard, no code | Frozen (2000s) | Spec only, ~1 page | https://www.elecbyte.com/mugendocs-11b1/air.html [S] |
| OpenKakutou (Go) `character/air` | Go parser of MUGEN AIR | Unverified | Unverified | Reference parser | https://pkg.go.dev/github.com/openkakutou/character/air [S] |
| Fighter Maker / other open frame-data formats | Not verified; no mature open JSON frame-data standard found in this pass | n/a | n/a | n/a | n/a |
| Community convention "startup/active/recovery" | Derived metrics, not stored: startup = ticks before first frame with an attack box, active = ticks with attack boxes live, recovery = remaining ticks (my reading of the AIR model; the sources checked did not state it explicitly) | n/a | n/a | n/a | n/a |

### 7c. Gameplay Ability System (pattern reference only)

| Name | What it is | License | Maintenance | Size / embeddability | URL |
|---|---|---|---|---|---|
| Unreal GAS | Abilities (activation, cost, cooldown), Gameplay Effects (instant/duration/infinite, modifiers), Gameplay Tags (hierarchical, used for block/require/grant), Attribute Sets | Unreal EULA, C++ only | Active, Epic [M] | Not embeddable; concepts only | https://dev.epicgames.com/documentation/en-us/unreal-engine/gameplay-ability-system-for-unreal-engine [M, page not fetched] |

### Patterns worth copying

- **Frame list is the source of truth, metrics are derived.** MUGEN AIR: each animation action is an ordered list of frames `{sprite, offset, ticks, flip}` with boxes attached per frame (or defaulted for the whole action). Store ticks per frame; compute startup/active/recovery in the studio for display and linting ("this move is 4/3/12").
- **Two box classes only**: attack boxes (`hit`) and hurtboxes (`hurt`), plus `Default` inheritance to avoid repeating a hurtbox on every frame. Add optional `push`/`block` boxes later.
- **Separate geometry from effect.** MUGEN splits boxes (AIR) from hit properties (HitDef: damage, hitstun, blockstun, knockback, hitstop, hit sound). Mirror this: a move has `frames[]` (timing + boxes) and `hit{}` blocks referenced by id from active frames. Keeps agent-edits small.
- **GAS mapping, minimum viable**: ability = `{id, tags.required, tags.blocked, tags.granted, cost, cooldown, timeline: frames[], effects: [effectId]}`; effect = `{duration: instant|ticks|infinite, modifiers: [{attr, op: add|mul|set, value}], tags.granted}`; tags are dotted strings with prefix matching (`state.stunned` blocks `ability.*`). This gives data-driven cooldowns, stuns, buffs, i-frames without code.
- **Integer ticks at fixed 60 Hz** for all timing; never seconds in data. Required for determinism and frame-data readout.
- **Deterministic RNG as one serializable state.** pure-rand's design (generator state is serializable and `unsafeJump`/clone-able) or a four-uint32 sfc32 state in the save/replay. All gameplay randomness draws from named streams (`ai`, `loot`, `fx`) derived from a master seed so cosmetic randomness cannot desync gameplay.
- **Behavior trees as data**: Mistreevous's approach of a text DSL (MDSL) plus equivalent JSON, with leaf actions as named functions registered by the host, fits our "JSON editable by agents, logic registered in runtime" split. Node vocabulary worth copying: sequence, selector, parallel, lotto (weighted random), repeat, retry, flip, succeed/fail, wait, plus `while`/`until` guards.
- **Utility AI is small enough to hand-roll**: list of `{action, considerations:[{input, curve}]}`, score = product, pick max (or weighted random with seeded RNG). Not worth a dependency.

### Implication for our plan

| Item | Verdict | Reason |
|---|---|---|
| XState v5 | Ignore as dependency; borrow concepts (hierarchical + parallel states, guards, named actions) | 2.3 MB unpacked is wrong weight for a one-file runtime; flow/state JSON can be a ~150-line custom interpreter. XState's JSON-ish machine config is a good schema reference. |
| Robot | Adopt-or-copy only if we want a library FSM | Tiny, BSD-2, active. But a ~50-line in-house FSM is equally cheap and avoids license text in every exported HTML. |
| Mistreevous | Borrow pattern; optional adopt for AI | MIT, active, JSON definitions. Check real min+gz size before embedding (not measured). If ability AI stays simple (state + utility scoring), skip it. |
| Yuka | Ignore | 3D-centric, stale on npm (2022), large. Steering behaviors can be copied as ~100 lines if needed. |
| pure-rand / seedrandom | Ignore libs; inline sfc32 or mulberry32 | Single-uint32 or four-uint32 state is trivially serializable into saves/replays; saves bytes and a dependency. Use pure-rand only if we want distribution helpers. |
| MUGEN AIR / GAS | Borrow pattern | Directly shapes our `move` and `ability` schema (see above). No library exists that we could adopt; the custom move editor remains necessary. No existing tool makes it unnecessary. |

---

## Layer 8: Music and SFX authoring

### Table

| Name | What it is | License | Maintenance | Size / embeddability | Song format documented? | URL |
|---|---|---|---|---|---|---|
| BeepBox | Browser chiptune sketchpad by John Nesky; `synth/` folder is a standalone player, `player/` is an embeddable mini player UI; npm `beepbox` exposes `Synth` | MIT [V] | Active-ish: repo push 2026-08-07, GitHub release v4.2.2 2025-12-08 [V]; npm 4.2.0 2024-08-26 | npm 3.6 MB unpacked (includes sources); `synth.ts` source alone 373 KB [V]; min+gz bundle NOT measured | Primary format is a compact base64-like 6-bit string (URL). A JSON export/import exists: `toJsonObject`/`fromJsonObject` present in synth.ts [V]; wiki says JSON is a secondary format [S]. No formal schema found | https://github.com/johnnesky/beepbox |
| JummBox | BeepBox fork (jummbus): extra features, modding, more instruments | MIT [V] | Slow: push 2025-09-05 [V] | Similar to BeepBox or larger; unmeasured | Same family: string + JSON | https://github.com/jummbus/jummbox |
| UltraBox | Further BeepBox-family fork | MIT [V] | Active: push 2026-07-17 [V] | Unmeasured | Same family | https://github.com/ultraabox/ultrabox_typescript |
| ZzFX | Tiny SFX synth, 20-parameter array | MIT [V] | Active: npm 1.4.0 2026-10-01, push 2026-10-01 | Under 1 KB compressed (README claim); npm 30 KB unpacked [V] | Yes: sound = flat array of numbers; web "Sound Designer" generates arrays | https://github.com/KilledByAPixel/ZzFX |
| ZzFXM | Tiny tracker-style music renderer on top of ZzFX instruments | MIT [V] | Dormant: push 2023-12-25 [V] | Player under ~500 bytes gz; songs often under 1 KB [S] | Yes: `[instruments[], patterns[][channel][notes], sequence[], bpm, meta]`-style arrays; MOD converter + song packer [S] | https://github.com/keithclark/ZzFXM |
| jsfxr | JS port of sfxr: SFX params, web editor, npm lib | Unlicense [V] | Active: npm 1.4.1 and push 2026-05-05 | 50 KB unpacked [V] | Yes: parameter JSON / base58-ish string | https://github.com/chr15m/jsfxr |
| sfxr/bfxr | Original SFX generators | MIT/other [M] | Legacy | n/a | Param files | not verified |
| Strudel | Tidal-style live coding for the browser; patterns written as JS code | AGPL-3.0 [V] | GitHub repo archived 2025-06-19; moved to codeberg.org/uzu/strudel; npm @strudel/web 1.3.0 2026-01-18 [V][S] | 1.5 MB unpacked (@strudel/web) [V]; needs sample banks | Code (JS mini-notation), not data | https://codeberg.org/uzu/strudel |
| Bassoon Tracker | Browser MOD/XM tracker; plays sample-based modules | MIT [V] | Active: push 2026-09-11 [V] | Full app; not a compact player (not measured) | MOD/XM binary (not JSON) | https://github.com/steffest/BassoonTracker |
| chiptune3 / chiptune2.js | libopenmpt playback of module files (MOD/XM/IT) via WASM/AudioWorklet | chiptune3 MIT (npm) [V]; chiptune2.js license unverified; libopenmpt is BSD [M] | chiptune3 npm 0.8.9 2026-08-19 [V]; chiptune2 push 2024-06-15 | chiptune3 1.6 MB unpacked [V] (WASM) | Binary module files | https://www.npmjs.com/package/chiptune3 |
| Sonant-X (Live) | Demoscene 8-track soft synth player, JSON-ish song object, tracker UI | Zlib [V] (nicolas-van/sonant-x) | Push 2025-06-18 | Small (single JS file; size unmeasured) | Yes (song object: tracks, instruments params, patterns, sequence) | https://github.com/nicolas-van/sonant-x |
| SoundBox (mbitsnbites) | Original JS13k tracker/player lineage (Sonant derivative) | License unverified | Archived, push 2023-08-31 [V] | Small | Sonant-style song object | https://github.com/mbitsnbites/soundbox |
| pl_synth (PhobosLab) | New Sonant-derived JS/C synth + browser tracker, songs as JSON, 2025 | Repo license NOT verified (API lookup failed) | Announced Jan 2025 [S] | Tiny by design [S] | Yes, JSON: `{row_len, tracks:[{synth:[28 params], sequence:[], patterns:[{notes:[32]}]}]}` | https://phoboslab.org/log/2025/01/synth , https://github.com/phoboslab/pl_synth |
| Tone.js | General WebAudio framework (already in prior doc) | MIT [V] | npm 15.1.22 2025-04-27, push 2026-10-12 | 5.4 MB unpacked | Code API only | https://github.com/tonejs/tone.js |

### Which have BOTH a compact embeddable player and a documented song format?

- **ZzFXM**: yes on both, smallest, but dormant and limited effects (volume and pattern break only [S]); one instrument per channel; no intensity layering built in.
- **Sonant-X / SoundBox / pl_synth**: yes on both. Sonant-derived model (tracks each with instrument params + patterns + sequence). pl_synth is the newest, with a JSON format and tracker editor; license/size need verifying.
- **jsfxr/ZzFX** for SFX: yes, trivially.
- **BeepBox family**: the only ones with a mature polished editor AND a real synth library AND JSON round-trip. Player is much heavier (hundreds of KB source) than the demoscene options.
- **Strudel, Tone.js, Bassoon/chiptune3**: no (code-as-song, or binary tracker formats and WASM).

### Can BeepBox/JummBox/UltraBox replace the planned music workbench?

Partially. It could replace the **instrument/pattern authoring UI and the synth**, but not the **intensity-layer semantics** or the "score JSON + patch JSON" contract. Specifics:

- Pros: MIT [V]; mature editor with sliders for FM/chip/noise/drumset/envelopes; actively developed (BeepBox push 2026-08, UltraBox 2026-07); synth library is published and decoupled from the editor (`synth/` folder, `build-synth` script) [V]; JSON export/import exists in code [V]; embeddable player directory exists [V]. Authors/agents could author songs in beepbox.co and paste the JSON.
- Cons / unverified: (1) the canonical format is the 6-bit URL string, JSON is secondary and has no published schema, and the forks (JummBox, UltraBox) diverge in fields, so "versioned, agent-editable JSON" would be a thin wrapper over an evolving, undocumented structure; (2) synth is a ~370 KB TypeScript source file; real minified/gzipped size is unmeasured and likely tens of KB to low hundreds of KB, versus a few KB for Sonant/ZzFXM; (3) no native concept of layered intensity or stems; BeepBox has channels you could mute/unmute per game state, which is a workable layering hack that needs a runtime API we would write anyway; (4) the editor is a separate app, so "browser studio with a music editor" would be an iframe or link-out, breaking the one-tool UX; (5) AI agents editing the 6-bit string directly is impractical, and JSON patches need schema knowledge we would have to write.
- Verdict: **do not adopt BeepBox as the music workbench dependency; do consider it as an optional import path** (paste BeepBox JSON into our score format, or embed its synth as an opt-in "rich" backend). For the default path, a Sonant-style model is a closer fit to the plan's score+patch JSON.

### Patterns worth copying

- **Sonant/pl_synth structure** (documented in PhobosLab write-up [V]): song = `row_len` + tracks; each track = one instrument parameter array + patterns of exactly 32 rows + a sequence of pattern indices per track. The author argues this beats ZzFXM's patterns-contain-tracks layout because drum loops and melody repeat independently. This maps directly onto "score JSON + patch JSON": patches = instrument param objects, score = tracks with `sequence`/`patterns`.
- **Intensity layers for free from track-per-layer**: tag each track with `layer: 0..N`; runtime unmutes tracks as intensity rises, quantized to pattern boundaries. This is our own addition; none of the surveyed libs ship it.
- **ZzFX parameter-array SFX**: a sound is a flat number array with fixed positional meaning, plus named-key objects in the authoring layer for readability and agent-editing; export packs to arrays. Good for the "human/AI editable JSON, compact export" split in general.
- **Precompute, then play**: ZzFX/ZzFXM/Sonant render buffers ahead of time (offline render at load) rather than real-time synthesis. Offline render makes playback deterministic and cheap, but costs load time on long songs; offer both.
- **BeepBox editor UX** worth studying: pattern grid with piano roll per channel, per-instrument envelope sliders, loop-point markers, URL-hash state for easy sharing (we can mirror with JSON in the project file instead).
- **jsfxr/ZzFX designer UX**: preset buttons (pickup, laser, explosion, hit, jump, blip), randomize/mutate button, and instant audition. Cheap to implement, big usability win; consider porting jsfxr (Unlicense) directly for the SFX tab.

### Implication for our plan

| Item | Verdict | Reason |
|---|---|---|
| BeepBox / JummBox / UltraBox | Borrow UX; optional import path; do NOT adopt as workbench | MIT and polished, but undocumented-schema JSON, forked field drift, heavy synth, no intensity layers. Does not make the planned workbench fully unnecessary. |
| Sonant-X (Zlib) / pl_synth (license TBD) | Borrow format; possibly adopt synth code | Smallest proven song+patch model with a working tracker; verify pl_synth license and size before reuse. Sonant-X Zlib is permissive. |
| ZzFX (MIT) | Adopt for SFX runtime | 1 KB, active, MIT, params array is exactly the shape we want. |
| jsfxr (Unlicense) | Adopt/port for SFX editor | Public-domain-style license, active 2026, ready-made editor logic. |
| ZzFXM | Borrow pattern only | Dormant, limited effects, pattern/track orientation is the "wrong way around" per PhobosLab. |
| Strudel | Ignore | AGPL-3.0 is incompatible with shipping inside arbitrary exported games unless we accept AGPL; repo moved/archived on GitHub; code-as-song. |
| Tone.js | Ignore for runtime | 5.4 MB unpacked, already considered in prior doc. |
| Bassoon Tracker / chiptune3 | Ignore (maybe MOD import later) | Sample/module-centric, binary formats, WASM. |

Flag: a custom music workbench is **still necessary** for intensity layers and the score+patch JSON contract, but it can be a thin tracker UI (a few hundred lines) on top of a Sonant-style synth instead of a from-scratch DSP project.

---

## Layer 9: Cutscene, timeline, dialogue

| Name | What it is | License | Maintenance | Size / embeddability | URL |
|---|---|---|---|---|---|
| Theatre.js | Motion-design toolkit: keyframe studio UI + `@theatre/core` runtime; project state is JSON | Apache-2.0 [V] (studio package has different/AGPL terms [M], unverified) | Slowing: repo push 2024-08-14, npm core 0.7.2 on 2024-05-19 [V] | core 903 KB unpacked [V]; studio separate and heavy | https://github.com/theatre-js/theatre |
| Motion Canvas | Generator-function-based animations authored in TS, with a browser editor that scrubs timeline | MIT [V] | Quiet: npm core 3.17.2 on 2024-12-14; repo push 2026-07-02 [V] | core 865 KB, ui 1.7 MB unpacked [V]; tied to Vite plugin build | https://github.com/motion-canvas/motion-canvas |
| GSAP | Dominant JS tween/timeline library | "Standard no-charge license" (gsap.com/standard-license) [V]; Webflow made all plugins free for commercial use in April 2025 (v3.13) [S]; NOT an OSI license, with use restrictions I did not read (e.g., competing no-code tools) | Active: npm 3.15.0 2026-04-13 [V] | 6.3 MB unpacked [V]; core ~70 KB min [M] | https://gsap.com/standard-license |
| anime.js v4 | Lightweight animation engine with timelines, modular imports | MIT [V] | Active: npm 4.5.0 2026-06-22; push 2026-08-21 [V] | 2.1 MB unpacked, tree-shakable (bundle size unmeasured) | https://github.com/juliangarnier/anime |
| Rive | Vector animation runtime with state machines; `.riv` binary files from the Rive editor | Runtime MIT [V]; editor is proprietary SaaS [M] | Very active: npm canvas-lite 2.44.2 on 2026-10-10 [V] | 2.9 MB unpacked incl. WASM [V] | https://github.com/rive-app/rive-wasm |
| Lottie (lottie-web, dotLottie) | After Effects JSON animation player | MIT [V] | lottie-web npm 5.13.0 2025-05-21 (slow); dotlottie-web push 2026-10-16 [V] | lottie-web 25 MB unpacked (!) [V] | https://github.com/airbnb/lottie-web |
| ink / inkjs | Narrative scripting language (inkle) and JS port runtime; compiled story JSON | ink MIT, inkjs MIT [V] | ink push 2026-05-05; inkjs npm 2.4.0 2026-02-17, push 2026-09-01 [V] | inkjs 6.9 MB unpacked (includes compiler + typings) [V]; runtime-only build is far smaller [M, unmeasured] | https://github.com/y-lohse/inkjs |
| Yarn Spinner | Dialogue language; core is C#; JS runtimes are community: `yarn-bound`, `bondage` | Yarn Spinner MIT [V]; yarn-bound ISC [V]; bondage MIT [V] | yarn-bound 0.5.5 2024-11-29, bondage 2.2.0 2020-07-25 [V]; official JS repo not found by that name | yarn-bound 331 KB unpacked [V] | https://github.com/YarnSpinnerTool/YarnSpinner |
| Twine (+ Harlowe/Chapbook/story formats) | Passage-graph editor outputting self-contained HTML; story formats are pluggable | Twine GPL-3.0 [V]; Chapbook MIT [V]; Harlowe: unverified | Twine push 2026-10-07 [V] | Editor app; output is one HTML | https://github.com/klembot/twinejs |
| Ren'Py script | Python-based VN engine; line-oriented script (`label`, `show`, `scene`, `with`, `menu`, `jump`) | MIT [M] (repo license field null in API) | Very active: push 2026-10-16 [V] | Python runtime; not embeddable | https://github.com/renpy/renpy |

### Patterns worth copying

- **Theatre.js "project state = JSON, studio = optional dev dependency, core = runtime"**: runtime loads a plain JSON state of sheets/objects/sequences; the studio is stripped at export. This is the exact editor/runtime split we want and validates exporting only the runtime. Sequence model: objects with typed props, keyframes with bezier handles, position-scrubbable.
- **Motion Canvas scrubbable generators**: timelines written as generator functions (`yield* all(...)`, `waitFor`) are deterministic, so any frame can be reached by replaying from t=0; editor scrubs by fast-forwarding. Takeaway for us: a data-driven cutscene (list of timed tracks/commands) is trivially scrubbable if each command is a pure function of time; avoid wall-clock callbacks.
- **GSAP/anime.js timeline model**: timeline = ordered tweens with position parameters (`"<"`, `"+=0.5"`, labels), nesting, `seek`, `timeScale`. Copy the position semantics (relative-to-previous, absolute, label) into JSON: `{at: "prev.end+0.5" | "label:x", target, props, ease, dur}`.
- **Rive state machines and Lottie JSON**: Lottie shows the cost of a general interchange format (25 MB package, huge feature surface); Rive shows the value of a small typed state machine (inputs/triggers drive transitions) embedded in the asset. Lesson: keep cutscene commands to a small closed vocabulary (move, fade, shake, say, wait, play-music, set-flag, camera, branch) and validate with schema.
- **Ink**: weave/choice syntax compiles to JSON; runtime exposes `Continue()`, `currentChoices`, `ChooseChoiceIndex`, variables, external functions, and save/load of state as JSON. Sticky vs once-only choices, tunnels (`->->`), tags (`# speaker:Ana`) on lines. Tags-for-metadata is a cheap hook to drive portraits/voice.
- **Yarn Spinner**: lines, `<<command>>` and `<<if>>` blocks, `->` options, nodes with titles, `jump`. Commands are the integration point to host game functions. Node-per-title maps cleanly onto JSON nodes in our flow editor.
- **Ren'Py**: one line = one beat (`ana "text"`), `scene/show/hide/with`, `menu:` blocks, `jump/call/return`, persistent variables. Conventions for speaker aliases and screen transitions are worth copying in the JSON dialogue schema (`{speaker, text, portrait, effects[]}`).
- **Twine/Chapbook**: passage graph and one-file HTML output validate our single-file export story; link syntax `[[text->target]]` gives agents a very natural way to write branches.

### Implication for our plan

| Item | Verdict | Reason |
|---|---|---|
| Theatre.js | Borrow pattern; do not adopt | Core/studio split and JSON state are the model; but stalled (last npm 2024-05), studio licensing unverified, and it animates generic props, not game commands. |
| Motion Canvas | Borrow pattern (scrubbable determinism) | Generator code, not JSON, and Vite-coupled; not data-driven. |
| GSAP | Ignore as dependency; borrow position syntax | Free commercial use since April 2025 [S] but custom non-OSI license, 6 MB package; legal review needed to bundle into exported games. |
| anime.js v4 | Optional adopt for tweening | MIT, active, tree-shakable. A ~100-line custom tween/ease module probably suffices for a Canvas runtime that already owns the clock. Measure bundle if considered. |
| Rive / Lottie | Ignore | Heavy runtimes, different problem (vector animation), proprietary editor (Rive) or 25 MB lib (Lottie). |
| ink / inkjs | Adopt-or-borrow for branching dialogue | MIT and active; but inkjs is large, and compiled JSON is not human/agent-friendly to edit. If dialogue is mostly linear + choices, a simple custom dialogue JSON (below) is lighter. Offer inkjs import as optional add-on. |
| Yarn Spinner | Borrow syntax ideas; skip JS ports | JS runtimes are community and stale (bondage 2020, yarn-bound 2024). |
| Twine / Harlowe / Chapbook | Borrow UX (passage graph, link syntax); ignore code | Twine is GPL-3.0; not embeddable; graph UX informs our flow editor. |
| Ren'Py | Borrow script conventions | Not embeddable; format ideas only. |

Flag: no existing tool replaces the planned cutscene and dialogue editors for our JSON format. The nearest candidates (Theatre.js studio, inkjs) are mismatched in either data model or weight.

---

## Cross-layer notes

- **Licenses to avoid shipping inside exported HTML**: Strudel (AGPL-3.0), Twine (GPL-3.0, editor only, not shipped). GSAP's license is custom; treat as needs-review.
- **Prefer inlining** over dependencies in the exporter where the algorithm is under ~200 lines (PRNG, tweens, FSM, SFX synth). Keep third-party code only where substantial (ZzFX is exempt: 1 KB).
- **Unverified items to resolve before final decisions**: min+gz size of beepbox synth build; pl_synth license; Sonant-X bundle size; Mistreevous bundle size and JSON schema; Theatre.js studio license; Rive/Harlowe license; whether a mature open JSON frame-data format exists beyond MUGEN AIR.
- **Sources used**: GitHub API and npm registry (2026-10-16), BeepBox README and synth.ts (raw GitHub), BeepBox wiki Song Formats (via search), PhobosLab "Synthesizing Music from JSON" (https://phoboslab.org/log/2025/01/synth), Webflow/CSS-Tricks GSAP-free announcements, MUGEN docs (elecbyte), Strudel Codeberg move (GitHub MOVED_TO_CODEBERG).
# Part D: Layers 10-12 prior art (flow/menus/a11y, testing/determinism, agent tooling)

Researched 2026-10-16. Repo license, last-push date, and latest release were pulled from the GitHub API (`gh api`) on that date unless marked "unverified". "Pushed" means last push to the default branch. Items marked "unverified" came from search snippets or memory and were not checked against a primary source. I did not read docs/02 or docs/03 in this pass, so cross-references to planned components are by layer name only.

---

## Layer 10: Flow/scene graphs, menus, canvas UI, accessibility

### Flow models in existing engines

| Name | What it is | License | Maintenance | Size / embeddability | URL |
|---|---|---|---|---|---|
| Godot (SceneTree) | Scenes are node trees. `SceneTree.change_scene_to_file()` swaps the current scene. Docs recommend an autoload singleton plus `call_deferred` for custom transitions. | MIT | Pushed 2026-10-16; 4.7.2-stable, 2026-08-18 | Not embeddable (engine). Pattern only. | https://github.com/godotengine/godot |
| Defold (collection proxies) | Screens are collections loaded and unloaded through proxy components, driven by message passing (`load`, `enable`, `unload`). | Defold License 1.0 (Apache-derived, custom; SPDX NOASSERTION) | Pushed 2026-10-16; 1.14.0, 2026-10-12 | Not embeddable. Pattern only. | https://github.com/defold/defold |
| GDevelop (scenes + events) | Scenes plus an event sheet. "Change scene" is an action. Whole projects are JSON. | NOASSERTION in the API; core is MIT and the editor is separate (unverified, from memory) | Pushed 2026-10-16; v5.6.284, 2026-10-14 | Not embeddable. The JSON project format is a useful reference. | https://github.com/4ian/GDevelop |
| XState | Statecharts. Already covered in docs/03. | (see docs/03) | (see docs/03) | (see docs/03) | n/a |

### Canvas UI and menu libraries

| Name | What it is | License | Maintenance | Size / embeddability | URL |
|---|---|---|---|---|---|
| @pixi/ui | Button, slider, list, and input widgets for PixiJS. | MIT | Pushed 2026-10-02 | Requires the PixiJS renderer. Not usable with a bare Canvas 2D runtime. | https://github.com/pixijs/ui |
| Phaser RexUI (phaser3-rex-notes) | Large UI plugin suite for Phaser 3. | MIT | Pushed 2026-10-13 | Tied to Phaser. | https://github.com/rexrainbow/phaser3-rex-notes |
| KAPLAY (area + onClick) | Built-in hit-testing: shapes with `area()`, `onClick`, and hover. Already in docs/03. | MIT | Pushed 2026-10-16 | Part of the engine. | https://github.com/kaplayjs/kaplay |

No small, standalone, Canvas-2D-only menu library turned up in my search. I did not exhaustively check npm, so "none exists" is unverified. Hit-testing for rects, circles, and polygons is about 50 lines of code.

### Accessibility sources (web articles, not libraries)

| Source | What it says | Status | URL |
|---|---|---|---|
| MDN, "Hit regions and accessibility" | Fallback content inside `<canvas>`, `tabindex`, `role`, `aria-label`, and `drawFocusIfNeeded()`. The `addHitRegion` API was removed from browsers. This is from my memory, not a primary-source check. The search returned only a third-party mirror. | Reference | https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Hit_regions_and_accessibility |
| Chart.js accessibility guide | `role="img"` plus `aria-label` on the canvas, plus fallback content. | Reference | https://www.chartjs.org/docs/latest/general/accessibility.html |
| Koffeecup mobile game accessibility write-up | A hidden keyboard-navigable HTML grid over the canvas, and an ARIA live region for game events. | Practitioner article | https://www.koffeecup.net/blog-article/our-journey-for-accessible-games-and-the-challenges-we-unraveled |
| axe-core | Automated a11y checker that can run in the exported page under Playwright. | MPL-2.0; pushed 2026-10-15; v4.14.0, 2026-10-05 | https://github.com/dequelabs/axe-core |

Search results did not cover shadow DOM or `prefers-reduced-motion` as game-specific techniques. Both below are my own recommendations, not verified prior art. `prefers-reduced-motion` and `Gamepad API` are standard web platform features.

### Patterns worth copying

- **Flow as data, not code.** Godot's "scene = file, transition = call by path" and Defold's "screen = proxy, transition = message" both reduce to a graph of named nodes with edges. Our flow editor should emit `{ "nodes": {id: {scene, onEnter, onExit}}, "edges": [{from, event, to, transition}] }`. Transitions (fade, wipe, cut) should be an attribute of the edge.
- **Deferred switching.** Godot's `call_deferred` pattern: never swap scenes mid-update. Queue the transition and apply it at the frame boundary. This also helps determinism (layer 11).
- **Overlay stack for menus.** Pause, settings, and dialog screens should push and pop on a stack over the running scene. This is a common pattern in all three engines (the Defold and GDevelop details are from memory).
- **Parallel DOM mirror for accessibility.** Keep the single `<canvas>`, and add a visually hidden but focusable DOM layer of real `<button>` elements. Its labels and positions come from the same menu data the canvas draws from. Add an `aria-live="polite"` region fed by a `announce(text)` API. That gives native keyboard focus, screen-reader support, and a single source of truth.
- **Input abstraction.** One action map (`confirm`, `cancel`, `up/down/left/right`) fed by keyboard, pointer, and Gamepad API. Menus consume actions, never raw keys.
- **Reduced motion.** Read `matchMedia('(prefers-reduced-motion: reduce)')` once. Expose it as a runtime flag that shortens or removes screen shake, transitions, and flashing.
- **Automated checks.** Run axe-core against the exported `index.html` in Playwright (layer 11).

### Implication for our plan

- Engine flow code (Godot/Defold/GDevelop): **borrow pattern**. Data-driven graph, deferred transitions, overlay stack. None can be embedded.
- XState: **adopt only if already planned**. A flow graph this simple may not need a runtime dependency; a hand-rolled ~100-line interpreter keeps the exported file small. This is a judgment call, not verified by size measurement.
- @pixi/ui, RexUI: **ignore**. They are tied to other renderers.
- Canvas UI hit-testing: **custom is justified**. Nothing small and renderer-agnostic exists as far as I found.
- a11y shadow DOM mirror: **borrow pattern** (custom, small). No library does this for Canvas 2D that I found. The planned custom menu component should include it from the start, since retrofitting is harder.
- axe-core: **adopt** as a dev-time check in the exporter's test suite. It is not shipped in the game.

---

## Layer 11: Testing and determinism

### Tools

| Name | What it is | License | Maintenance | Size / embeddability | URL |
|---|---|---|---|---|---|
| Playwright | Browser automation. Offline mode via context options, screenshots, `toHaveScreenshot()`. | Apache-2.0 | Pushed 2026-10-16; v1.64.1, 2026-10-14 | Dev dependency; downloads browsers. Not shipped. | https://github.com/microsoft/playwright |
| Puppeteer | Alternative to Playwright. | Apache-2.0 | Pushed 2026-10-16 | Dev dependency. | https://github.com/puppeteer/puppeteer |
| pixelmatch | Pixel diff for same-size images; returns the mismatch count. | ISC | v8.0.0, 2026-10-06; pushed 2026-10-06 | `index.js` is about 24.7 KB in the repo (unminified, includes comments). Zero runtime dependencies per README (unverified in package.json). | https://github.com/mapbox/pixelmatch |
| jest-image-snapshot | Golden-image matcher for Jest, built on pixelmatch. | Apache-2.0 | Pushed 2026-10-06 | Dev only. Needs Jest. | https://github.com/americanexpress/jest-image-snapshot |
| reg-cli | Visual regression CLI producing an HTML report. | MIT | Pushed 2026-10-16 | Dev only. | https://github.com/reg-viz/reg-cli |
| skia-canvas | Canvas 2D for Node on Skia. | MIT | Pushed 2026-10-12; v4.0.0, 2026-10-12 | Native prebuilds; dev only. | https://github.com/samizdatco/skia-canvas |
| @napi-rs/canvas (Brooooooklyn/canvas) | Canvas 2D for Node on Skia via N-API, no system dependencies. | MIT | Pushed 2026-10-16; package.json version 1.0.11 (repo release tags are skia builds, e.g. `skia-95ee33d7-fcf7328d`, 2026-10-14) | Native prebuilds; dev only. | https://github.com/Brooooooklyn/canvas |
| node-canvas | Canvas 2D for Node on Cairo. | GitHub API reports no SPDX; I believe MIT (unverified, the LICENSE fetch returned nothing) | Pushed 2026-10-11; v3.2.3, 2026-03-31 | Needs Cairo and system libs, or prebuilds. | https://github.com/Automattic/node-canvas |
| jest-canvas-mock | Mock canvas context for Jest. | MIT | Pushed 2026-07-09 | Records calls only; no pixels. | https://github.com/hustcc/jest-canvas-mock |
| node-web-audio-api (IRCAM) | Rust-backed Web Audio for Node, including OfflineAudioContext. | BSD-3-Clause | Pushed 2026-10-12; no GitHub release (404) | Native; dev only. | https://github.com/ircam-ismm/node-web-audio-api |
| web-audio-api (audiojs) | JS Web Audio implementation. I did not check its API coverage or its Node versus browser status. | MIT | Pushed 2026-10-12 | Dev only. | https://github.com/audiojs/web-audio-api |
| rrweb | DOM-event record and replay. | MIT | Pushed 2026-10-15 | DOM-oriented; does not record canvas game state deterministically. | https://github.com/rrweb-io/rrweb |
| seedrandom | Seeded RNG for JS. | License field "none" in API (unverified; I believe BSD-style) | Pushed 2024-04-25 | Small, but stale. | https://github.com/davidbau/seedrandom |
| Godot headless flags | `--headless`, `--fixed-fps`, `--write-movie`, `--quit-after`, `--script`. Confirmed in the official docs source. | MIT (engine) | Current | n/a | https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html |

### Replay prior art (practitioner repos, not authoritative)

From search: several small projects converge on the same format. The issue and PR threads below are individual projects and I only read search snippets.

- agent-game-engine issue #13 proposes a replay holding engine version, content hash, seed, fixed timestep, initial config, input changes, optional checkpoints, and an expected final hash. https://github.com/aa22396584/agent-game-engine/issues/13 (repo not found by `gh api` at the owner/name I guessed, so repo state is unverified)
- amigo-engine PR #43: input replays, seeded RNG, one shared tick loop. The API reports NOASSERTION license and 3 stars. https://github.com/amigo-labs/amigo-engine/pull/43
- SysCommander PR #8 reports that `Math.sin`, `Math.cos`, and `Math.atan2` may differ in the last bits between JS engines, so a replay can diverge across browsers. It used mulberry32 for gameplay randomness. https://github.com/locutus75/SysCommander/pull/8
- craft-bowl PR #65 added a CI lint that rejects unseeded random calls in simulation modules, plus a replay-identical-checksum test. https://github.com/rwrife/craft-bowl/pull/65

### Patterns worth copying

- **Replay file = `{formatVersion, engineVersion, projectHash, seed, tickRate, inputs, checkpoints, finalStateHash}`.** Inputs are run-length encoded per tick as an action bitmask, not raw key events. Doom demos work the same way (tick-quantised input, no state). That Doom detail is from memory.
- **Fixed-step simulation, variable-rate rendering.** The simulation advances by whole ticks. Rendering interpolates. This is required for replays to match across machines.
- **One RNG, seeded from the project file or replay.** Visual-only effects (particles, screen shake) use a separate RNG that is excluded from the state hash. Lint for stray `Math.random()` and `Date.now()` in simulation code.
- **State hash checkpoints every N ticks.** Hash subsystems separately (RNG, entities, flow state) so a failing replay reports the first diverging tick and the subsystem.
- **Math determinism caveat.** Prefer arithmetic-only operations in the simulation. If trig is needed, use a lookup table or a pure-JS implementation.
- **Playwright against the exported file.** Open `file:///.../index.html`, set `context.setOffline(true)` and a route that aborts any `http(s)` request, fail the test on any request attempt, and fail on `console.error` or `pageerror`. This directly enforces the "one self-contained offline file" promise. Then drive the game with a recorded replay using a test hook (for example `window.__game.step(n)`) and screenshot at fixed ticks.
- **Golden images in two tiers.** Tier 1: a hash of the simulation state (exact, cross-platform). Tier 2: pixelmatch on screenshots with a small threshold, because anti-aliasing differs between Skia builds and browsers. Pin one renderer (Chromium via Playwright) for the goldens.
- **Audio tests.** Render the music or SFX graph through `OfflineAudioContext` (browser, or node-web-audio-api in Node), then assert on duration, peak level, non-silence, and optionally a spectral fingerprint. Do not compare raw samples across platforms.
- **Headless canvas for sprite and level renders.** skia-canvas or @napi-rs/canvas let the CLI render a sprite sheet or level PNG without a browser. Results will differ slightly from Chromium, so use them for agent preview, not for golden comparison.

### Implication for our plan

- Playwright: **adopt** for exporter artifact checks (offline, no network, screenshot, console errors). It replaces any planned custom browser harness.
- pixelmatch: **adopt** for tier-2 image diff. It is small and stable. jest-image-snapshot or reg-cli are optional wrappers; **ignore** unless a report UI is wanted.
- @napi-rs/canvas or skia-canvas: **adopt one** for CLI thumbnail and preview rendering. Pick one; both are MIT and maintained. I did not compare rendering fidelity or binary size.
- node-canvas: **ignore**. Same job, but needs native system libraries and I could not verify its license from the repo.
- Replay and RNG: **custom, borrow the format**. Nothing is a drop-in. Replay recording is about 100-200 lines once the runtime is fixed-step and single-RNG. rrweb is **ignore**: it records DOM mutations, not simulation input.
- seedrandom: **ignore**. Stale since 2024. A 10-line mulberry32 inline is enough and keeps the export small.
- OfflineAudioContext: **adopt** (platform feature) for audio tests. node-web-audio-api is optional for CLI-only audio rendering and is **unverified for our needs**.
- Design consequence: the runtime must expose a deterministic headless stepping API from day one. This is the main requirement from layer 11 on the runtime design.

---

## Layer 12: Agent-facing tooling precedents

### Game tools with CLIs or agent APIs

| Name | What it is | License | Maintenance | Size / embeddability | URL |
|---|---|---|---|---|---|
| Godot CLI | `--headless --script`, `--export-release`, `--check-only`, `--quit-after`, `--write-movie` (flags confirmed in docs source). | MIT | 4.7.2-stable, 2026-08-18 | Engine; used as a tool, not embedded. | https://github.com/godotengine/godot |
| Aseprite CLI | `--batch` (no UI), `--preview` (print actions without executing), `--save-as`, `--script`, sprite-sheet and JSON data export. Confirmed in the docs page. | Proprietary EULA; source visible, compile-it-yourself allowed (EULA.txt present in repo; terms not read in detail) | Pushed 2026-10-14 | Desktop app. | https://www.aseprite.org/docs/cli/ |
| Tiled CLI (`tiled --export-map`) | Convert maps to other formats. CLI flag details unverified. | NOASSERTION in API (mixed GPL/BSD, from memory) | Pushed 2026-10-12; v1.12.2, 2026-05-27 | Desktop app. | https://github.com/mapeditor/tiled |
| LDtk | Editor with JSON project format and JSON schema. Last release v1.5.3 is dated 2024-01-15 although the repo was pushed 2026-10-15. I did not verify an official CLI; the editor has command-line export in some builds (unverified). | MIT | Pushed 2026-10-15 | Desktop app. | https://github.com/deepnight/ldtk |
| Coding-Solo/godot-mcp | MCP server for Godot (launch editor, run project, capture debug output, scene edits). | MIT | Last commit 2026-04-16; no releases | Node. 6,117 stars. | https://github.com/Coding-Solo/godot-mcp |
| GDAI MCP | Commercial Godot MCP server; claims to create scenes and scripts, read errors, and verify output via screenshots (search snippet only). | Commercial (unverified) | Unverified | n/a | https://gdaimcp.com/ |
| CoplayDev/unity-mcp | Unity MCP server. One roundup says 25+ tools (unverified count). | MIT | Pushed 2026-10-08; 15,027 stars | C# package + Python server. | https://github.com/CoplayDev/unity-mcp |
| IvanMurzak/Unity-MCP | Unity MCP with a larger tool surface; roundup claims 100+ tools and runtime agents (unverified). | Apache-2.0 | Pushed 2026-10-16; 1.0.1, 2026-10-16 | Unity package. | https://github.com/IvanMurzak/Unity-MCP |
| CoderGamester/mcp-unity | Unity MCP server. | MIT | Pushed 2026-10-11 | Unity package + Node. | https://github.com/CoderGamester/mcp-unity |
| chongdashu/unreal-mcp | Unreal Engine MCP server. | Not set in API | Last push 2025-04-22 (stale at 18 months) | Unreal plugin + Python. | https://github.com/chongdashu/unreal-mcp |
| Phaser Game Agent MCP | Hosted agent service. Setup is one command (installs a global CLI, writes MCP config, browser sign-in). Builds code, art, and music in a private cloud workspace, publishes a preview, returns a play URL. Billed from $0.01 per minute. | Service (not open source; Phaser itself is MIT, v4.2.1, 2026-07-09) | Announced July 2026 | Hosted; not self-contained, not offline. | https://phaser.io/news/2026/07/phaser-game-agent-mcp-setup |
| Survey articles | Roundups of game MCP servers. Useful for discovery; claims unverified. | n/a | 2026 | n/a | https://dev.to/grove_chatforest/game-engine-3d-development-mcp-servers-unity-unreal-godot-roblox-phaser-and-more-4kk3 |

### Agent-friendly CLI conventions (primary source: clig.dev, CC-BY-SA-4.0, pushed 2026-05-16)

Confirmed in the fetched text: exit zero on success and non-zero on failure, with distinct codes for important failure modes; machine-readable output on stdout and messages on stderr; `--json` for JSON output; `-n/--dry-run` to describe changes without making them; `--no-input` to disable prompts; TTY detection; disable color and animation when not a TTY or when `NO_COLOR` is set. Source: https://clig.dev/ and https://github.com/cli-guidelines/cli-guidelines.

### Patterns worth copying

- **Project file as the API.** The strongest precedent is GDevelop, LDtk, and Tiled: the project is plain JSON, so any tool or agent can edit it without the GUI. LDtk ships a JSON schema (from memory). Our versioned JSON format plus a schema dump command follows this.
- **`--preview`/`--dry-run` that prints the plan.** Aseprite's `--preview` ("do not execute actions, just print what will be done") is a direct precedent for agent safety. Every mutating command should support `--dry-run` and print a diff or list of operations.
- **`--batch`/headless modes for everything.** Godot (`--headless`) and Aseprite (`--batch`) both treat "no UI" as a first-class mode. Our CLI should never need the studio.
- **Stable JSON result envelope.** Suggested shape: `{ok, command, data, warnings:[{code,path,message}], errors:[{code,path,message,hint}]}`. JSON Pointer paths into the project file let agents locate problems. This is my proposal; it is not copied from one tool.
- **Exit codes.** Suggested: 0 ok, 1 generic failure, 2 usage error, 3 validation error, 4 build/export error, 5 test/replay mismatch. Document them in `--help`.
- **Schema dump command.** `game schema` prints the JSON Schema for the current format version. `game describe <kind>` lists fields, examples, and enums. This is what MCP servers expose as tool schemas; the CLI can serve both.
- **Self-verification loop.** GDAI's pitch (per snippet) is write, run, read errors, screenshot, fix. Our CLI should offer `game check`, `game run --headless --ticks N --screenshot out.png`, and `game replay file`. These give agents the same loop without a GPU or window.
- **Thin MCP wrapper over the CLI.** Existing Godot and Unity MCP servers are mostly editor-bridging, which we do not need. For a JSON-file-plus-CLI design, an MCP server would only be a typed wrapper over the same commands. Phaser's MCP is hosted, which conflicts with the offline goal.
- **Quality caveat.** One 2026 survey (search snippet) argues that code-first, text-based engines suit agents best and that engine-specific languages invite hallucination unless grounded by docs or schemas. This supports shipping the schema dump and examples inside the CLI.
- **Staleness warning.** Of the MCP servers checked, Coding-Solo/godot-mcp (last commit 2026-04) and chongdashu/unreal-mcp (2025-04) are not recently updated; the Unity servers are active.

### Implication for our plan

- Aseprite/Godot CLI design: **borrow pattern** (`--batch`, `--preview`, headless as first-class).
- clig.dev conventions: **adopt** as the spec for the agent CLI (JSON output, exit codes, dry-run, no-input, stderr for messages). Nothing to build here beyond following it.
- Existing game MCP servers (Godot, Unity, Unreal): **ignore as dependencies**. They bridge to heavyweight editors; our editor is JSON files plus a CLI.
- MCP wrapper: **optional, later**. Build the CLI first; an MCP server is a thin typed layer over it. No existing tool makes the CLI itself unnecessary.
- Phaser Game Agent MCP: **ignore as a dependency, note as competitor/precedent**. Hosted, paid, not offline or one-file. It validates the "agent builds game, returns playable URL" workflow, which our `export` command can match locally.
- JSON Schema generation: Ajv is already in docs/03. Confirm the schema is generated from one source (the TypeScript types or a schema file) so `game schema`, validation, and studio forms stay in sync. This is a recommendation, not a verified requirement.

---

## Cross-layer: anywhere an existing tool makes a planned custom component unnecessary

- Browser harness for exporter checks: use **Playwright**; do not build one.
- Image diff: use **pixelmatch**; do not write a differ.
- CLI-side canvas rendering for previews: use **@napi-rs/canvas or skia-canvas**, not a custom rasteriser.
- CLI conventions: follow **clig.dev**; no design work needed.
- Accessibility auditing: use **axe-core** in tests.
- Still custom (no suitable prior art found): deterministic replay recorder, canvas menu hit-testing with DOM mirror, flow-graph interpreter, JSON result envelope for the agent CLI.
