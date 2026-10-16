# Claude design prompt: five composer concepts

Copy everything below the divider into Claude Design. It is self-contained; no access to this repository is required. This asks for five design concepts, not five different technical architectures.

---

Design **five genuinely different interface concepts** for a browser-based chiptune music composer. Working product name: **Pocket Score**. The name is provisional. This is a standalone creative tool within a larger one-page game-making framework, but someone making music for a video or simply having fun must feel equally welcome.

The central promise: **“Make a little tune. Make it yours. Use it anywhere.”**

Produce five coherent visual/interaction directions, with high-fidelity screens or interactive prototypes as your environment permits. Do not give five color themes on the same layout. Show meaningful differences in information architecture, composing workflow and visual identity. Do not stop at moodboards or a marketing landing page.

## Audience and experience goals

We serve curious beginners who have never composed, hobby musicians who understand notes/patterns, and game makers who want original adaptive music. The beginner should choose a sample tune, press Play, move a note or change a rhythm, and hear a personal result within one minute. An experienced user should be able to import MIDI and work precisely without a long tutorial.

This is a small, playful music-making instrument with real editing depth. Use clear language and progressive disclosure. It is not a huge professional recording studio, a game-only settings panel, a social feed, or an AI prompt box. People actively compose by editing notes, rhythms, patterns and sounds. Suggestions can help, but visible editable music is the center of the experience.

No account is required. No cloud service is in the initial release. The first experience must work with local/browser saving and downloads.

## Required musical capabilities

- Start by remixing an original starter, starting blank, or importing MIDI.
- Starters include **Pocket Sunrise** (bright menu tune), **Midnight Delivery** (driving action), **Moss Lantern** (quiet exploration), **Copper Giant** (boss tension), **Tiny Triumph** (victory sting) and **Clockwork Steps** (an unusual phrase length). Show mood, tempo, short audition, and a small suggested edit on starter cards.
- Melody, Bass, Harmony and Drums are the four initial track roles. Users can rename/add tracks. Patterns are short reusable phrases; arrangements put patterns into a song.
- A piano roll supports placing, moving and resizing notes, velocity, selection, duplicate and transpose. A drum/step view supports toggles and accents. The interface must represent real editable note/rhythm data, not just decorative waveforms.
- Patterns can have unusual lengths, including 6.5 quarter-note beats, rather than being forced into four-beat bars. Show a clear phrase end independently of the bar ruler. Straight/triplet grids and scale highlighting help beginners.
- Arrangement controls include Intro / A / B / Ending, repeat, loop start/end, and editing a shared pattern versus making one instance unique.
- A sound inspector offers chip-inspired presets such as pulse lead, rounded bass, triangle pluck, soft pad, bell and noise drums. Start with understandable controls: brightness, attack, release, volume and pan. Advanced parameters can be tucked away.
- Transport includes Play/Stop, loop, tempo, current position, metronome, undo/redo and useful save state. Mixer includes mute/solo and level feedback.
- Optional Game mode supports cues such as Menu, Explore, Action and Victory, plus an intensity slider that brings layers in/out and an audition of a scheduled transition. A person just making a song can ignore Game mode.

## Three central journeys every concept must support

**1. Remix and share:** Choose Midnight Delivery → Play → change two melody notes → change a drum accent → switch the lead sound → save a version → download a WAV or standalone player.

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

## Five required directions

Develop these as starting hypotheses; give each a concise name and explain its strongest user fit:

1. **Pocket groovebox:** A tactile, playful instrument organized around pads, steps and a focused note editor. Fast experimentation and satisfying feedback; no unreadable imitation LCD text or decorative knobs that hide values.
2. **Pattern workbench:** A clear, precise, restrained editor with an excellent piano roll and arrangement. Comfortable for musicians while progressive disclosure keeps the beginner path short.
3. **Song sketchbook:** A bright, approachable notebook of musical phrases, cards and guided edits. Make composition feel like sketching while retaining precise notes, timing and arrangement.
4. **Scene soundtrack:** A story/scene-oriented workspace where musical cues and intensity are easy to understand, with a complete standalone song workflow. Avoid making “create a game project” a prerequisite.
5. **Remix playground:** A library-led, card-based starting experience centered on auditioning and combining original patterns, with a focused editor that reveals the notes underneath. It must allow genuine note editing and blank songs, not only preset assembly.

Vary navigation, primary editing surface, inspector placement, how starter guidance appears, how arrangement is revealed, and how the library connects to the song. Some may use tabs, others a focused canvas or split workspace. Different colors alone do not count as different concepts.

## Concrete content for comparable mockups

Use **Midnight Delivery**, 128 BPM, D minor, four tracks, an eight-bar arrangement and a two-bar selected pattern. Include visible note events, named drum rows, a loop, an edited note selection, an inspector and a truthful saved-state label. The arrangement can contain Intro, Street A, Street B and Finish. Use enough real content to assess editing density.

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

After the five concepts, provide a comparison table scoring beginner approachability, composition precision, playful feel, library reuse, game integration, mobile usability and implementation complexity. Recommend one direction or a clearly described combination of two, explaining the tradeoffs. Do not merge all five into an overloaded dashboard.

## Accessibility and visual quality

Use readable type, strong focus indicators, accessible contrast and comfortable touch targets. Do not rely on color alone for notes, velocity, selection, errors or playing state. Provide numerical values for sound controls and a keyboard-friendly note list/inspector as an alternative to dragging. Explain basic terms contextually. Keyboard playback shortcuts must not fire while typing a title. Reduced motion should preserve useful playhead information without gratuitous animation.

No autoplay. A user gesture enables audio; interrupted audio gets an obvious Resume Sound control. Keep destructive actions recoverable with undo. Show useful loading/error/backup states without drowning the editing surface in warnings.

Use restrained musical personality and original visual assets. Do not copy BeepBox's interface, Nintendo artwork, recognizable game branding or a famous soundtrack. Avoid excessive neon, generic purple gradients, tiny pixel fonts for all text, and panels full of impressive-looking but meaningless controls.

The result should let us choose an interaction design and hand a coherent specification to an engineer. Prioritize the actual composing experience over decorative branding.
