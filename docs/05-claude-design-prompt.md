# Claude design prompt: six composer concepts

Copy everything below the divider into Claude Design. It is self-contained; no access to this repository is required. This asks for six design concepts, not six different technical architectures.

---

Design **six genuinely different interface concepts** for a browser-based chiptune music composer. Working product name: **Pocket Score**. The name is provisional. This is a standalone creative tool within a larger one-page game-making framework, but someone making music for a video or simply having fun must feel equally welcome.

The central promise: **“Make a little tune. Make it yours. Use it anywhere.”**

Produce six coherent visual/interaction directions, with high-fidelity screens or interactive prototypes as your environment permits. Do not give six color themes on the same layout. Show meaningful differences in information architecture, composing workflow and visual identity. Do not stop at moodboards or a marketing landing page.

## Audience and experience goals

We serve curious beginners who have never composed, hobby musicians who understand notes/patterns, and game makers who want original adaptive music. The beginner should choose a sample tune, press Play, move a note or change a rhythm, and hear a personal result within one minute. An experienced user should be able to import MIDI and work precisely without a long tutorial.

This is a small, playful music-making instrument with real editing depth. Use clear language and progressive disclosure. It is not a huge professional recording studio, a game-only settings panel, a social feed, or an AI prompt box. People actively compose by editing notes, rhythms, patterns and sounds. Suggestions can help, but visible editable music is the center of the experience.

No account is required. No cloud service is in the initial release. The first experience must work with local/browser saving and downloads.

## Required musical capabilities

- Start by remixing an original starter, starting blank, or importing MIDI.
- Starters include **Pocket Sunrise** (bright menu tune), **Midnight Delivery** (driving action), **Moss Lantern** (quiet exploration), **Copper Giant** (boss tension), **Tiny Triumph** (victory sting) and **Clockwork Steps** (an unusual phrase length). Show mood, tempo, short audition, and a small suggested edit on starter cards.
- Melody, Bass, Harmony and Drums are the four initial track roles. Users can rename/add tracks. Patterns are short reusable phrases; arrangements put patterns into a song.
- A piano roll supports placing, moving and resizing notes, velocity, selection, duplicate and transpose. A drum/step view supports toggles and accents. Directions 1–5 should expose these normally. Direction 6 deliberately makes live gestures the primary editing surface, with a secondary “See the notes” view for precision. All directions must create real editable note/rhythm data, not just decorative waveforms.
- Patterns can have unusual lengths, including 6.5 quarter-note beats, rather than being forced into four-beat bars. Show a clear phrase end independently of the bar ruler. Straight/triplet grids and scale highlighting help beginners.
- Arrangement controls include Intro / A / B / Ending, repeat, loop start/end, and editing a shared pattern versus making one instance unique.
- A sound inspector offers chip-inspired presets such as pulse lead, rounded bass, triangle pluck, soft pad, bell and noise drums. Start with understandable controls: brightness, attack, release, volume and pan. Advanced parameters can be tucked away.
- Transport includes Play/Stop, loop, tempo, current position, metronome, undo/redo and useful save state. Mixer includes mute/solo and level feedback.
- Optional Game mode supports cues such as Menu, Explore, Action and Victory, plus an intensity slider that brings layers in/out and an audition of a scheduled transition. A person just making a song can ignore Game mode.

## Three central journeys every concept must support

**1. Remix and share:** Choose Midnight Delivery → Play → change two melody notes → change a drum accent → switch the lead sound → save a version → download a WAV or standalone player. In direction 6, achieve the musical changes through drawing and sculpting a phrase, without opening a piano roll.

**2. Bring my own music:** Import a MIDI file → see tracks and proposed chip sounds → choose which tracks to keep → review timing/unsupported-feature changes → audition the conversion → create an editable song. MIDI contains notes and performance instructions, not the original sound recording. Do not promise MP3-to-chiptune conversion.

**3. Reuse in a game:** Save a song in My Library → choose Use in game → pick the Action cue and audition two intensity levels → insert a pinned version into a project, or download a game asset pack when no local project is connected. Later edits to the library song do not silently change an existing game.

## Library, saving and export

My Library contains editable creations, patches and eventually other creative assets. Music cards need audition, title, mood/tags, tempo, length and version. Show recent drafts and a meaningful empty library. Support search/filter, duplicate/remix, restore and explicit version selection.

Use honest save labels: “Saved in this browser,” “Saved to folder,” “Unsaved changes,” or “Save failed — download a backup.” Do not say “Synced” or show an avatar implying cloud storage. Save persists the working draft; Save version makes a named reusable revision. Explain this gently and avoid making users manage Git concepts. Downloaded source packs are portable backups.

Organize exports by intention, with clear descriptions:

- **Download audio:** WAV first, for videos and other content. Choose song/cue, finite loop count, tail, and quality. Show render progress, cancel and download completion.
- **Continue editing:** Editable source pack preserves the song and sounds; MIDI preserves supported notes/timing but not exact chip timbre/effects. Score JSON can be under advanced options.
- **Share a player:** A downloadable self-contained HTML music player with title/credits and play/mute/loop controls. It can be sent or hosted elsewhere. No instant public link is available without a publishing service.
- **Use in a game:** Connect to a local project when available or download a framework asset pack. Show the version being inserted.

Stem ZIPs, compressed audio, music visualizers/video and public sharing can be shown in a labeled future-expansion diagram, not as working primary controls in the MVP.

For export, make it clear whether the authored mix or the current solo/mute preview is used. If an adaptive song has multiple layers, ask which intensity or finite cue sequence should be rendered. Avoid a confusing wall of file extensions as the starting point.

## Six required directions

Develop these as starting hypotheses; give each a concise name and explain its strongest user fit:

1. **Pocket groovebox:** A tactile, playful instrument organized around pads, steps and a focused note editor. Fast experimentation and satisfying feedback; no unreadable imitation LCD text or decorative knobs that hide values.
2. **Pattern workbench:** A clear, precise, restrained editor with an excellent piano roll and arrangement. Comfortable for musicians while progressive disclosure keeps the beginner path short.
3. **Song sketchbook:** A bright, approachable notebook of musical phrases, cards and guided edits. Make composition feel like sketching while retaining precise notes, timing and arrangement.
4. **Scene soundtrack:** A story/scene-oriented workspace where musical cues and intensity are easy to understand, with a complete standalone song workflow. Avoid making “create a game project” a prerequisite.
5. **Remix playground:** A library-led, card-based starting experience centered on auditioning and combining original patterns, with a focused editor that reveals the notes underneath. It must allow genuine note editing and blank songs, not only preset assembly.

6. **Flowpad — paint a living loop:** A flowing live musical scratchpad. Start a tune, pick an instrument brush, and draw a new part with the mouse or a finger. The song supplies timing and musical context; your hand supplies contour, activity and phrasing. Play freely, keep a good pass, then add another layer. Develop this direction using the detailed brief below. It should feel substantially different from the card/notebook treatment in direction 3.

Vary navigation, primary editing surface, inspector placement, how starter guidance appears, how arrangement is revealed, and how the library connects to the song. Some may use tabs, others a focused canvas or split workspace. Different colors alone do not count as different concepts.

## Direction 6 deep brief: Flowpad — paint a living loop

Give this direction room to be an ambitious interaction experiment. Its core question is: **“What if composing felt like doodling along with a song?”** The user should be able to make a recognizable personal phrase without learning keys, scales, bars, MIDI, or a piano roll. Design a playable musical surface with a predictable relationship between the hand and the sound.

### The first minute

Start a short two-bar excerpt of Midnight Delivery. The backing plays quietly; the original lead can be softened with **Make room for me**. Choose a **Bell** instrument brush. A single hint says: “Hold to play. Go up for higher notes. Right for more movement.”

The user presses and draws a slow rising curve. The tool plays an ascending answer that fits the current harmony. Moving right makes the phrase busier while the backing stays at the same tempo. Lifting the pointer leaves silence. The next pass, the user draws a different ending. They choose **Keep last loop**, compare the take with the backing, and keep it as a layer. Then they pick Bass or Percussion and add a contrasting part. Finally, they thin out a crowded passage and download their tune.

This entire path must work without exposing a note grid. “See the notes” is an escape hatch for curiosity and precision, not a required next step.

### A clear musical gesture language

The central surface is a live instrument pad, not a left-to-right timeline. **The audio clock supplies time.** A separate small loop ribbon shows where playback is and what has been captured. Label the pad axes gently so horizontal position is not mistaken for song position.

| Gesture / control | Audible result | Essential behavior |
| --- | --- | --- |
| Hold the pointer or finger down | Play the selected instrument brush | Hover is silent; release creates a rest and releases the voice |
| Move up / down | Raise / lower the melodic contour within the instrument's useful range | Prefer fitting notes around the current harmony; small hand tremors do not chatter between pitches |
| Move left / right | Spacious / busy phrasing | Changes note density and repetition on the beat, not the song tempo or loudness |
| Remain near one spot | Let the current phrase breathe or repeat steadily | Sparse position can sustain; busy position can pulse; behavior is visibly tied to brush choice |
| Choose Bell, Pulse, Bass, Pad or Percussion | Change the instrument and its musical role | Preserve the same high/low and spacious/busy concept; percussion uses low/heavy to high/light kit colors |
| Adjust Soft / Bold | Change the selected part's emphasis | Separate from pitch/activity; do not require mouse pressure or simultaneous modifier keys |
| Lift the hand | Make room | Silence is an intentional musical gesture, not an error to fill automatically |

Do not make pointer speed secretly control tempo, volume, brightness and rhythm at once. The default mapping must be understandable and repeatable. A fast scribble should remain bounded and musical rather than generating hundreds of notes. A chosen brush may later add expressive bends, but smooth-looking ink must not imply unsupported continuous pitch in the MVP.

### Musical guidance that preserves the user's choices

Offer three small relationship choices: **Follow**, **Answer**, **Explore**. Follow stays near the tune's melodic shape; Answer favors the spaces around it; Explore allows more departures while retaining the musical context. Start with Answer. Do not turn this into a page of theory settings.

The tool helps choose pitches, register and on-beat timing, while preserving the user's rising/falling contour, rests and relative density. Different drawn shapes must produce meaningfully different phrases. Do not replace every gesture with an unrelated polished preset, fill every silence, or claim that every possible scribble sounds beautiful.

For curated starters the harmony and useful phrase spaces are known. For imported music, show that guidance may need setup: offer a proposed musical home, a short audition and an easy correction. Do not imply perfect chord recognition for any imported file or promise to understand an arbitrary MP3.

### Capture good accidents without a recording ritual

Propose a rolling scratch memory holding the last **two completed loop passes plus the current pass** of pointer-generated musical events. These are temporary drafts, not automatically saved layers or microphone recordings. The current live stroke is bright; completed passes appear as small readable ribbons. Keeping a pass stores the actual notes that were heard, with no hidden regeneration.

**Keep last loop** explicitly selects the last completed pass, not the unfinished one. Before a pass finishes, show “First loop in progress” and make the unavailable action clear. Capture pointer activity only; an empty pass is not offered as a take. Briefly retain the preceding pass so an accidental extra scribble does not erase the good take. A separate **Keep this part** may save the unfinished pass with its actual rests and duration; never silently stretch it into a complete melody.

Once a take is kept, audition it on the next loop boundary and stop the live preview so it is not doubled. The next pointer press begins a new scratch pass against the existing layers. Keep, undo, replace, mute and compare must be obvious. No automatic accumulation of a new layer on every loop. Switch instruments between passes; do not transform a half-recorded take without a visible choice.

Explore whether a subtle one-loop **Catch next pass** control is easier to understand than the rolling-memory default. Present the tradeoff within this concept, not as a seventh visual direction. Missing a beat must not require stopping the song and navigating a recording dialog.

### Sculpt a take using musical intentions

A kept take becomes a compact, graspable ribbon. In an explicitly selected **Shape take** mode, let people lift a section higher, pull an ending down, thin or thicken activity, stretch a held moment into available space, and erase a region to introduce a breath. Here the ribbon's horizontal axis really is time; it is visibly separate from the live pad. Show the musical result before keeping an edit, preserve beat boundaries, and make every stroke undoable.

Use labels such as **Higher**, **More space**, **More movement**, **Softer**, and **Try another ending**. “Try another ending” changes only the selected ending and offers an A/B comparison. It does not silently rewrite the whole song. Keep an accessible simple event list as an alternative to freehand manipulation.

### Explore a few unusual possibilities

Show two or three of these as clearly labeled future interaction experiments, alongside a focused feasible first version:

- **Musical gravity:** faint, gently moving guide bands suggest fitting pitch neighborhoods. They guide the sound without moving the user's cursor. A restrained ghost trail makes the amount of assistance visible.
- **An answer shadow:** after a kept phrase, preview an optional quieter response in the next musical gap. Accepting it creates an editable layer; ignoring it changes nothing.
- **A breathing brush:** paint a gap through selected layers, creating intentional space while the backing continues. This is a reversible edit to timing/mutes, not a destructive eraser applied to an audio recording.
- **A motif stamp:** turn a favorite kept gesture into a brush. Place its recognizable contour in another phrase with explicit adaptation to that phrase's harmony and timing.
- **Energy postcards:** save Calm, Moving and Burst versions of the same loop, then audition transitions. These can eventually become game intensity layers, but a casual music maker just sees useful versions of their song.
- **Keep what I almost lost:** recover the preceding scratch pass as a visible take, then compare it with the current idea.

The exploratory quality should come from musical interaction, not from particles, abstract animation or an unexplained “AI magic” control. Do not require a cloud model for the core experience.

### Direction-specific design deliverables

Show the normal journeys through this alternative surface rather than bolting the standard piano-roll screen onto it. Include an annotated six-frame storyboard: choose a seed → audition a rising gesture → make it busier → keep the last pass → add/sculpt a second layer → export.

Provide a desktop live-pad view, a one-handed touch adaptation, a take-comparison/undo state, a selected-ribbon sculpting state, and the secondary “See the notes” view. Show the same gesture producing a visible contour and a few actual note events so engineers can understand the mapping. Include first-loop, empty-pass, missed-take recovery and interrupted-audio states.

For comparison with the other five directions, use the same Midnight Delivery source and eventual export results, but begin Flowpad on a two-bar excerpt of the eight-bar arrangement. Do not require all four tracks, a drum grid and a full arrangement timeline to occupy the main scratchpad. Show how users reach them when needed.

Evaluate perceived control as seriously as ease: can a beginner intentionally make a part rise, leave a gap, get busier, keep the correct take and reproduce a similar phrase? Explain where musical guidance helps and where it might make everything sound alike. This is a proposed direction to test, not a claim that drawing-to-music or gesture instruments have never existed.

## Concrete content for comparable mockups

Use **Midnight Delivery**, 128 BPM, D minor, four tracks, an eight-bar arrangement and a two-bar selected pattern. Include visible note events, named drum rows, a loop, an edited note selection, an inspector and a truthful saved-state label. The arrangement can contain Intro, Street A, Street B and Finish. Use enough real content to assess editing density. For direction 6, use the live-pad/kept-take equivalents specified above; keep precision views secondary.

Use a MIDI example called **my-first-theme.mid** with Melody, Piano Chords, Bass and Drums. In the conversion review, show “12 note positions need quantization” and “Pitch bend is unsupported in this version,” with explicit choices to adjust/omit or cancel. These are example UI data, not a claim that a parser exists.

Use library cards for Pocket Sunrise, Midnight Delivery v2 and Tiny Triumph. In the game handoff show “Action cue uses Midnight Delivery v2” and “A newer library version is available.” Make the update explicit.

## Deliverables for each direction

1. A short concept statement: who it suits, how it works, and its main tradeoff.
2. A polished desktop editor screen around 1440 × 1000 with realistic music content, visible selection and clear hierarchy.
3. A starter/library screen or state.
4. An arrangement or Game-mode screen showing the additional composition depth.
5. MIDI import-review and purpose-based export panels, with real choices and explanatory copy.
6. A compact tablet/phone adaptation around 390 px wide showing how audition, a simple edit, saving and export remain usable. Dense arranging can be best on desktop; do not simply shrink the desktop UI.
7. A short annotated walkthrough of the three journeys above. If interactive, make the core navigation and state changes work with sample data. If audio/editing is simulated, label that in the prototype notes rather than implying a functioning synth.
8. A small state strip covering empty, unsaved, saved locally, render progress, save failure, MIDI conversion warning, external-change conflict, and Enable/Resume Sound.

After the six concepts, provide a comparison table scoring beginner approachability, composition precision, playful feel, library reuse, game integration, mobile usability, expressive control, predictability and implementation complexity. Recommend one direction or a clearly described combination of two, explaining the tradeoffs. Do not merge all six into an overloaded dashboard.

## Accessibility and visual quality

Use readable type, strong focus indicators, accessible contrast and comfortable touch targets. Do not rely on color alone for notes, velocity, selection, errors or playing state. Provide numerical values for sound controls and a keyboard-friendly note list/inspector as an alternative to dragging. Explain basic terms contextually. Keyboard playback shortcuts must not fire while typing a title. Reduced motion should preserve useful playhead information without gratuitous animation.

No autoplay. A user gesture enables audio; interrupted audio gets an obvious Resume Sound control. Keep destructive actions recoverable with undo. Show useful loading/error/backup states without drowning the editing surface in warnings.

Use restrained musical personality and original visual assets. Do not copy BeepBox's interface, Nintendo artwork, recognizable game branding or a famous soundtrack. Avoid excessive neon, generic purple gradients, tiny pixel fonts for all text, and panels full of impressive-looking but meaningless controls.

The result should let us choose an interaction design and hand a coherent specification to an engineer. Prioritize the actual composing experience over decorative branding.
