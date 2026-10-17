# Arcade experiments: plan, implementation, and evaluation

The original action-to-small-phrase prototype made frantic tapping the main way to develop music. These experiments move the musical unit up to an idea that has time to unfold. The default should be enjoyable with one deliberate move and support variation without a pile of overlapping phrases.

## Candidates and recommendation

| Experiment                             | What the player does                                                                      | Musical unit                                           | Why build it                                                                                                                       |
| -------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Phrase Rider — recommended default** | Select Motif, Rise, Answer, Resolve, or Rest; move the character with arrows              | One repeating bar, changed at a bar boundary           | A recognizable song idea can develop coherently. Repeated tapping selects intent rather than adding voices.                        |
| **Groove Fighter**                     | Maintain a pocket, request an offbeat variation, throw a turnaround fill, or drop to kick | Persistent one-bar kit pattern; fill returns to pocket | Rhythm has a stable backbone. Drum capture has its own role regardless of the selected part.                                       |
| **Ribbon Lead**                        | Hold a key or drag a pitch ribbon; lift, fall, hold, or release                           | One scale step per sixteenth, with a live gate         | Offers direct individual-note expression and fluid motion. Pitch height uses a deadband and moves through neighboring scale tones. |

Phrase Rider is the default because it offers useful musical continuity with the fewest controls. Groove Fighter provides a rhythm-first alternative. Ribbon Lead tests direct gesture control. Broader alternatives and musical tradeoffs are documented in [the research memo](17-musical-play-research.md).

Ribbon Lead creates an articulated scale melody. It does not record continuous pitch bend: the ordinary project Note schema stores discrete pitches. Low intensity gives a longer gate, high intensity changes articulation and accents. Arrow keys and pointer motion can continue without operating-system key repeat. Low-motion and touch interaction remain usable.

## Implementation sequence and interfaces

1. Add pure deterministic phrase generation and backing arrangement helpers to `music-core`, preserving `createArcadePhrase` for existing consumers. Validate key, meter, clipping, rhythm identity, kit roles, and Ribbon continuity with unit tests before integration.
2. Keep the existing Arcade component and `ArcadeTake` / `ArcadeLane` interfaces. A take remains ordinary `Note[]`, an optional single patch, and explicit role/patch/note lanes. Weapon changes during capture add independent instrument lanes. The parent retains its existing Keep dialog, normal note editor, and undo transaction.
3. Add three selectable control surfaces using the same arena, keyboard, pointer capture, focus cleanup, and audio engine. Phrase Rider and Groove Fighter consume one intent at each bar boundary. Ribbon samples intent and height each sixteenth. No action schedules an additional overlapping phrase.
4. Separate transport from capture. Jam produces no stored notes. Record next loop arms a count-in pass, records exactly one subsequent pass, and stops for review. Replay uses the captured instruments and chosen backing. Keep and Discard are available after capture. Another recording requires resolving the previous take.
5. Offer one bar, two bars, and selected phrase windows. Default to two bars, bounded by the selected phrase and any intersecting score loop. This keeps imported long patterns practical. A review take retains its chosen window across editor navigation; resolve the take before changing that window. Capture stores selected-pattern coordinates; playback maps those coordinates into the current region, preserving nonzero clip and loop starts.
6. Use the transport audio clock for the scheduling origin and all preview onsets. Schedule only a short horizon, skip stale work after throttling, and record notes after their actual onset. Stop, Rest, gate release, focus loss, and unmount remove unsounded previews and trim captured durations to the sound that happened.
7. Run focused musical unit tests, browser interaction checks, then repository typecheck and full integration checks. Inspect phone layout and the finished arena, not only the code.

## Shared performance rules

- **Song awareness:** a phrase borrows the selected pattern's contour; strong beats and endings use sounding harmony where available, otherwise the stated song scale. The harmony reader receives the chosen audible backing, so muted harmony does not falsely claim to guide the performance.
- **Identity:** sequence numbers change note IDs rather than musical contour. Repeating an idea retains its identity. Intensity changes rhythm, register, velocity, or gate; it never changes song BPM. Automatic intensity follows the pace of moves and Ribbon motion; explicit calm/driving/fierce settings are also available.
- **Backing:** default to Song without my role. Full song, bass-and-drums foundation, and metronome are available. A drum performance excludes existing drums by default. Replay excludes recorded roles under backing choices that promise that space.
- **Silence:** Rest immediately releases performed voices and removes unsounded scheduled notes. Ribbon release/cancel/blur closes the gate. The backing transport continues until Stop or automatic recording completion.
- **Capture:** one pass, bounded durations, no accumulation at loop wrap, at most 2,048 notes. Recorded onsets follow actual audio scheduling; silent/canceled future notes are excluded. Jam never modifies an existing review take.
- **Instruments:** weapon patches use their actual waveform for tonal lanes and the audio engine's synthetic kit for drum lanes. A silent selected track remains silent in preview, replay, and the kept track.

## Validation gates

The core suite covers full-bar identity, answer variation, density without melodic overlap, every root in major/minor/chromatic modes, audible harmony versus scale-only backing, odd meters and partial/nonzero ranges, explicit drum patterns and fill backbone, Ribbon continuity and rest, immutable playback arrangement, and invalid inputs.

Browser checks cover a jam that captures nothing, rapid input without stacked voices, bounded recording and automatic review, changing weapons into editable independent lanes, replay, Keep and undo/redo, an explicit drum role from a melody selection, held Ribbon movement with immediate release, pointer cancellation on a phone, recorded Rest parity, and preservation across editor navigation. The existing composer integration also keeps an Arcade take before opening Compose with game.

The product evaluation is musical as well as mechanical: play a motif for several bars, request an answer, leave a rest, and listen for recognizable development; verify that a fill returns to the groove; drag the Ribbon slowly and quickly and compare its audible gate with the kept ordinary notes. The implementation keeps these modes together so those comparisons are immediate.
