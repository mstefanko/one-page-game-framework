# Compose while the game runs

The Game audio workspace and compact editor preview share one mounted game. Switching Sketch, Studio, full Game audio, or collapsing the preview changes its presentation without loading a new iframe or resetting its checkpoint. The cue selector and composition actions stay available in the compact dock.

- **Edit original** copies the selected game's original cue into a new browser draft, opens the note editor, and starts the game with that working score. Existing drafts, pending saves, and recorded takes use the same navigation guards as other song changes. Repeated imports always copy the original source; they do not silently reopen an older draft with its source ID.
- **Edit assigned** copies an explicitly pinned assignment into a new draft.
- **Start fresh with game** creates an empty editable loop using the selected cue's tempo, meter, scale, and repeat duration. It preserves the current draft and keeps the same game checkpoint. Notes can be added, performed on the live pad, or captured through Arcade.

The parent **Play / Stop** controls working music. **Play game / Pause game** controls the simulation and its native effects. Stopping working music leaves the game running; pausing the game leaves working music available for composing. In working mode, changes are queued for the next complete loop, including changes to tempo and loop length. The transport reports “Changes queued for next loop” until the update becomes audible. For a long cue, **Hear edits now** restarts only the music with the latest draft; the game continues uninterrupted. Clicking a section auditions a shorter phrase. Auditioning notes and playing a pad use the same editor audio engine. Arcade and live-take recording keep ownership of their performance backing instead of receiving full-score live updates mid-take.

## Music ownership

The source selector makes the audio path explicit:

| Source | Music owner | Scene changes |
| --- | --- | --- |
| Original game music | Native game runtime | Native cue changes |
| Saved assignments | Runtime, using pinned score when present | Each context uses its saved assignment or original |
| Working score · live | Editor transport | Current working loop continues across contexts |

For imported Terminator, `setMusicSource` is an optional validated bridge capability. The host waits for a routing acknowledgement before playing its score. Every command and acknowledgement carries a unique request ID, so rapid source changes cannot resolve the wrong ownership request. The runtime suppresses only its music bus while the editor owns music; simulation, native sound effects, and observed context/cue events remain active. Pending source/compose actions are invalidated when superseded, hidden, or unmounted. Runtime playback and editor transport both stop on page visibility loss.

Pinning is an explicit **Pin working score to [cue]** action. It saves a clone of the current draft to that target, independently of which context is currently sounding. Editing and live playback do not alter assignments. Switching to Saved assignments auditions pins; switching to Original restores native music. Assignment import/export and source-revision recovery remain available in the full workspace.

Lantern Courier provides the same workflow without a private local game import. Its fixed original Midnight Delivery score is separate from browser-pinned assignments, and its own audio engine runs native music/effects while the editor engine runs working music.

## Validation

`game-music.test.ts` checks empty compatible draft creation. Bridge tests cover ownership acknowledgement timing, payload validation, disposal, and rapid host → runtime → host correlation. `compose-with-game.spec.ts` exercises the portable fixture, draft preservation, original import, live edits, persistent game DOM across workspace changes, independently stopping music, and starting fresh. `terminator.spec.ts` covers real imported contexts, native SFX, host music ownership, retained iframe/game ticks, explicit pins, and restoration of saved/original playback. The real-game test skips when the local ignored import is absent; framework builds do not include that private source.

## Implementation plan and interfaces

The dependency order is:

1. Add `AudioEngine.queueScore(score)` and `hasQueuedScore`. Validate and clone the score, retain the active schedule through the next unscheduled loop boundary, then replace tempo/range/event scheduling together. `stop()` cancels pending scores. Blank loops must remain schedulable.
2. Extend the preview bridge with optional `musicSource` capability, `setMusicSource("host" | "runtime")`, and a strictly validated acknowledgement carrying the same unique request ID. Await the acknowledgement before starting host music; reject pending requests on disconnect, timeout, or disposal.
3. Instrument only the imported preview copy. Host routing retires the native music bus while preserving native effects and simulation. Runtime routing restores native music or its existing pinned-score preview. Rebuild the ignored local import with `npm run import:terminator -- /path/to/index.html`.
4. Keep `GameAudio` at one React position. Use CSS for collapsed/docked/full layouts, keeping cue and source controls accessible. Expose `GameMusicControl` (`activateWorking`, `working`, `running`) so editor transport, live pad, note audition, and Arcade can prepare the music path before playing.
5. Route original/assigned/fresh imports through the existing guarded song-navigation path. Always generate a new song identity; preserve drafts and recorded takes. Pin only through an explicit assignment action. Mirror ownership in the portable fixture with a separate runtime audio engine.
6. Validate isolated bridge/draft tests, then portable and private-import browser flows. Check real iframe identity, game ticks, host/runtime playback state, assignment persistence, and narrow-screen overflow. Run the repository suite after the independent Arcade work is integrated.

A runtime-only draft transport was considered. Its existing `previewDraft` implementation stops and restarts canonical music on each draft replacement, and it cannot share the editor's pad/Arcade playhead. The editor monitor supplies one coherent transport for composing; the bridge keeps original and pinned playback inside the runtime.

Updates deliberately wait until a complete loop boundary. A long imported cue can therefore delay a live change for a long time; **Hear edits now** restarts only the working music to audition it immediately. Imported orchestral timbres and energy levels remain synth approximations. Ordinary songs preserve their one-shot/loop setting; explicitly monitoring working music with the game uses looping playback. Collapsing an already running game preserves its simulation and music source until the user changes them.
