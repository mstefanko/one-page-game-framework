# Arcade phrases: musical rules and evidence

Arcade turns character actions into short, editable musical gestures. The selected track supplies the musical role; the weapon supplies the instrument and its articulation. Faster action increases phrase density and velocity while the accompaniment keeps the song's BPM. This makes action sound more urgent without creating a second clock.

## What the project actually knows

`packages/project/src/index.ts` stores major, minor or chromatic scale metadata, tempo, meter, tracks, patches, patterns and repeated/transposed clips. It has no authored chord-symbol timeline. A key or scale is a pitch vocabulary, not evidence that a particular chord is sounding now. Even automated key analysis can have alternate interpretations; music21 exposes both certainty and alternative keys. This implementation uses the stored metadata and makes no automatic key-detection claim. [music21: Keys and KeySignatures](https://music21.org/music21docs/usersGuide/usersGuide_15_key.html).

`packages/music-core/src/arcade.ts` therefore separates three reported sources:

| Source        | Available evidence                                                                         | Behavior                                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `score-notes` | Pitched harmony notes sounding at the generated note's time; otherwise sounding bass notes | Favor these pitch classes at the launch, quarter-note beats and ending. A single bass pitch provides an anchor without implying a chord name. |
| `scale`       | Major, natural minor or chromatic metadata only                                            | Stay in that vocabulary. Do not display a chord or guarantee consonance with unknown harmony.                                                 |
| `percussion`  | Explicitly selected drum track                                                             | Generate rhythmic drum gestures; exclude drums from pitched harmony evidence.                                                                 |

Harmony evidence respects clip start, repeats, transposition and note duration. It excludes the selected track to avoid having a gesture follow its own target voice, plus silent notes, tracks with zero gain, and noise patches. The full original song remains audible beneath the performance. The current writing mode plays all energy layers, so every otherwise audible harmony/bass layer may contribute. If future playback exposes arbitrary track mutes or energy filtering, pass the same eligibility rules into the generator before claiming to follow the audible accompaniment.

## Why these rules

**Use recurring musical ideas.** A motive is an identifiable musical idea that can recur and be altered. For a strike, the generator borrows up to four notes from the selected active pattern and reuses their relative scale contour, bounded to four scale steps from the first note. When there is no motif, it uses a small return gesture. Leap, dash and guard have stable contours so the player can learn their sound. These are product defaults rather than a model trained on the song. [University of Puget Sound: Motive](https://musictheory.pugetsound.edu/mt21c/MotiveSection.html).

**Separate chord tones from scale tones.** A scale tone can still be a non-chord tone. Non-chord tones are described by their approach and departure as well as their relationship to the chord. We reserve observed accompaniment pitches for important gesture anchors and allow short scale motion between them. This is a simple heuristic, not a complete implementation of passing-tone, suspension or counterpoint rules. In chromatic mode, every generated note favors the observed accompaniment when available; without accompaniment it remains an explicitly chromatic gesture. [University of Puget Sound: Introduction to Non-Chord Tones](https://musictheory.pugetsound.edu/mt21c/NonChordTonesIntroduction.html).

**Keep a connected voice.** Voice leading concerns how musical parts move, including economy of melodic motion. `previousPitch` makes the next phrase begin near the last pitch within the selected register. Nearby observed harmony notes are preferred to arbitrary octave jumps. This supports continuity without imposing the full rules of four-part chorale writing on a game instrument. [University of Puget Sound: Voice Leading](https://musictheory.pugetsound.edu/mt21c/VoiceLeading.html).

**Quantize at the audio clock.** MIDI quantization aligns note timing to a chosen grid; it can affect starts and ends separately. Arcade places the gesture at or after the action on a sixteenth-note grid anchored to the capture loop, then schedules the actual notes against the existing audio clock. Notes are never launched before the player's action. Visible character response can remain immediate. At 120 BPM the longest grid wait is less than 125 ms. [Ableton: Editing MIDI](https://www.ableton.com/en/live-manual/12/editing-midi/).

**Increase activity before changing BPM.** Ableton's rhythm tools expose note density, step duration and accents as distinct musical controls. Arcade uses the same separation: speed changes the note rate and emphasis within a fixed quarter-note span. The claim that this conveys urgency is our design hypothesis, to be judged by playing and listening; the manual establishes the independent controls rather than a universal emotional effect. [Ableton: MIDI Tools, Rhythm](https://www.ableton.com/en/live-manual/12/midi-tools/#rhythm).

## Concrete defaults

All gestures span at most 480 ticks, one quarter note at the project's 480 PPQ. This remains a quarter-note unit in meters whose denominator is not 4. No separate beat-clock interpretation is inferred from the denominator.

| Aggression | Ordinary gesture onsets, relative ticks | Guard onsets     | Base velocity |
| ---------- | --------------------------------------- | ---------------- | ------------- |
| 1, calm    | 0, 240                                  | 0                | 0.64          |
| 2, driving | 0, 120, 360                             | 0, 240           | 0.76          |
| 3, fierce  | 0, 120, 240, 360                        | 0, 120, 240, 360 | 0.88          |

The first note gets an additional 0.06 accent. Alternating later notes receive a 0.02 reduction. Ordinary notes occupy 75% of their slot; guard notes occupy 95%. All note ends are clipped to the capture loop and all values fit the ordinary score note schema.

| Action | Fallback scale-degree contour | Intent                                           |
| ------ | ----------------------------- | ------------------------------------------------ |
| Strike | 0, +2, +1, 0                  | Motif or short answer                            |
| Leap   | 0, +2, +4, +1                 | Rising gesture with a return at higher densities |
| Dash   | 0, +1, +2, +3                 | Ascending run                                    |
| Guard  | 0, 0, 0, 0                    | Sustained/reiterated anchor                      |

Lower densities use the beginning of the contour. Observed harmony anchors can alter individual pitches, so the table describes the gesture direction rather than a promise of exact intervals.

Default MIDI ranges are melody 60–84, harmony 48–72, bass 36–60. An explicit register offset is bounded to ±24 semitones. Minor metadata means natural minor intervals `[0,2,3,5,7,8,10]`; harmonic or melodic minor alterations are not invented. Observed accompaniment anchors may legitimately lie outside those metadata intervals. The score itself is never changed by phrase generation.

Weapon selection should keep these gestures available across pitched timbres: a short pulse/pluck, a smoother triangle/sine voice, or a brighter saw lead. Choosing a weapon must retain its patch when the take is kept, so later playback matches the audition. Bass and percussion are explicit selected track roles rather than hidden meanings of jump/attack. Pitched lead performance is the default composition experience.

Actual tempo modulation was rejected for this increment because a local tempo multiplier would separate the generated notes from the accompaniment. A future tempo control would need one shared transport mapping for the backing score, phrase queue, capture ticks and visual playhead, plus an authored policy for recording tempo changes.

## API and validation

`createArcadePhrase` is pure and deterministic. Inputs are the score, selected track, action, aggression, audio-clock position, capture loop bounds, and optional previous pitch, sequence and register offset. `notes` have **loop-relative** editable positions. Result `startTick` and `endTick` have **absolute score** positions for scheduling. A launch that would reach or pass the loop end returns an empty phrase; the caller can retry a held action on the next pass. It never wraps a delayed note into an earlier moment.

The caller owns gesture cooldown, cancellation, live scheduling, unique take IDs, selected patch and the final save operation. Directly inspecting the currently sounding repeat avoids expanding every repeated note of a long score. This module does not own timers, React state or Web Audio resources.

The focused tests cover all supported scale modes across twelve roots, deterministic output and score immutability, density/velocity, nonzero capture starts, short loops and end boundaries, changing/repeated/transposed harmony, exclusions from harmony evidence, bass-only anchors, motif reuse, registers and malformed numeric inputs.
