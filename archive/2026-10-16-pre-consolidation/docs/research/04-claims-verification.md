# 04 - Claims verification (docs 01, 02, 03)

Date checked: 2026-10-16. Scope: external tools, libraries, licenses, browser APIs and the pinned GitHub links. The reference game's internals were not evaluated beyond link spot checks. Docs 01/02/03 were not edited.

Verdict tally (47 claims): CONFIRMED 36, PARTLY TRUE 8, UNVERIFIABLE 3, WRONG 0, OUTDATED 0.

---

## (a) Material corrections (things that change a decision)

1. **vite-plugin-singlefile is missing from docs 02/03 (doc 03 sec 7, doc 02 sec 13).** MIT, v2.3.3, supports Vite 5-8. It inlines JS and CSS into one `index.html`. Limits: single entry only, `public/` is not inlined, tested on Chromium `file://`. It is a ready-made option, or at least a reference, for the exporter. Vite's `build.lib` mode always inlines assets. Decide build-vs-adopt before writing a custom exporter.
   https://github.com/richardtallent/vite-plugin-singlefile
2. **Theatre.js is effectively dormant (doc 02 sec 10).** Core Apache-2.0 / studio AGPL-3.0 split is correct. But the last public commit is 2024-04-11 (pushed 2024-08-14) and the last npm release is 0.7.2 on 2024-05-19. "Private development toward the next version" understates the risk; treat it as unmaintained for planning.
   https://github.com/theatre-js/theatre , https://www.npmjs.com/package/@theatre/core
3. **Tone.js Transport default PPQ is 192, not 480 (doc 02 sec 9).** Matters only if Tone is adopted later; PPQ is settable but must be set before other objects are created. Own 480 PPQ is fine: exact for quarter to 128th notes, triplets through 64th, quintuplets (96/192/48/24) and dotted values. NOT exact for septuplets or 9/11/13-tuplets.
   https://github.com/Tonejs/Tone.js/blob/main/Tone/core/clock/Transport.ts
4. **File System Access `showDirectoryPicker` is Chromium-only (doc 02 sec 11).** Chrome/Edge 86, Chrome Android 132; not in Firefox or Safari. The baseline must be OPFS (all browsers) + `<input webkitdirectory>` + ZIP export. Safari `createWritable` on OPFS needs Safari 26.
   https://developer.mozilla.org/docs/Web/API/Window/showDirectoryPicker
5. **iOS Web Audio caveats (doc 01 sec 6, doc 02 sec 9).** Unlocking via a user gesture is not enough: the silent switch mutes Web Audio unless `navigator.audioSession.type = 'playback'` (experimental, feature-detect). The context can also enter `interrupted`. Add both to the audio design.
   https://developer.mozilla.org/docs/Web/API/AudioSession
6. **`file://` localStorage is undefined (doc 01 sec 5, doc 02 sec 5).** MDN states behaviour is unspecified; today browsers scope per file, but origins can be opaque. GitHub Pages project sites share one origin (`user.github.io`; path is not part of the origin), so the doc 02 key-namespace plan is required, not optional. Do not rely on save data for exported single-HTML files opened from disk.
7. **Determinism (doc 02 sec 15):** the hedge is correct. ECMAScript leaves `Math.sin/cos/exp/...` implementation-approximated. Avoid transcendental functions in authoritative simulation (use tables or integer/fixed-point).
   https://tc39.es/ecma262/#sec-function-properties-of-the-math-object

---

## (b) Claims table

| # | Claim (short) | Doc / section | Verdict | Evidence | Correction |
|---|---|---|---|---|---|
| 1 | LittleJS is MIT, no dependencies | 03 table/s1 | CONFIRMED | https://github.com/KilledByAPixel/LittleJS | - |
| 2 | LittleJS fixed 60 FPS update | 03 s1 | CONFIRMED | same repo README | - |
| 3 | LittleJS bundles ZzFX audio, tilemap collision | 03 s1 | CONFIRMED | same | - |
| 4 | LittleJS FAQ: ship folder or Vite `dist/` | 03 s1 | CONFIRMED | same | - |
| 5 | Phaser is MIT | 03 table | CONFIRMED | https://github.com/phaserjs/phaser | - |
| 6 | Phaser loader supports base64 types | 03 s2 | CONFIRMED | https://docs.phaser.io/ | - |
| 7 | Phaser Editor has separate licence | 03 s2 | CONFIRMED | https://phaser.io/editor | - |
| 8 | Phaser Feb 2026 news link valid; v4.2.1 current | 03 s2 | CONFIRMED | https://phaser.io/news | - |
| 9 | Excalibur BSD-2-Clause | 03 s3 | CONFIRMED | https://github.com/excaliburjs/Excalibur | - |
| 10 | Excalibur events frame/end/loop | 03 s3 | CONFIRMED | https://excaliburjs.com/docs/ | - |
| 11 | Excalibur zip hosting guide; v0.32.0, pre-1.0 | 03 s3 | CONFIRMED | https://excaliburjs.com/docs/ | - |
| 12 | Excalibur graphics base cited as "Sprite" | 03 s3 | PARTLY TRUE | https://excaliburjs.com/docs/graphics/ | Cite the Graphics / GraphicsComponent page: graphics split into Sprite-based and Raster-based; GraphicsComponent centers by default. |
| 13 | KAPLAY MIT | 03 s4 | CONFIRMED | https://github.com/kaplayjs/kaplay | - |
| 14 | KAPLAY component id/hooks | 03 s4 | CONFIRMED | https://kaplayjs.com/docs | - |
| 15 | KAPLAY allows single index.html | 03 s4 | CONFIRMED | https://kaplayjs.com/docs | - |
| 16 | ct.js MIT | 03 s5 | CONFIRMED | https://github.com/ct-js/ct-js/blob/develop/LICENSE | Historic note: GPL-3 for ~4 days in Aug 2019, then MIT. |
| 17 | ct.js uses PixiJS; web export = zip (v5.3.1) | 03 s5 | CONFIRMED | https://github.com/ct-js/ct-js | - |
| 18 | GDevelop Core/GDJS/IDE/Extensions MIT | 03 s5 | CONFIRMED | https://github.com/4ian/GDevelop | Name/logo reserved. |
| 19 | GDevelop local export = folder | 03 s5 | CONFIRMED | https://wiki.gdevelop.io/ | - |
| 20 | GDevelop asset/extension licence exceptions | 03 s5 | UNVERIFIABLE | repo licence files cover folders only | Per-asset licences vary; do not generalise. |
| 21 | Bitsy saves/imports .html | 03 s5 | CONFIRMED | https://make.bitsy.org/docs/tools/game/save | - |
| 22 | PICO-8 export: `.html + .js`, `-f` folder, `-p` template | 03 s5 | CONFIRMED | https://www.lexaloffle.com/pico-8.php (manual) | - |
| 23 | PICO-8 `-w` wasm needs web server; no native single-file | 03 s5 | CONFIRMED | PICO-8 manual | - |
| 24 | LDtk defs vs levels, jsonVersion 1.2.2, schema, separate level files | 03 s6 | CONFIRMED | https://ldtk.io/json/ | Re-check jsonVersion at implementation time. |
| 25 | Tiled properties/classes/templates, overridden-property semantics | 03 s6 | CONFIRMED | https://doc.mapeditor.org/en/stable/manual/ | - |
| 26 | Aseprite CLI `--data`, `--list-tags`, `--list-slices` | 03 s6 | CONFIRMED | https://www.aseprite.org/docs/cli/ | - |
| 27 | Aseprite exports pivot in JSON | 03 s6 | PARTLY TRUE | source `doc_exporter.cpp` (aseprite/aseprite) | Confirmed in source; the docs example omits pivot. |
| 28 | Ajv type-guard narrowing | 02 s3 | CONFIRMED | https://ajv.js.org/guide/typescript.html | - |
| 29 | Ajv `JSONSchemaType` (no union support) | 02 s3 | CONFIRMED | same | - |
| 30 | Tone.js MIT, `Tone.start()`, callback-timing warning | 02 s9 | CONFIRMED | https://tonejs.github.io/docs/ | - |
| 31 | Transport PPQ 480 | 02 s9 | PARTLY TRUE | Tone source (see correction 3) | Tone default is 192. 480 is the doc's own choice, which is fine. |
| 32 | OfflineAudioContext broadly supported | 02 s9 | CONFIRMED | https://developer.mozilla.org/docs/Web/API/OfflineAudioContext (Safari 14.1) | - |
| 33 | Theatre.js core Apache-2.0 / studio AGPL-3.0 | 02 s10 | CONFIRMED | https://github.com/theatre-js/theatre | - |
| 34 | Theatre.js private development toward next version | 02 s10 | PARTLY TRUE | npm 0.7.2 (2024-05-19), last commit 2024-04-11 | Dormant; see correction 2. |
| 35 | esbuild iife default when bundling | 02 s13 | CONFIRMED | https://esbuild.github.io/api/#format | - |
| 36 | esbuild `dataurl` loader | 02 s13 | CONFIRMED | https://esbuild.github.io/content-types/ | - |
| 37 | esbuild metafile | 02 s13 | CONFIRMED | https://esbuild.github.io/api/#metafile | - |
| 38 | esbuild legalComments inline/eof | 02 s13 | CONFIRMED | https://esbuild.github.io/api/#legal-comments | Default is eof when bundling; linked/external create extra files, bad for single-file output. |
| 39 | Vite `?inline` / `?raw`, `assetsInlineLimit` 4096, public dir copied as-is | 02 s13 | CONFIRMED | https://vite.dev/guide/assets | - |
| 40 | No existing single-file option for Vite exporter | 02 s13 / 03 s7 | PARTLY TRUE | vite-plugin-singlefile | See correction 1. |
| 41 | XState transition actors | 02 s2 | CONFIRMED | https://stately.ai/docs/transition-actors | Site shows v6 alpha; npm stable is 5.33.2. |
| 42 | File System Access / OPFS for projects | 02 s11 | PARTLY TRUE | MDN | Directory picker Chromium-only; see correction 4. |
| 43 | localStorage per-origin; Pages shared origin | 01 s5, 02 s5 | PARTLY TRUE | MDN Web Storage; `file://` undefined | See correction 6. |
| 44 | AudioContext needs user gesture; iOS unlock | 01 s6 | PARTLY TRUE | MDN Autoplay guide, AudioSession | See correction 5. |
| 45 | JS Math determinism is hedged | 02 s15 | CONFIRMED | ECMA-262 | See correction 7. |
| 46 | iOS context can become `interrupted` | 01 s6 | UNVERIFIABLE | MDN lists the state; not reproduced on device | Test on device. |
| 47 | Cross-engine Math output equality | 02 s15 | UNVERIFIABLE | spec permits differences; no cross-engine test run | Avoid reliance. |

Final tally from the table (rows 1-47): CONFIRMED 36, PARTLY TRUE 8, UNVERIFIABLE 3, WRONG 0, OUTDATED 0. (PARTLY TRUE rows: 12, 27, 31, 34, 40, 42, 43, 44.)

### Pinned GitHub link spot checks

- `github.com/mstefanko/terminator-game` at `00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0`: resolves. `index.html` is 930,196 bytes / 11,805 lines, matching doc 01.
- All 42 non-anchored links in the docs returned HTTP 200.

### Broken or dubious links

- Bitsy zh-Hans locale URL in doc 03: works but is the wrong locale. Use https://make.bitsy.org/docs/tools/game/save
- Excalibur "Sprite" citation for "graphics base": weak; use https://excaliburjs.com/docs/graphics/
- Source anchor `L7833` labelled "scheduler and routing" lands on `PLAY_TEMPOS`, not the scheduler. Re-point the anchor.

---

## (c) Missed facts to add to the docs

- vite-plugin-singlefile (MIT, v2.3.3, Vite 5-8, single entry, `public/` not inlined, Chromium-tested `file://`); Vite `build.lib` always inlines assets.
- Theatre.js maintenance status (no commits since April 2024, no release since May 2024).
- Tone.js Transport PPQ default 192; PPQ settable but only before other objects exist.
- 480 PPQ divisibility: 480 = 2^5 x 3 x 5; exact for binary subdivisions to 128th, triplets, quintuplets, dotted; inexact for 7/9/11/13-tuplets.
- `showDirectoryPicker` browser matrix (Chromium only); OPFS as universal baseline; Safari OPFS `createWritable` needs Safari 26; fallback `<input webkitdirectory>` and ZIP.
- iOS silent switch behaviour and `navigator.audioSession.type = 'playback'` (experimental, feature-detect); `interrupted` AudioContext state.
- `file://` storage is unspecified; GitHub Pages project sites share one origin.
- ECMAScript allows implementation-approximated Math functions; prefer integer/fixed-point or lookup tables in the authoritative simulation.
- esbuild `legalComments` defaults: eof when bundling; linked/external produce extra files.
- Aseprite pivot is exported in JSON even though the docs example does not show it.
- ct.js briefly GPL-3 (Aug 2019) before MIT; GDevelop name/logo reserved despite MIT code.
