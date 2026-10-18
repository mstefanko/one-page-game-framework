# Pocket Director: mockup review and selected direction

October 18, 2026. Review of the ten supplied screenshots and `Design system and delivery plan.zip`. This is a design assessment, not usability-test evidence. The archive identifies the screens as static and playback/connections as simulated. Its recommendations were treated as source material to evaluate, not instructions to execute.

Related: [agent and layered-set workflow](23-agent-assisted-director.md), [original implementation plan](20-cutscene-director-implementation-plan.md), [original design prompt](21-cutscene-director-claude-design-prompt.md).

Follow-on: the [consolidated implementation plan](20-cutscene-director-implementation-plan.md) incorporates these recommendations and adds reversible style/environment transformations. The [final Claude Design prompt](24-director-final-claude-design-prompt.md) requests the selected synthesis and missing screens.

## Recommendation

Use **Director's Desk's shot structure, Stagecraft's large visual editing surface, and Scene Kit's reusable content model**. Add a persistent direction/iteration panel as the main route to a first draft. Borrow Story Script for the structured brief and dialogue, and Pocket Timeline for precise timing.

The strongest complete manual concept is **1 — Director's Desk**. The strongest correction workspace is **3 — Stagecraft**. For the newly stated agent-heavy workflow, **4 — Story Script** becomes important at the beginning of a scene, and **5 — Scene Kit** supplies the asset architecture. **2 — Pocket Timeline** remains an essential precision view, rather than the default starting experience.

Do not combine five entire editors or put all their panels on screen. Build one scene document with three focused workspaces: **Direct**, **Edit**, and **Assets**. Timeline and script are views of the same data; the agent is another editor of that data.

## Concept-by-concept evaluation

| Concept / supplied frames | Strongest parts | Weaknesses | Pull into the product |
| --- | --- | --- | --- |
| **1 Director's Desk** — 1a–1g; screenshots 13:48:34 / 13:49:05 | Shot cards establish story order and pacing. Game-slot context is unusually clear. Friendly visual hierarchy, real scene preview, scoped action inspector, explicit game placement. Import wizard explains missing Walk and impact on other scenes. | Large top cards plus left cast/layers/library plus bottom timeline leave less room for the scene. Too much status prose competes with editing. Detailed integration/version choices appear early. Three shots work; twenty need a scalable navigator. | Scene/shot hierarchy, compact thumbnails with summaries, clear selected-shot scope, initial setup, readable light shell, phone Continue/Skip treatment. Make storyboard collapsible and virtualizable. |
| **2 Pocket Timeline** — 2a–2f; screenshots 13:50:23 / 13:50:49 | Best simultaneous actor/audio view. Grouped lanes, waveform, links such as “walk ends when line starts,” and before/after installation table. Voice/reveal/mouth lanes expand together. | Too many lanes, tiny text and muted contrast at once. Several closely packed play/replay/frame controls. A newcomer must learn trimming and clip relationships before creating anything. Permanently open library makes the stage small. | Expandable precise timeline, semantic timing links, dialogue lane expansion, comparison table. Default to collapsed actor groups and selection-specific lanes. |
| **3 Stagecraft** — 3a–3g; screenshots 13:51:14 / 13:51:34 | Largest stage; direct spatial editing; clear action card; in-context character fitting room and anchors; inline bubble editing; good disconnected-project fallback. Numeric “Exact keys” escape hatch is valuable. | Path/time handles, ghost actor, camera boundaries, safe area and floating toolbar compete for attention. Spatial handles and timing pills need careful conventions. Hard to understand all concurrent actions from one actor's view. The starting-pose toggle is insufficiently specific when a motion's endpoint is selected. | Main visual editing surface, context toolbar, anchor-fitting preview, inline dialogue editing, reversible spatial adjustments. Hide unrelated guides; move most timing edits to timeline/inspector. |
| **4 Story Script** — 4a–4e; screenshots 13:51:56 / 13:52:11 | Best connection between intent, dialogue and visible action. Line selection opens a compact beat timeline. Script-versus-recording difference is actionable. Cast/action capability matrix is useful for an asset audit. | A screenplay aesthetic adds text density and does not solve staging. Natural-language directions look executable but parsing/resolution is unspecified. A large matrix scales poorly for ordinary editing. Exact differences against “what the recording says” require a supplied transcript or transcription, not inference from a waveform. | Scene brief, editable shot intentions and dialogue, linked beat selection, stale-voice comparison. Keep free prose separate from committed actions and label uncompiled directions. Capability matrix belongs in Assets diagnostics. |
| **5 Scene Kit** — 5a–5g; screenshots 13:52:28 / 13:52:40 | Best modular-content story: preview pieces, filter by actor compatibility, distinguish customized instances, review affected scenes and pinned versions. Attractive path to repeatable shot recipes. | Library dominates the creative surface. Every type becomes a “piece,” which hides meaningful differences between art, behavior and audio. Copy/new/shared choices are cognitively expensive. Dropping a camera motion directly on the stage can obscure what it targets and when it starts. | Compatibility, reusable set/shot templates, changed-instance indicator, asset revisions and dependencies. Library opens on demand; ordinary edits always affect this scene unless explicitly promoted. |

These are expert judgments about the supplied designs, not measured conversion rates or user preference scores.

## Strengths across the set

The mockups retain actual creative controls instead of using an AI prompt as a substitute for editing. They distinguish game installation from local saving, represent reading pauses, expose sprite capability gaps, preserve optional voice, and show that one skin update need not silently change every scene. They also provide strong examples of music drill-in and return to the same shot.

Those should survive the agent redesign. In particular, a generated scene must still have ordinary editable actor motions, dialogue, audio and set layers. Otherwise the agent becomes the only way to repair its own result.

## Most important weaknesses across the set

### 1. They start after most of the difficult work has happened

The station looks complete, both actors exist, their clips and anchors are mapped, motion presets are ready, voice has been recorded and a music cue is selected. That is the expensive work the user wants an agent to do. The mocks mainly optimize editing an already assembled scene.

Add an initial brief, asset inventory, visual blocking draft, missing-asset decisions, generation/import progress and alternatives. A scene can be useful before polished art arrives: show a complete rough playthrough with labeled placeholders, rather than make the user resolve every asset before seeing pacing.

### 2. Non-character composition is hidden

“BG Rainy station,” “Rain” and “Glow” are insufficient to answer: move a building, add a doorway, place an actor behind a column, turn off a lamp, change only foreground rain, or reuse the platform in a new set.

Source inspection makes this concrete. The archive's `lc-stage.js` draws buildings, windows, columns, platform, rails and lamp within `station()`; `glow()` draws additive circles and `rain()` draws seeded marks. The helper then draws actors, lantern glow and rain in a fixed order. These are original placeholder drawing routines, not independently editable set assets. The screenshots demonstrate an appearance, not a production layer model.

Add an explicit **Set** group with selectable instances, groups, depth, masks, markers and effect parameters. The details and recommended asset pipeline are in [the agent/set plan](23-agent-assisted-director.md).

### 3. There is no review surface for an agent's work

All five assume the user knows what changed because they made the change. An agent may alter dozens of assets and timings. Chat prose saying “done” is not enough.

Add candidate versions, synchronized before/after playback, shot-level change summaries, previewable alternatives, and **Keep / Revise / Discard** controls. Clicking a summary such as “Rain reduced in Shot 2” should select that effect and affected time span. Show changes, not raw tool logs, by default.

### 4. Asset scope is too prominent, while creative intent is too weak

The copy/fork/shared version options are technically important but shouldn't be a repeated decision during composition. Default all manual and agent changes to the current working scene. **Save as reusable…** is a secondary operation; **Update shared asset…** carries a deliberate impact review.

Make creative intent durable: “tense, readable silhouettes, warm lantern against cool rain; keep the dialogue and courier unchanged.” A stored style brief and locks are more useful during iterations than repeatedly reminding the user about revision numbers.

### 5. Some precision controls imply unresolved semantics

“Ends when line starts” is a strong feature only with explicit retiming rules. Moving the line should either stretch the walk, shift it intact, or report that its locked start conflicts. The UI must identify which behavior is selected. No invisible dependency cycles.

Keep time and space clear: an orange stage handle changes position; time changes through the timeline or a labeled numeric field. At 8.4 seconds, selecting a key at 7.6 seconds may legitimately show a ghost pose, but it must be labeled as the selected key rather than the current actor pose. Differentiate **Shot starting pose**, **Action endpoint**, and **Key at playhead**; a binary pose/animate switch does not cover every selected object.

### 6. Dialogue editing can consume the entire workspace

Stale recording, mouth mapping, reveal rate, trim and wait policy appear at similar visual weight. Normal line editing should start with text, speaker and playback. Expand voice/cues when requested. In an agent workflow, one useful action is **Update this performance to match the line**, with a choice of available recording/generation capabilities and explicit estimated cost where applicable.

Known mismatch should say **Keep existing recording anyway**, not **Still matches**. Show whether a transcript was supplied, transcribed, or manually confirmed. Mouth cues and talk loops are separate levels of fidelity.

### 7. The interface is more explanatory than operational

The presentation boards rightly explain concepts, but those paragraphs should not all ship inside the editor. Move teaching text into first-use hints and contextual help. A compact confirmation should state target, scope, unresolved blockers and outcome. If nothing unusual changed, asset/version details can remain collapsed.

### 8. The comparison needs consistent fixture facts

Across concepts, the courier's listed talk capability and appearance vary. A fair next design round should use one exact capability manifest, actor scale, shot duration, selected object and change request. Preserve useful differences in interaction without changing the problem to make one concept look easier.

## Recommended interface with agent assistance

### Direct — the default

A slim left rail lists scenes and shots. The center contains a large stage and a compact shot ribbon/transport. The right dock contains **Direction**, **Inspect**, and **Changes** tabs. A concise brief above the conversation records style, intended story, target duration, required actors and constraints.

The prompt box is contextual rather than enormous. Chips show its scope: `Shot 2`, `Rain + lamp`, `8–13 s`, `Keep dialogue`. A user can select a scene object or draw an annotation on the preview, then request a change. The dock reports phases such as finding assets, assembling, validating and rendering a preview. It returns a candidate the user can play, compare, keep or revise.

Do not show an expanded library and expanded inspector beside an expanded agent conversation simultaneously. Inspecting a selected object switches the right tab; asking for a revision restores Direction. A narrow Assets drawer opens only when choosing material.

### Edit — manual control and precise correction

Use Stagecraft's visual manipulation plus Pocket Timeline's expandable lanes. The same selection/playhead remains. Show only relevant handles, motion path and keys. Double-clicking a caption edits text in place; numeric controls remain available. Agent assistance can be collapsed entirely. Manual changes become normal project revisions and are included in the agent's next context snapshot.

### Assets — sourcing, assembly and reuse

Use Scene Kit's previews and compatibility, Stagecraft's fitting room, and an optional Story Script capability matrix. Include sets, props, environment effects and lighting, not only characters. Offer assembled sets first, with **Open set layers** for deeper editing. Keep source/license/provider details available without filling every card.

### Review rather than a chat-only workflow

A candidate shows a playable preview and concise changes: “Kept actors and dialogue; moved the station back; added foreground rain; slowed camera in Shot 2.” Show the old and new scene at the same shot/local time, with linked scrubbing. Changed object outlines can be toggled. Accept a coherent group of dependent changes, not arbitrary raw JSON fields; rejecting a required asset must not leave clips referencing it.

Variants are labeled choices with thumbnails and previews, not duplicate paragraphs in a transcript. A user can keep Set B and Camera A only when the system validates the combined result. Locks are enforced by document commands, not merely mentioned in the prompt.

## Next mockup brief

Revise the chosen hybrid around six concrete screens:

1. **Describe a scene:** game slot, brief, style reference, asset strategy, target duration; “Build first draft” and “Start manually.”
2. **Draft assembling:** stage shows a playable blocked-out scene, with missing assets and an activity summary; Cancel preserves completed draft work.
3. **Direct and tweak:** large stage, compact storyboard, selected-object context in the direction panel, and contextual manual controls.
4. **Set layers:** expand a station into background/architecture/platform/foreground/lights/weather; move one lamp and edit rain without touching the building.
5. **Compare a revision:** synchronized before/after playback, changes, locks and Keep/Revise/Discard; show a human edit made while the agent was working.
6. **Connections and use in game:** connected local Claude Code, optional API-provider configuration, separate media capabilities, and final scene placement review.

Use this example revision across all screens: “Keep the characters, spoken line and platform layout. Make the station feel abandoned, reduce rain behind the speech bubble, brighten the lantern slightly, and give the keeper half a second before speaking.” Show what changes, what stays fixed, and how the user accepts only the desired result.

## Success criteria for the next prototype

A user should reach a rough playable scene from a brief without mapping every frame manually; replace one bad asset without regenerating the scene; change one shot without losing approved shots; manually move an actor then ask the agent to preserve that position; compare two variants at matched times; undo an accepted iteration as one operation; and finish through the existing explicit Use in game workflow.

Test these tasks with real users before claiming one concept is easier. Static boards cannot verify hit targets, focus, keyboard navigation, scrolling, timing links or the cost of moving between panels.
