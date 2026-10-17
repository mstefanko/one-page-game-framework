# Original fixture provenance

The following fixtures were newly authored as code and note sequences for this implementation on October 17, 2026. They are not transcriptions or samples from NES/SNES/arcade games. Authorship credit: One-page game framework contributors (AI-assisted). License: the repository's MIT license, including editable reuse and exported audio.

| Asset identity | Source | Contents |
|---|---|---|
| `midnight-delivery` | `packages/project/src/index.ts` | Minor pulse melody, bass, held harmony and percussion |
| `tiny-triumph` | same | Ascending major fanfare |
| `moss-lantern` | same | Spaced melodic intervals and backing |
| `copper-giant` | same | Repeated pulses and percussion |
| `clockwork-steps` | same | Explicit 6.5-beat phrase |
| `pocket-sunrise` | same | Major descending theme |
| `lantern-arrival` | `packages/music-editor/src/game-audio.ts` | Original victory phrase |
| `step`, `strike`, `win` | same | Synthesized sound-effect recipes |
| Lantern Courier preview | `packages/music-editor/src/LanternGameAudio.tsx` and CSS | Original layout and interaction fixture using text/CSS shapes |
| Reedrunner character and arena | `packages/music-editor/src/Arcade.tsx` and `arcade.css` | Original SVG character, four weapons and CSS scenery/animation |
| Arcade phrase rules and weapon patches | `packages/music-core/src/arcade.ts` and `packages/music-editor/src/Arcade.tsx` | Original musical heuristics and procedural synth settings; generated phrases may derive from the user's selected song |
| Synth drum buffers | `packages/music-web-audio/src/index.ts` | Algorithmically synthesized kick, snare and hats; no recordings |

The score schema does not yet provide general author/license/provenance fields for arbitrary user assets. That is a follow-on schema/interface task before a public sharing library. Personal imports and exports must not be assumed MIT merely because the editor is MIT. Starter identification and this provenance table are retained in the repository; portable source packs currently carry musical content, not a complete licensing record.
