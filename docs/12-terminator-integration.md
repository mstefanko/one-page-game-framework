# Local Terminator game integration

The Game audio view embeds the actual single-file **Terminator: Liquid Metal** game supplied by the user, with its existing Canvas gameplay, cinematic renderer, authored native music and sound effects. The original Lantern Courier example remains available through the **Game preview project** selector as a portable original fixture. If no local game is imported, the composer displays import instructions.

## Import and run

From the framework checkout, run:

```sh
npm run import:terminator -- /absolute/path/to/terminator-game-repo/index.html
npm run dev
```

Open the composer, choose a song, and select Game audio or Preview game beside editor. Reload the page after reimporting source. The importer reads the source without modifying its repository, extracts its procedural score builders, converts the results to validated canonical Scores, bundles the preview adapter and injects it into a generated local copy. It records a SHA-256 source revision. Expected unique source markers and generated classic-script syntax are checked before writing output. This is a version-specific adapter: changed source structure can require adapter updates rather than speculative import.

The input is **trusted local source code**. The importer evaluates its score-builder section with a time limit; Node's `vm` is not a security sandbox for untrusted input. The importer never fetches source or assets from the network.

The current supplied source imports 28 contexts, 23 music scores and 33 native sound effects. Music and effects have separate stable identities, including `shop` music and `sfx-shop` effect. Contexts cover the title and character menu, map, shop, eight campaign stages with separate briefings, five cinematics, ending, round win and death. Music usage mappings follow the native state/audio selector. Cinematic SFX mappings identify authored events. Gameplay SFX mappings are **possible role-dependent actions**, not a claim that every effect is automatically triggered at every stage; the UI labels them accordingly. Effects without a context mapping remain directly auditionable.

## Editing beside the real game

Select a cue target and choose **Edit original** to copy its original music into a new editable draft, **Edit assigned** for a pinned version, or **Start fresh with game** for an empty compatible loop. The same game stays mounted beside Sketch and Studio. In **Working score · live**, the editor plays the draft while the game runs its simulation and native sound effects. Live edits join at the next loop; **Hear edits now** restarts the music without resetting the game. The working loop continues across scene changes. Original and saved playback remain separate source choices.

**Pin working score to [cue]** saves an independent canonical Score snapshot to this browser's project store. Later draft edits do not mutate it. **Saved assignments** auditions each scene's explicit pin; **Original game music** auditions the original without deleting the pin. **Return to original** in the full catalog removes an override. Export/import assignments creates a separate JSON backup tied to the exact source SHA-256; neither action writes into the source repository. A revision mismatch disables assignment mutations and offers **Export previous assignments** for recovery. See the [implementation plan](16-compose-with-game.md).

## Runtime and ownership

Every checkpoint is a deterministic fresh T-800 run using seed 426, restored through the game's own setup/state APIs. Reset restores the selected context's start. Checkpoint IDs accept only `start`; unsupported seeks are not advertised. Loading a cinematic invokes its actual storyboard, and native input remains playable inside the iframe. The character menu also permits the game's normal role selection.

The shared preview bridge checks exact `MessageEvent.source`, exact HTTP(S) origin, session token, bounded payload, catalog identities and capability declarations before commands execute. The importer and iframe are served from the composer's configured origin; this is an explicitly trusted same-origin adapter, not an arbitrary URL embed. The host catalog must exactly match the imported project. The optional `auditionSfx` capability runs native effect recipes in the child and rejects music IDs, unknown IDs and malformed payloads.

The child runtime owns original/saved music and all game effects; working music belongs to the editor after an acknowledged source handoff. Connecting initially stops the composer engine. Original native music and SFX remain in the game's audio graph. While a canonical override is sounding, the child mutes/retires native music and plays the draft through the same production AudioEngine used by the editor/exporter; original native effects remain available. Native mute also stops canonical overrides. Returning to an unmodified cue restores native music gain. Pause, reset, visibility loss, disconnect and unmount stop canonical voices, detach old native SFX/music buses, suspend native audio and clear temporary overrides as appropriate. Explicit Play game resumes the selected context. Editor Play/Stop controls working music independently. Returning to runtime ownership re-requests the current cue so saved assignments restore even without a scene change. Autoplay policies can require clicking inside the game before Play can enable sound.

Preview save keys use a separate namespace, so exploring ending/death checkpoints does not unlock characters or overwrite the player's original game saves.

## Content and distribution boundary

Generated `apps/composer/public/local-games/` contains the supplied fan-game source, embedded artwork and derived musical material. It is ignored by Git and is not licensed by the framework's MIT license. Do not commit or redistribute that output with the framework. The normal production build explicitly excludes local game imports from `dist`; development serves them for local work. The public build remains fully usable with original fixture and missing-import instructions. See [NOTICE](../NOTICE.md).

## Verification

Portable checks use original synthetic score/source fixtures and require no Terminator material:

```sh
npx vitest run packages/music-editor/src/terminator-project.test.ts packages/music-editor/src/preview-bridge.test.ts
npx playwright test tests/browser/terminator.spec.ts
```

The missing-source browser test always runs. The real-game browser check runs only when local ignored source is present; otherwise it skips with import instructions. It verifies native checkpoint loading/playback, draft audio ownership, pause/reset and browser console errors. Unit checks validate fractional timing/repeat boundaries, manifest/reference rejection, ambiguous source markers, literal script embedding, SFX capability boundaries and the existing bridge origin/session lifecycle protections. Physical mobile touch/audio behavior still needs device testing.
