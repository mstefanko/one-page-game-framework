# Reedrunner musical Arcade (initial experiment)

The current controls and execution plan are in [Arcade experiments](15-arcade-experiments.md). This document records the first per-action gesture implementation; its capture and phrase-launch behavior has been replaced following playtest feedback.

The Arcade is an original playable character performance surface for the existing song. Reedrunner carries a visible weapon, and strike, leap, dash and guard generate short musical gestures. The full song stays audible underneath. Generated phrases use the selected part's motif, sounding accompaniment and scale through `createArcadePhrase` in `@onepage/music-core`; percussion parts use kit pitches. This is a deterministic local composition tool, without a model/network dependency or imported character art.

## Interaction and music

- Focus the arena to use J (strike), K/up/W (leap), left/right/A/D (dash), and I/down/S (guard). L also dashes; 1–4 are aliases within the arena. Escape stops. Space starts or stops only the Arcade while the arena has focus.
- Each action produces one beat of notes at most. Calm, driving and fierce use eighth notes, syncopation and sixteenth notes respectively; guard uses fewer sustained pulses. An action launches at the next sixteenth boundary and cannot spill past the capture range. The selected clip determines the capture start/length, including clips later in the song.
- Automatic intensity estimates recent action spacing. Rapid playing produces denser, stronger phrases. The explicit intensity selector provides the same three choices. Neither changes BPM. The song settings remain the explicit place to change tempo.
- The character moves across the arena, faces the direction of travel, jumps, swings its weapon, dashes or braces. A four-step light marks the current beat subdivision. Reduced-motion preferences disable animation. Pointer controls provide every musical gesture and both dash directions.
- Holding a key or pointer repeats one phrase per beat using the audio clock. OS key-repeat events do not create additional phrases. Pointer release/cancel/lost capture and arena focus loss release held inputs. Window blur, hidden document, unmount, explicit stop and audio-context interruption cancel playback. Short tap animations remain visible after release.
- The keyboard handler lives on the focused arena; typing in song fields does not perform gestures. Pointer buttons also support keyboard/assistive activation.

## Weapons and editable takes

Pulse blade, Moon staff, Ember bow and Reed glaive have distinct pulse, sine, sawtooth and triangle patches, along with different envelopes and brightness. Drum-role weapons use the noise kit with those envelopes. Weapons can change during a running performance. Each weapon/kit lane retains its own patch and notes, and keeps its part role.

Takes are controlled by Composer state rather than stored only inside the mounted Arcade. Switching editing surfaces or game views preserves the take; the editor shows a return-to-Arcade banner. Unkept notes participate in part/song navigation guards and the browser's before-unload warning. They become saved score data only after Keep; Discard is explicit.

Keep opens the existing new-part/replace choice. A multiweapon take creates one ordinary track, pattern and clip per instrument in a single undoable score edit, retaining the original song. Replacing a phrase is available for a single weapon; multiweapon replacement is disabled with an explanation because a track has one patch. For replacement on a transposed clip, pitches are inverse-transposed before storage so playback reproduces what the performer heard. Invalid inverse-transposed MIDI pitches produce a recoverable error with the new-part alternative. Shortened destination patterns are rejected rather than silently truncating Arcade notes. Undo restores notes and patches together.

Closing or escaping the Keep dialog clears its pending snapshot while preserving the original take. This permits a later Discard without a stale pending take blocking navigation. Delayed game-snapshot loads also capture a navigation generation and score identity, then recheck current unkept-take refs immediately before opening the result. A newly started take or newer navigation prevents that asynchronous result from replacing current work.

The take limit is 2,048 notes. A phrase that would exceed it is refused as a whole with an explicit message; existing notes remain available to keep or discard.

## Clock alignment

`createArcadePhrase` returns loop-relative editable notes plus an absolute launch tick. The UI asks `AudioEngine.getDelayToTick` once for that launch, then adds each note's tick offset. `previewNote` schedules voices against the same audio clock as the song, including transport preroll. This avoids immediate free-time auditions of notes that will later be stored on a grid. The existing engine's stop cancels both active and scheduled voices.

## Validation

`tests/browser/arcade.spec.ts` covers multiweapon playback and retained patches, separate editable tracks, one-step undo/redo, held/repeated controls, movement, focus release, pointer cancellation, mobile overflow, transposed replacement parity against auditioned pitches, and Keep-cancel-discard navigation recovery. The existing Composer Arcade integration case now captures a two-note musical gesture and explicitly selects the original Lantern Courier fixture when testing its game catalog.

Visual QA artifact: `.local/arcade-validation.png` (ignored local screenshot), inspected at desktop width. The SVG character, weapon artwork and arena composition are original code-native assets. No copied game character or external sprite is used.
