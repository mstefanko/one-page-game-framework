# Chiptune composer: product, architecture, and implementation plan

Decision: October 16, 2026. This specializes [framework section 9](02-framework-plan.md#9-music-and-sfx-construction-interface) and uses the [repository/library strategy](03-repository-and-asset-strategy.md). Features and APIs here are proposed; this commit establishes planning and scaffolding only.

## 1. Product promise

Make a short, personal piece of game music by changing a melody, building a beat, and arranging a few patterns. Download it for a game, video, presentation, or friend. Save the editable version in a personal library and reuse it across projects.

The first session should go from “I do not know how to compose” to an audible edit in under a minute: choose a starter, press Play, move a note, change its sound, and hear the result. An experienced musician can start blank or import MIDI. The tool should feel like an instrument with discoverable structure, not a game configuration form.

“Chiptune” initially means original chip-inspired synthesis (pulse, triangle, noise, simple FM/metallic colors), not cycle-accurate NES/Game Boy/SID emulation. Optional channel-limit presets can encourage a retro style, but should never claim authentic hardware output. The existing reference also supports cinematic synth colors; keep those as an optional palette.

## 2. Library choices and what we learned

Primary sources were checked on October 16, 2026. These are candidates and observed upstream capabilities, not installed or benchmarked dependencies. Pin exact release versions and inspect the distributed license notices at implementation time.

| Candidate | Verified capability | Proposed use / decision |
| --- | --- | --- |
| [BeepBox repository](https://github.com/johnnesky/beepbox) | MIT; separates editor, synth and small player; publishes a synth library | Main UX reference and a serious alternative backend/product base. Study patterns, approachable note entry, and sharing; do not fork the entire editor by default |
| [BeepBox import source](https://github.com/johnnesky/beepbox/blob/main/editor/ImportPrompt.ts), [export source](https://github.com/johnnesky/beepbox/blob/main/editor/ExportPrompt.ts) | JSON/MIDI import; WAV, MP3, MIDI, JSON and HTML export options in inspected source | Confirms these workflows are practical; plan an explicitly limited JSON importer later. Its MIDI conversion is itself described as approximate |
| [Tone.js](https://github.com/Tonejs/Tone.js) | MIT Web Audio scheduling/synthesis framework | Alternative if its instruments/transport remove enough custom work. No Tone runtime dependency in the initial recommendation |
| [@tonejs/midi](https://github.com/Tonejs/Midi), [package manifest](https://github.com/Tonejs/Midi/blob/master/package.json) | Reads/writes MIDI as notes/tracks/tempo/controllers; dependencies include `midi-file`, not the Tone audio engine | Preferred ergonomic MIDI adapter; importing this package does not require choosing Tone for playback |
| [midi-file](https://github.com/carter-thaxton/midi-file) | MIT raw MIDI parser/writer, event-level representation | Use for preflight event coverage and cases hidden by a higher-level representation; verify every relevant event is handled or reported |
| [OfflineAudioContext](https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext) | Renders an audio graph to a buffer without real-time output | WAV/stem rendering with the same synth graph as preview |
| [audiobuffer-to-wav](https://github.com/Experience-Monks/audiobuffer-to-wav) | MIT; encodes AudioBuffer as 16-bit PCM or 32-bit float WAV | Small editor/export-only candidate; verify large-buffer/memory behavior |
| [fflate](https://github.com/101arrowz/fflate) | MIT compression/ZIP facilities | Candidate for source packs and stem ZIPs; enforce our own archive limits and contained paths |
| [ZzFX](https://github.com/KilledByAPixel/ZzFX) | Existing small SFX recipe generator identified in the original research | Separate SFX workbench later; do not turn every music note into an SFX recipe |

**Recommendation:** keep the canonical 480-PPQ score and small shared Web Audio backend chosen in the framework research. Learn from BeepBox's UX, use a MIDI parsing library, and reuse mature archive/WAV utilities. Do not make browser preview sound good using one synth while exported games use another.

Before hardening the backend, build one short original cue in the custom backend and a BeepBox-synth adapter. Compare editing/model mapping, fractional phrase lengths, adaptive layers, offline rendering, cleanup, distribution notices, and measured delivered size. Retain one production backend. Tone is a fallback if both approaches require too much scheduler/effect maintenance; no third production synth is planned. This small evidence gate can overturn the provisional choice before substantial editor code exists.

The reason to own the score is cue routing, arbitrary phrase lengths, explicit dependency/revision semantics and shared game/editor APIs. It is not an assertion that BeepBox lacks a JSON format, MIDI support, or reusable playback. Do not depend on unofficial BeepBox lookalike sites for capability claims.

## 3. Scope and staged capabilities

| Stage | User-facing capabilities |
| --- | --- |
| First vertical slice | One original editable starter, play/stop/loop, piano roll, four lanes, simple patch choice, save/reopen, source pack and WAV export |
| Composer MVP | Six starters; blank song; step drums; piano roll/velocity; reusable patterns and arrangement; mixer; MIDI import/export with conversion report; library; standalone HTML player; keyboard/touch basics |
| Framework integration | Cue/intensity audition, phrase-boundary transitions, use in game with pinned revisions, two intensity layers in an offline exported game |
| Follow-on | Stem export; BeepBox JSON subset; reusable motif/patch packs; variations and fill helpers; visual loop/video export; live MIDI keyboard input; richer automation |
| Separate later project | Cloud account library, collaboration, public remix gallery, audio transcription, hardware-emulator profiles, advanced tempo maps |

The MVP is a useful standalone composer. Framework integration follows the shared core and the game exporter, not the entire sprite/level editor program. No login, multiplayer collaboration, online marketplace, full DAW, plugin hosting, or automatic MP3-to-score claim belongs in the first release.

## 4. Composition workflows and features

### Start, learn, and make it yours

Offer three equally legitimate starting actions: **Remix a starter**, **Start blank**, **Import MIDI**. Show recent drafts and My Library beneath them. A starter card has a short audition, mood, tempo, approximate length, difficulty, and a sentence such as “Change the last two notes to make your own ending.” Starting a remix creates a new asset identity; it never edits the bundled original.

Use six original starter briefs: *Pocket Sunrise* (bright menu), *Midnight Delivery* (driving action), *Moss Lantern* (quiet exploration), *Copper Giant* (boss tension), *Tiny Triumph* (victory sting), and *Clockwork Steps* (6.5-quarter-note phrase demonstration). The [starter brief](../examples/music/README.md) defines acceptance. Titles are proposed original working names; no melody files are delivered yet.

Each should teach one concept with an A/B variation, four labeled roles, an obvious loop, and a reset-to-starter action. Users can transpose, duplicate, simplify, add a response phrase, change a patch, and adjust tempo without knowing notation. Supply a visible metronome/count-in, optional scale highlighting and optional snap-to-scale. Chromatic notes remain possible.

### Make a pattern

Four initial roles are Melody, Bass, Harmony, and Drums; allow adding/renaming tracks up to a chosen MVP limit of eight. These are friendly labels, not hardware channels. Piano-roll notes support click/tap add, resize, drag, selection, duplicate, transpose, delete, velocity, and quantization. Drum lanes show named kit sounds and step accents. Both edit the same event model.

Offer straight, triplet and quintuplet grids that are representable at 480 PPQ. Swing shifts eligible offbeat events deterministically at playback/compile time; it is not a second hidden timestamp convention. Show the audible result and bake it when exporting MIDI. A manual quantize command previews changed notes and is undoable. Pattern lengths need not equal one bar: 2880 and 3120 ticks are valid. A phrase-end marker can sit inside a displayed bar.

### Arrange and shape the sound

An arrangement uses named pattern clips across tracks with Intro / A / B / Ending markers, explicit loop start/end, duplicate, drag and repeat. Editing a linked pattern changes all instances; “Make unique” breaks that link. Do not silently copy on one operation and link on another.

Start with eight generic presets: pulse lead, rounded bass, triangle pluck, soft pad, bell/glass, metallic hit, noise snare, and kick. Basic controls are brightness, attack, release, pulse width where relevant, volume, and pan. Advanced controls expose the documented backend patch parameters. Envelope changes and previews must use the same synthesis implementation as export. Bound voices/gain, reserve mix headroom, and show overloads.

Mixer mute/solo is audition state by default. Export uses the authored mix; the export panel can explicitly select “Use current solo/mute preview” and show the resulting tracks. Avoid accidentally exporting an empty song because a track was soloed earlier.

### Game music without requiring game knowledge

The Game tab offers cues (Menu, Explore, Action, Boss, Victory) as editable examples, an intensity slider, named layer thresholds, and a simulated transition trigger. Show “Requested: Action · Starts at next phrase” so scheduled changes are understandable. A game controls cue/intensity, never individual notes on animation frames.

Default adaptive changes occur at phrase boundaries. Basic transitions fade/crossfade with a declared duration; tempo changes between cues use explicit restart/fade semantics rather than pretending they remain beat matched. Standalone users can ignore this tab. A video export or WAV requires choosing one cue/intensity or a finite scripted cue sequence; an adaptive system is not a single fixed recording.

### Useful follow-on experiments

Try call-and-response, bass-from-root suggestions, arpeggiate a chord, rotate a rhythm, seeded “make a variation,” ending/fill suggestions, A/B compare, and “retro limits” challenges. Every generated result is ordinary editable notes with undo and a recorded seed. Keep these optional so the user actively composes. Defer generative-AI services, microphone transcription and social feeds until the manual workflow is proven.

## 5. Canonical music documents

TypeBox definitions in `packages/project` will generate JSON Schema and TS types. The following is a contract outline, not an already validated schema or copy-paste production JSON:

| Object | Required semantics |
| --- | --- |
| Score | Stable ID, schemaVersion, PPQ fixed at 480, title, patch dependencies, tracks, patterns, cues, provenance |
| Pattern | Stable ID, positive integer `lengthTicks`, note/percussion events sorted by start and stable ID; optional named variation |
| Note | ID, integer start/duration in musical ticks, MIDI pitch 0–127 for melodic events, velocity 0–1, track/patch binding |
| Track | ID/name/role, patch reference, gain/pan, voice cap; role independent of MIDI channel |
| Clip | Pattern reference, start tick, integer repeat count, transpose and optional intensity range; half-open active range |
| Cue | One BPM and meter, arrangement clips, exact length, optional intro and loop range, finite transition rules |
| Patch | Backend ID/version, bounded parameters, optional sample/blob dependencies only when the backend supports them |
| Automation | Initial gain/pan lanes with integer time and bounded values; extra controller types gated behind schema support |
| Library manifest | Asset identity/revision, dependency closure, source/backend versions, author/license/source, import report references |

One constant tempo and meter per cue in v1. Meter controls the ruler; musical phrase length is independent. BPM is quarter notes per minute, including in compound meter. UI labels should remove ambiguity for 6/8. Cues can have different tempos, but a single cue has no tempo map yet.

Convert ticks to seconds with `seconds = ticks * 60 / (BPM * 480)`. Simulation ticks remain independent. A source tick at PPQ P converts to `sourceTick * 480 / P`; inspect the rational result before quantization. For example, PPQ 960 tick 1 becomes 0.5 and requires a choice. A 6.5-quarter-note phrase is exactly 3120 ticks.

Validate positive lengths, note ends, repeat bounds, references, loop containment, finite automation values, voice limits and compatible backend versions. MVP note events end within their pattern; release tails may extend. Explicit ties/held notes across loop boundaries are deferred. Deterministically order simultaneous events, including note-off before a same-pitch retrigger.

Compile a score into a canonical event trace independently of audio. Scheduler, offline render and export adapters consume this shared interpretation. Separate authored intent from compiled event arrays. Do not serialize audio nodes, closures, UI state, timer handles or parser-specific objects into a score.

Seek policy: stop scheduled voices; rebuild the currently sounding note set and relevant controls at the target; rebase to the audio clock. If a backend cannot reconstruct an envelope phase exactly, specify and audition the restart approximation. Ordinary arrangement scrubbing is silent unless audition is enabled. Stop/pause/seek/reload must release nodes and cancel future events. Background throttling skips elapsed work instead of bursting missed notes.

## 6. Importing users' songs

### MIDI conversion is practical, with a review step

MIDI carries performance instructions, not the original recording or instrument sound. Convert selected tracks to chip patches and editable notes. This can preserve composition while intentionally changing timbre; it cannot promise the original mix.

Import wizard:

1. Read locally and preflight size, format, PPQ, track count, tempo/meter changes and event kinds. Retain the untouched source in the local import record, subject to the user's storage choice; do not upload it.
2. Show track previews and propose roles/patches from program/channel hints. Let the user select tracks, trim a range, rename roles and choose a cue tempo.
3. Show conversion choices: timing resolution, harmony/polyphony, sustain, unsupported controllers, tempo changes and drum mapping. Compare the proposed converted audition against a neutral MIDI preview only if that preview can be supported honestly; do not imply access to the source recording.
4. Generate an editable preview and a human-readable loss report before committing. Accepted changes become a new song with provenance and an undoable import transaction. Keep the imported source/reports out of game exports unless explicitly selected for recovery.

| Input detail | MVP handling |
| --- | --- |
| SMF types 0 and 1, PPQ timing | Support after fixtures; split combined channels into logical tracks as needed |
| Type 2 asynchronous sequences / SMPTE division | Detect and decline with an explanation in MVP; do not misread as one PPQ song |
| Notes/velocities/tracks | Preserve selected composition; map sounds via a user-editable table |
| General MIDI drums | Propose kick/snare/hat/metal mappings; inspect channel index 9 (human channel 10), plus explicit user override; not “channels 9 and 10” |
| Durations/positions not representable at 480 PPQ | Offer explicit quantization or cancel; show changed count and max timing error in ticks/ms at chosen BPM |
| Tempo/meter changes | Report all changes. Choose a constant section, split into separate cues with reviewed boundaries, or explicitly flatten to one tempo/meter and accept loss; no silent first-tempo-only import |
| Sustain pedal CC64 | Bake into note durations where supported, resolve overlap with voice policy, report changes; otherwise report and require explicit ignore |
| Volume/pan/expression | Map only implemented controller semantics; disclose baked/ignored automation |
| Pitch bend, aftertouch, MPE, SysEx, unsupported CC, program changes mid-track | Count and report; reject or require explicit omission, never claim a lossless import |
| Overlapping notes / excessive polyphony | Keep polyphony within caps, split tracks, or explicitly simplify to melody/bass/arpeggio; preview affected passages |
| Unsupported drum pitches or too many tracks | User maps, excludes, or splits; no unreported dropped notes |

Use raw `midi-file` inspection so higher-level parsing cannot conceal unsupported events. Pair note-on/off deterministically, handle velocity-zero note-ons as note-offs, and report malformed/truncated files. Set proposed limits (10 MiB input, 100,000 events, 128 source tracks, ten-minute selected range) before parsing/rendering; larger work asks the user to trim rather than freezing the tab. Eight output tracks is an MVP product limit, not a MIDI limitation.

### Other import paths

- **Own source pack / score JSON:** full-fidelity supported version round-trip, including patches and declared media; validate before mutation, offer migration backup, reject newer unknown major versions.
- **BeepBox JSON:** follow-on subset adapter for notes/patterns/arrangement and compatible instruments; preserve source and report unsupported modulation, effects, rhythms or instruments. No promise to load every fork's format or retain exact sound.
- **WAV/MP3:** later reference-audio lane or sample instrument only if explicitly added. Polyphonic audio-to-notes is a separate transcription problem, not a cheap MIDI importer extension. User can transcribe manually or bring external MIDI.
- **Live MIDI keyboard:** later note recording with count-in, quantization preview and device permissions. [Web MIDI](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API) has browser/security limitations; file import does not need that API.
- **MusicXML, ABC and tracker modules:** deferred format adapters; add only with a real user example and explicit timing/instrument mapping. Avoid a generic “import anything” button.

## 7. Exports: one song, several useful outputs

| Output | Why people want it | Stage / fidelity |
| --- | --- | --- |
| Editable source pack (`.opmusic.zip`, proposed) | Backup, send to a friend, reopen, move between tools | First slice; score + patches + manifest + provenance + necessary blobs; full supported editability |
| Score JSON | Agent editing, inspect changes, framework integration | MVP; clearly distinguish document-only export from a self-contained dependency pack |
| WAV | Videos, presentations, podcasts, other game engines | First slice; shared offline synth, stereo 48 kHz / 16-bit PCM default; 44.1 kHz and float later |
| MIDI (`.mid`) | Continue composing in a DAW or other music tool | MVP; notes/timing/velocity and supported controls; chip timbre, effects and game logic do not survive |
| Standalone player HTML | Send a playable music card or host on a static site | MVP; embedded data and same player, play/mute/loop/title/credit; no network requests, no editor bundle |
| Framework asset pack | Use in a game with adaptive behavior | Integration; canonical score/patches + cue metadata + pinned revision; build inlines only required assets |
| WAV stems ZIP | Mix/edit in other content tools | Follow-on; aligned start/end/sample rate, dry/pre-fader option, separate effects return or explicit non-summing warning |
| MP3 / Ogg / WebM audio | Small social/download files | Follow-on after codec/dependency/device review; feature-detect actual encoders, keep WAV universal fallback |
| Video / visualizer loop | Social posts, music previews, presentation backgrounds | Follow-on; waveform/piano-roll/cover art, aspect ratios, bounded duration; not part of playable game output |
| Motif, drum-kit or patch pack | Reuse part of a composition | Follow-on; same library revision/dependency format with a smaller asset kind |

The export dialog uses purposes: **Use in a game**, **Download audio**, **Continue editing**, **Share a player**. Explain which choices preserve editable notes. WAV is a rendered sound, MIDI is notes with approximate instrument hints, and the source pack is the authoritative editable artifact.

Choose cue, arrangement range, loop iterations, intensity/layer state, sample rate, authored-vs-preview mix, and tail handling. Do not attempt to render an infinite loop. Show estimated duration/size, progress, cancel, peak warnings and completion/download state. All transformations go in an export report.

For audio loops, distinguish **loop-body export** from **listening export with tail**. Render enough preroll for recurring effect state, crop on sample boundaries, and measure/listen across repeated joins. A sample-accurate file duration alone does not prove a seamless reverb tail. Choose dry loops first if steady-state effects cannot be rendered reliably. Never independently normalize stems and claim they sum to the master; a nonlinear master compressor also breaks that claim.

OfflineAudioContext renders the shared graph; it does not encode a compressed audio file. [MediaRecorder codec support varies](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static), and real-time recording is not a deterministic offline-export substitute. Bundle permitted encoders explicitly if later adopted; do not make core export depend on a CDN download.

Source ZIPs must reject zip-slip paths, duplicate/ambiguous names, oversized decompression, corrupt hashes and unsupported schemas. HTML reimport reads an inert escaped data payload without executing it. Escape script-closing text; forbid imported script/remote asset injection. A player may include editable source data; describe a runtime-only player as non-recoverable if that data is deliberately omitted.

## 8. Library and framework connections

Use the [shared library contract](03-repository-and-asset-strategy.md#5-storage-export-and-library-together), not a composer-only database. Music edits store real source; rendered previews are replaceable caches. Keep Save status separate from Save version, export status and sync status.

Useful first library fields: title, kind, tags/mood, BPM/meter, key hint, length, author/provenance/license, modified date, revision, dependencies, preview and compatibility. Key is an optional description, never a constraint preventing chromatic editing. Search/filter and audition work before opening the editor. A small locally indexed catalog is enough; no search server is necessary.

Example end-to-end: remix *Midnight Delivery* → save version 2 → choose Use in game → select project/cue → copy exact song/patch dependencies into the project's registry → build HTML. Editing version 3 in My Library leaves that game's version 2 intact. Updating the game is explicit, previewable and reversible. A cutscene director and SFX editor later use the same picker and IDs.

The standalone hosted tool can download a framework pack even when it cannot write to a local game folder. “Use in game” explains that handoff and supplies the pack; the local studio can insert directly through a revision-checked transaction. Never show a successful project save when the app only downloaded a file.

## 9. Interface requirements

Use ordinary readable DOM controls around the musical canvas/grid. Desktop hierarchy: persistent transport/save state; starter/library browser; arrangement and selected pattern; contextual inspector; bottom status/diagnostics. Pattern, Arrange and Game can be modes instead of three permanently competing canvases. The five concepts may change this architecture while preserving task coverage.

Minimum screens: starter home, active pattern editor, arrangement, sound inspector, MIDI conversion review, library/revision picker, purpose-based export, and game cue/intensity audition. Provide meaningful empty, loading, saved, unsaved, render-in-progress, cancel, error, conflict, unsupported-import and interrupted-audio states.

Playback requires a user gesture. Show Enable Sound / Resume Sound when needed, respect mute, and use audio-clock scheduling. Test phone interruptions and recovery on physical devices; a browser automation run is insufficient. Avoid unexpected loud previews; use sensible default headroom.

Keyboard: space play/stop outside text fields; arrows navigate notes/cells; documented modifier actions resize/transpose; Enter edits; Delete removes selection; standard undo/redo. Provide a keyboard-accessible note list/inspector alternative to drawing. Grid focus and playhead are distinguishable; velocity, mute and selection cannot be encoded only by color. Screen readers receive note/track labels and useful action feedback without constant playhead announcements.

On tablet, make selection/manipulation work without hover and use comfortable touch targets. On phone, prioritize audition, starter tweaking, basic step/note editing, library and export; use one panel at a time. Dense arrangement precision can remain best on desktop, but saved work must be recoverable on small screens. No forced landscape, tiny faux-hardware text or decorative knobs without numerical values.

## 10. Ordered implementation work and acceptance

The repo scaffold is **C0**. Subsequent work is not implemented. All gates require observable artifacts, not just approved designs.

| Step | Dependencies / deliverable | Acceptance gate |
| --- | --- | --- |
| C1 — Contracts and backend proof | C0; TypeBox score/patch/pack subset; event compiler; custom vs BeepBox spike; choose one backend | One original 3120-tick phrase, tempo conversion, loops and two layers produce correct traces; backend scorecard includes size, cleanup, offline render and listening; no game engine required |
| C2 — Audible standalone slice | C1; minimal composer host, one editable starter, shared synth, piano roll, save/reopen, source pack and WAV | User changes a note, hears it, reloads it, downloads correct WAV and restores source pack; preview/render use same graph; no stuck voices after 100 transport operations |
| C3 — Composition MVP | C2; six starters, drums, patterns, arrangement, patches, mixer, undo, keyboard/touch | Linked/unique patterns behave clearly; fractional phrases display/play; source survives undo/reload; accessible note editing; real-device listening review |
| C4 — MIDI and portable sharing | C2; import wizard/loss report, MIDI writer, standalone player HTML | Fixture matrix covers supported/declined cases; no unreported data loss; export/reimport note parity for supported subset; player runs with zero network attempts under nested hosting and desktop local-file checks |
| C5 — Reusable library | C2; browser catalog/draft/version/restore; library service interfaces; local folder adapter when server is ready | Two songs reuse one patch; fork/update behavior correct; quota failure retains recoverable draft; corrupt archive rejected; external-file conflict retains both revisions |
| C6 — Game integration and release proof | C3–C5 + framework compiler/runtime slice | Pinned library song used in one offline game; intensity changes at declared boundary; disconnected library does not break build; cue transitions/cleanup/device audio verified; docs match actual exports |

C3, C4 and C5 can be scheduled independently once C2 establishes the interfaces. They are not instructions to create parallel agents. Framework milestones 1a–1e continue separately; C1/C2 supply their music components. The composer does not wait for a full level editor.

Concrete verification fixtures: constant/variable tempo MIDI; source PPQ 96/192/480/960; unrepresentable tick; 6/8 display; 3120-tick phrase; sustain and repeated same pitch; tempo boundary crossing; unsupported pitch bend/SysEx; percussion mapping; malformed/truncated MIDI; over-limit input; exact loop ends; cue switch during scheduled lookahead; missing patch; stale save; interrupted write; evicted browser cache; source→pack→source equality; notes→MIDI→notes equality within declared scope.

Measure event timing, render duration, finite peaks/headroom, silence where expected, voice cleanup and listening quality. Do not demand byte-identical synthesized PCM across browser engines. Record browser/version/sample rate/backend/seed for audio fixtures. Physical iOS/Android unlock, background, headphones, return-to-play and mute checks gate release; CI cannot certify them.

## 11. Decisions, risks, and evidence still needed

Adopted defaults: standalone first, same format/backend as games, export plus personal library, local/browser storage before cloud, original starters, 480 PPQ, one tempo per cue, MIDI conversion with reviewed loss, WAV/source packs before optional codecs, no full DAW scope.

Main risks: building too much editor before a useful loop, underestimating MIDI conversion, preview/export drift, browser save loss, synthesis/node leaks, and treating a shared library as a live mutable game dependency. C1–C6 place a specific proof at each risk.

No additional decision is required to start C1. After the five design concepts exist, choose an interaction direction and validate it by having a novice remix a starter and an experienced musician import/edit/export a short MIDI. Cloud sharing and authentic hardware emulation require separate product decisions. Backend benchmarks, device behavior, installed-package audits and usability results remain unverified until implementation.
