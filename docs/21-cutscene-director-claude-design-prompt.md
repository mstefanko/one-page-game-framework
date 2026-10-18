# Claude Design prompt: five cutscene director concepts

Historical exploration prompt. For the selected hybrid interface, missing agent screens, style/weather changes and implementation handoff, use the [final revision prompt](24-director-final-claude-design-prompt.md).

Copy everything below the divider into Claude Design. It is self-contained and requires no repository access. It requests interface designs/prototypes, not implementation of the game engine. Related: [implementation plan](20-cutscene-director-implementation-plan.md) and [research](19-cutscene-director-research.md).

---

Design **five substantially different interface concepts** for a simple browser-based 2D game cutscene composer/director. Working name: **Pocket Director**, part of the same creative-tool family as **Pocket Score**, a music composer. The name is provisional.

The promise: **“Take the characters and places from your game. Direct a little scene. Put it back into the game.”**

Produce high-fidelity application screens and, where your environment supports it, lightweight clickable prototypes. Design the editor itself, not a marketing page. Five color palettes on the same layout do not count. Vary the primary organizing idea, layout, navigation and editing workflow while supporting the same underlying capabilities.

## Product and audience

Users are solo game makers, hobbyists and creative beginners, with agents helping build their games. They want to arrange sprites, movement, speech, captions, backgrounds, camera motion and music without learning a professional animation suite. Experienced creators need precise timing, explicit keyframes and reusable assets when they ask for them.

The tool feels like a small movie editor built for playable game scenes. Its main output is an editable cutscene and all its assets, ready to install in a game. A movie download is a possible later review export. Do not make video formats or rendering settings the center of the interface.

The editor can work standalone, without a game or account. Users can save locally in the browser, keep versions in their personal library, download portable scene packs, and use a connected local game project when available. No cloud sync or public publishing service is assumed.

## The existing music-composer pattern to carry forward

Pocket Score has a **Game audio** workspace: pick a game, inspect its music cues and where they are used, preview a known game checkpoint, choose **Edit original**, **Edit assigned**, or **Start fresh**, and edit a working copy beside the game. One game preview stays mounted when switching layouts. **Pin working score to this cue** is an explicit action; editing or previewing does not change the game's assignment.

Songs also have named sections that can be auditioned and opened for detailed editing. This is separate from the game's context selector; do not imply that the existing tool synchronizes any musical phrase with arbitrary game time.

For Pocket Director, design this hierarchy clearly:

**Game section / trigger → cutscene → shot → actor/action/dialogue.**

Example: **Loading yard → After delivery → Arrival → Shot 2: The warning → Keeper's line.** Selecting a shot opens its staging and timing. The user can drill into its music cue in Pocket Score and return to the same scene, shot and playhead.

Distinguish **Preview in game**, **Play scene**, and **Play shot**. The scene transport coordinates its visuals and audio. A known game checkpoint may restart that context; arbitrary rewind of the entire game is not promised.

## Shared example for all five concepts

Use the same original pixel-art project, **Lantern Courier**, so the concepts can be compared fairly. Do not use Terminator characters, movie stills or franchise assets. Use a restrained 256×176 logical game stage enlarged crisply inside the editor; interface typography should remain normal, readable UI text.

The selected cutscene is **Arrival at the night station**, triggered after the loading-yard delivery and before the station level. Its three shots have 18 seconds of base authored time, plus any player reading pause:

1. **Arrival wide — 6 s:** rainy station platform, courier enters from the left using Walk to marker, lantern attached to the hand, camera slowly pans. Music: Midnight Delivery, quiet section.
2. **The warning — 7 s:** station keeper turns toward the courier. Bubble: “The last train is gone. Keep your lantern lit.” Include an imported voice recording of about four seconds and a simple optional talk animation. Player can finish revealing the line and then continue. Display that this shot can wait for the player; do not falsely promise an exact total playthrough duration.
3. **Into the tunnel — 5 s:** courier nods or uses an explicit available fallback, turns and exits right, title card “NIGHT LINE,” fade to black, continue to the station level.

At the main screenshot's playhead, show Shot 2 at 8.4 seconds of base scene time. Show enough authored content that the tool feels real: distinct actors, a background, one motion path, readable dialogue, a music strip and a few SFX markers. Avoid an empty canvas surrounded by generic panels.

Available pieces: Courier green/blue skins, Station keeper, Rainy station, Tunnel entrance, Walk to, Enter from left, Turn, Hop, Recoil, Fade, Pan, Push in, Speech bubble, Bottom caption, Portrait dialogue, Rain, Lantern glow, Footstep, Midnight Delivery music. Some actors have only idle/walk/talk; do not imply every action works on every sprite.

## Five required directions

1. **Director's desk — storyboard first.** Large shot cards and a clear scene overview lead the experience. A selected shot reveals stage and compact timeline. Excellent for pacing and rearranging a story; precision is available without taking over the overview.
2. **Pocket timeline — approachable movie editor.** Stage above a clean multitrack timeline, with grouped actor lanes and a focused inspector. Familiar drag/trim/snap behavior, far less density than a professional NLE. Make multiple actors and audio easy to coordinate.
3. **Stagecraft — direct manipulation first.** The stage is the main workspace. Select an actor, choose an action, drag a path and adjust endpoint/timing handles. A compact time ribbon and contextual controls reveal the sequence. Show how someone reaches precise keys without permanently covering the stage.
4. **Story script — dialogue and beats first.** An editable scene script pairs lines and stage directions with a live stage. Selecting a line highlights its speaker, voice and animation. Timing lanes unfold for a beat. This is still a visual director: backgrounds, paths, camera, silent actions and exact timing remain accessible.
5. **Scene kit — reusable pieces first.** An animated library of motions, dialogue styles, shot templates and sets leads into scene assembly. Drag or click pieces into a storyboard/stage, then customize their details. Make reuse and compatibility clear without reducing the tool to a preset slideshow; blank scenes and genuine keyframe editing remain possible.

Give each a distinct visual identity and primary workflow. Explore light and dark treatments where useful, but differences in interaction matter more than color. Do not let one direction quietly omit speech, custom imports, precision timing or game placement to appear simpler.

## Capabilities every direction must make understandable

### Scene organization and preview

- Game scene slots with “Where used,” current assignment, thumbnail, and a clear path to edit original/assigned or start fresh.
- Shot add, name, reorder, duplicate and duration editing; thumbnail and dialogue summary.
- A substantial live stage with background/foreground layers, actors, camera crop and caption safe-area guides.
- Play/pause, replay shot, play scene, frame step, scrub, zoom and markers. Timeline uses seconds; a beat grid is optional for a selected music cue.
- Selected object and selected time remain obvious. Stage, storyboard, timeline and inspector selections agree.
- A visible distinction between **Set starting pose** and **Animate at playhead**. Dragging must not silently create a keyframe.

### Characters and modular animation

- Add characters from **This game**, choose a skin, and use an optional distinct close-up portrait.
- Apply reusable actions such as Walk to, Turn, Hop, Recoil and Exit; adjust duration, path, facing, ease, repetition and destination. Show the motion path on stage when selected.
- Animation clips use available character capabilities such as idle/walk/talk. A static imported PNG can move/fade/bob, but does not magically contain walking frames or mouth art.
- Equipment can follow a hand socket; speech can follow a speech anchor. Put technical mapping in import/advanced settings, with friendly wording in ordinary editing.
- Save a custom motion or shot as a reusable library piece. Distinguish changing this instance, forking a piece and saving a new shared version.
- A skin replacement previews affected animations and shows a useful missing-action warning with a remedy.

### Speech, text and music

- Editable dialogue lines with speaker, text, reveal speed, start/duration, and advance behavior. Support speech bubbles, bottom captions, portrait dialogue and free title cards.
- Optional imported voice recording with waveform/trim and a clear link to its text. Editing the text can mark a recording as needing review.
- Optional talk animation or manually editable mouth cues. Show a graceful text/portrait-only state if the character has no mouth frames.
- No automatic voice generation or perfect lip-sync promise. An automatic mouth-analysis extension may appear only in a labeled future note, not as required functionality.
- A player can reveal a line, advance after reading, or skip a scene. Show a “Wait for player” marker and the difference between base duration and extra reading time.
- Music and SFX have their own lanes. A music clip can **Open in Pocket Score**, edit a copy, and return to the same shot. Updating the scene's music reference is explicit.

### Asset library, custom import and updates

Provide **This game / My library / Starter pieces / Import**. Let users search by kind/name/tag, preview animation, and see compatibility. Include characters, backgrounds, props, motions, camera moves, dialogue styles, effects, music and audio.

Show an import flow for a custom sprite sheet or Aseprite-exported PNG+JSON: preview frames, map idle/walk/talk, set ground anchor and optional speech/hand anchors, confirm where to save. Include ordinary image/background and voice-audio imports too. A missing required action should have a concrete fix, not a vague error.

**Find more assets** can open curated external sources and bring the download back through Import. Do not invent a universal marketplace or imply search results automatically have the right animation rig/license. A source/license field can live in asset details.

**Update asset** previews a new version, lists affected scenes and compatibility differences, and allows a deliberate replacement. Existing games keep their pinned version until updated.

### Save and use in a game

Clearly separate:

- **Saved on this device** — recoverable working draft.
- **Save library version** — a reusable named version.
- **Download scene pack** — editable scene plus all dependencies, usable as a backup and by agents.
- **Use in game** — install into a selected connected game slot, or download a pack if no writable connection is present.

The Use in game review should show the target (**After delivery → before station level**), scene version, added/updated assets, any missing bindings, and **After scene / If skipped → Continue to station**. The result may say **Installed in Lantern Courier** and offer **Preview at trigger**. Do not claim a browser download has edited an arbitrary disk folder.

Agents consume the same scene data and installation manifest. Ordinary users should not need to see JSON, hashes, command lines, internal package names or bridge protocols. Advanced **Copy handoff** or **View integration details** may expose useful placement information without taking over the primary flow.

## Required screens and states

For each of the five directions deliver:

1. **Main editing screen**, around 1440×1000, with the shared example actively edited and enough detail to judge its workflow.
2. **Import/update library state**, showing a new character sheet and a missing Walk mapping with an actionable remedy.
3. **Dialogue/speech detail state**, showing editable text, linked recording, talk capability and wait-for-player behavior.
4. **Use in game review/result**, showing placement and pinned dependency update clearly.
5. A short illustrated interaction sequence: game slot → shot → edit motion/dialogue → preview → use in game.

You may combine detail states as inset frames if necessary, but keep text readable. Show how music drill-in and return work at least once in each concept's sequence. Include a compact 1280px layout treatment and one phone playback view with readable captions and advance/skip controls; a full mobile editor is not required.

Also cover these states across the set: first use with no project, saving/unsaved changes, unavailable game connection with download fallback, missing asset, stale recording after a text edit, conflicting external project change with a retained draft, unsupported character action, and successful installation. Explain where each lives rather than designing an error dashboard.

## Interaction, visual and accessibility requirements

Use clear labels and progressive disclosure. Keep the stage prominent. Show real readable text and useful thumbnails. Avoid decorative control panels, dense unlabeled icons, enormous dead space, tiny timeline text and giant AI prompt fields. Pixel artwork belongs in the scene; pixel typography should not make editing difficult.

Provide click/keyboard/numeric alternatives to dragging and color-independent track identification. Include focus, selection, hover, disabled and error states. Destructive replacement must explain its scope. Avoid accidental global edits to shared pieces. Motion/flash controls should support reduced-motion playback without hiding story information.

If producing prototypes, simulate the meaningful actions: selecting shots and tracks, moving/retiming an action, editing a line, previewing, opening the library/import inspector and choosing a target slot. Mark any simulated playback or integration accurately. Use original placeholder art if needed; do not pretend the backend or full game runtime is implemented.

## Final comparison

Finish with a compact comparison of all five concepts: best user, strongest workflow, learning burden, timing precision, dialogue strengths, library/reuse strengths, weaknesses and likely implementation complexity. Recommend a direction or a clearly described combination based on usability, not visual novelty alone. Preserve all five alternatives so I can choose.
