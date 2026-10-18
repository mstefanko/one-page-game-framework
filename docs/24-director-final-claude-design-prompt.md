# Claude Design prompt: final Pocket Director revision

Copy everything below the divider into Claude Design. Attach the earlier five-concept ZIP/screenshots if convenient, but the brief is self-contained. It requests **one final coherent product design**, not another concept competition. Its implementation counterpart is [the consolidated plan](20-cutscene-director-implementation-plan.md). Earlier findings: [mockup review](22-director-mockup-review.md) and [agent integration research](23-agent-assisted-director.md).

---

Design the **final, implementation-ready revision of Pocket Director**, a browser-based 2D game cutscene composer within a one-page game-making framework.

We previously explored five concepts: Director's Desk, Pocket Timeline, Stagecraft, Story Script and Scene Kit. Synthesize their best mechanics into **one consistent interface** and supply the missing agent, asset transformation and revision-review screens. Do not produce five alternatives, a marketing page, a moodboard, or a giant gallery with illegibly small screens.

The main promise is: **“Describe the scene. Watch it take shape. Direct the changes. Use it in your game.”**

The primary workflow is agent-assisted, but every generated scene remains editable through normal visual controls, and the entire tool works manually without an agent. The output is structured scene data and all required assets for an offline game. Video downloads are later review exports, not the core product.

## 1. Synthesize these strengths

- **Director's Desk:** clear scene/shot hierarchy, thumbnails and pacing, visible game placement, approachable light/warm chrome. Make the shot ribbon compact/collapsible so it does not consume the stage.
- **Stagecraft:** a large stage, direct actor/prop/path editing, contextual action controls, inline speech editing and character fitting-room import. Hide unrelated handles; do not cover the scene with permanent guides.
- **Pocket Timeline:** grouped actor lanes, expandable precise timing and waveform/mouth/reveal detail, explicit timing links such as “Walk ends when line starts.” It is the precision view, not the first thing a beginner must understand.
- **Story Script:** editable scene intention, shot beats, dialogue and clear recording-versus-text differences. Natural-language directions are either brief/proposed changes or compiled actions; do not pretend prose is already executable animation.
- **Scene Kit:** reusable sets/motions/styles, animated previews, actor compatibility, asset updates and pinned versions. The library is on demand; ordinary edits affect this scene instance. Save as reusable and update shared are secondary actions.

Use **Direct / Edit / Assets** workspaces over one document. Preserve scene, shot, selection and playhead when switching. Direct is the default. The right dock has **Direction / Inspect / Changes** tabs rather than three competing sidebars. Use normal readable UI typography, a substantial dark stage, restrained warm/light application chrome and consistent semantic status colors. Changing the artwork from pixel art to realistic must not change the app's design system.

## 2. Core layout and interaction

At approximately 1440×1000:

- A narrow navigator for game slots, scenes and shots.
- Large central stage, compact shot ribbon and an unambiguous transport.
- Expandable bottom timeline; collapsed groups initially.
- A right dock for direction, selected-item properties or change review.
- An on-demand asset tray or Assets workspace, not an always-open wall of cards.
- A concise top bar: project/scene, saved state, connected-agent indicator, Preview in game and Use in game. Keep technical configuration inside Settings.

Selection must agree between stage, shot ribbon, timeline and dock. A contextual request includes readable chips such as **Shot 2 · Rain + lantern · 8–13 s · Keep dialogue**. The prompt box is easy to reach without becoming a full-screen chat product.

Use distinct controls for **Play shot**, **Play scene**, and **Preview in game**. Game preview launches a known checkpoint; it does not promise arbitrary game rewind. Direct scene playback coordinates visuals/audio. Main timeline seconds are separate from optional music beats.

Manual editing needs **Shot starting pose**, **Action endpoint**, and **Key at playhead** states. A selected past key may show a labeled ghost; it is not the current actor pose. Numeric/keyboard alternatives accompany dragging. Linked timing must state whether it shifts an action or stretches it; conflicts with protected timing are visible.

## 3. One consistent example throughout

Project: **Lantern Courier**. Scene: **Arrival at the night station**. Game placement: **After loading-yard delivery → before Station level**. Both completion and skip continue to Station. Use original/reference artwork, not film/game franchise assets.

Base scene: night, rain, warm lantern against cool station architecture, pixel art. Three shots, **18 seconds base duration plus player reading time**:

1. **Arrival wide — 6 s:** courier enters left and walks to a platform marker; camera pans. Music: Midnight Delivery, quiet section.
2. **The warning — 7 s:** keeper turns and approaches, then says “The last train is gone. Keep your lantern lit.” Text starts at scene 7.60 s; imported `keeper_warning.wav` lasts about 4 seconds. Player reading gate at 13.0 s.
3. **Into the tunnel — 5 s:** courier turns/exits, title NIGHT LINE, fade, continue to Station.

Main editor playhead: **scene 8.40 s / Shot 2 at 2.40 s**. Use matching object positions and names in related screens.

Capability facts must stay consistent:

- Courier: idle, walk, turn/mirror; ground, hand and speech anchors; lantern attachment; no mouth frames and no nod clip. Text/portrait remains available. A nod cannot silently appear after a style swap.
- Keeper: idle, walk, turn, simple two-state talk; ground and speech anchors.
- Three appearance families preserve these actor identities across **8-bit-inspired**, **16-bit-inspired**, and **realistic 2D** art. Different dimensions/frame counts are permitted through mapped anchors/actions.
- 8-bit and 16-bit variants are ready in the example. A realistic preparation scenario begins with missing Keeper walk frames and a foreground architecture layer, then shows the completed candidate after preparation. This is a lifecycle, not contradictory asset facts.
- Logical staging space is 256×176, but realistic artwork may use higher texture resolution. Keep stage framing and actor positions recognizable across styles. “Realistic” means detailed 2D art, not a new 3D camera or physics engine.

Show meaningful visual differences between the three artwork styles in previews. Do not simulate style switching merely by changing labels or the editor's color palette. If artwork is illustrative, label its fidelity honestly while retaining consistent composition and identity.

## 4. The layered content model must be visible and understandable

The user should start with a reusable **Night station set**, then expand it when they want to edit parts. Show these groups:

- Distant sky/skyline.
- Station facade, doors and rear architecture.
- Platform, edge stripe, rails and ground decals.
- Actors and props that sort around them.
- Foreground pillars/railing that can obscure actors.
- Lamp, windows and lantern light effects, attached to stable positions/sockets.
- Background rain, foreground rain and optional mist.
- Captions, speech bubbles, titles and fades.

Provide select, group, lock, hide/solo and depth controls. **Protect from changes**, **hide while editing**, and **exclude from output** are different concepts; do not use one unlabeled eye/lock icon for all of them.

Users can move the lamp without moving the building, reduce foreground rain without touching actor art, or change a facade without losing platform markers. An entire static backdrop can still be a single image; do not pretend all imported pictures are already layered.

Library hierarchy: **assets → assembled sets → shot recipes**. A style family groups compatible appearances of the same semantic character/prop/set. Use friendly labels like **Other looks for this character**; technical IDs and hashes belong only in implementation notes.

## 5. Style and environment changes

### Style is an appearance change with an explicit scope

Changing style normally preserves story, dialogue/voice, actor identity, layout, paths, camera choreography, timing and outcomes. The app resolves compatible artwork and effects. It must not recreate the scene from scratch.

Show scope: **Selected object / This shot / This scene**. Scene-wide change lists objects with their own style overrides or protection. Offer explicit inclusion rather than silently replacing them. Caption styling is optional; caption text/readability is preserved. Music and voice are unchanged unless selected separately.

Style cards have honest readiness states:

- **Ready to preview** — compatible variants exist; no agent/model call needed.
- **Needs mapping** — art exists but actions/anchors need assignment.
- **Needs preparation** — some art or animation is missing.
- **Unsupported** — requested perspective/animation cannot be supplied by current tools.
- **Kept unchanged** — protected/overridden object.

For a prepared 8-bit→16-bit swap, show immediate candidate preview and what stays fixed. For realistic, show missing Keeper walk frames and foreground architecture, a partial preview explicitly marked incomplete, choices to prepare/import/choose another look, the available media-service connection, progress and estimated cost if supplied. A realistic still image is not proof a walking animation exists.

Prepared results are saved variants. Switching back reuses original assets. Do not imply free, instant or perfect conversion of arbitrary art. Do not show an agent regenerating every image for a rain-slider change.

### Weather is independent from art style

Offer **Weather**, **Time of day**, **Lighting**, **Surface state**, and **Ambience** as separate understandable controls, plus coordinated presets.

- Clear/sunny can change sky, light and dry/wet treatment.
- Rain changes depth-separated rain, light, wet decals and optional rain audio.
- Storm adds stronger weather and optional wind/lightning/thunder within supported capabilities.
- Weather visuals can change while voice/music remain fixed; ambience inclusion is explicit.

Use a concrete conflict: the scene's time of day is protected as Night and the user selects Sunny daytime. Show **“Daylight would change protected time of day.”** Offer **Use clear night**, **Include a daytime change**, or cancel. Do not show the sun appearing behind a night lock. Also show a successful daytime candidate after the user explicitly includes that change.

A background with baked-in sunlight/rain may require an alternate asset. Surface that named dependency. Weather cannot magically relight every flattened image. Show a manual lamp override surviving a preset change, and label it rather than silently resetting it.

Include an optional **Change during scene…** transition with duration/curve, distinct from changing the entire shot's environment. Reduced-motion/flash preferences suppress lightning/shake without changing story events.

## 6. Agent workflow and review behavior

The happy path:

**Brief → inspect available assets → rough playable draft → source/prepare missing pieces → validate/render → review → targeted revisions → keep → use in game.**

A user can request a complete scene, but the first result should be a playable draft they can improve. Show available assets and missing decisions rather than an endless spinner. Routine actions within the configured project/budget proceed without a permission dialog for each object.

The agent sees current scene data, selected objects/time, references, style brief, protected items and actual rendered frames. Activity labels should be meaningful: **Checking character actions**, **Assembling station layers**, **Preparing Keeper walk**, **Checking captions**, **Rendering preview**. Put detailed tool logs behind disclosure.

Each iteration is a candidate. Main-draft edits remain possible. The Changes view compares actual outputs at matching shot/time, identifies changes and preserved elements, and offers **Keep / Revise / Discard**. Accepted changes form one undo step. Multiple alternatives are explicit labeled options with thumbnails/playback, not an unbounded generation loop.

Support a request such as:

> Keep the characters, dialogue and platform layout. Make the station feel abandoned, halve the foreground rain, brighten the lantern slightly, and give the keeper half a second before speaking.

Show protected cast/dialogue/layout, changed environment/props/timing and the affected span. If speaking time is protected too, show the specific conflict rather than ignore the request or unlock it automatically.

A manual lamp move made while the agent prepares a candidate must not be lost. Show a compact object-level comparison and let the user keep their lamp position while accepting independent rain changes. Dependency-linked changes are accepted together; do not imply arbitrary checkboxes can produce a valid scene.

Stop preserves the last valid candidate and completed assets. Retry resumes missing work. A remote media job may finish after Stop; show its result as available but unapplied. Provider failure leaves the draft editable. History stores scene versions separately from conversations; resuming a conversation does not itself restore a scene.

## 7. Connections and services

Add **Settings → Agents & services**, accessible from the agent status chip. It belongs to the authoring app and can be shared with other framework tools.

Show two agent choices:

- **Use installed Claude Code** — connection to a user-managed native agent; its sign-in stays in the provider's native flow.
- **Anthropic API connection** — key configured through the local companion, with a masked saved-credential reference, Test/Reconnect/Clear and provider/model details.

A separate media-services area shows Image creation, Voice creation, Asset search and Mouth analysis with available/missing status. Connecting Claude does not automatically connect all these services. Imported audio and existing library art remain usable without generation.

Show the local companion status and explain the capability it provides in plain language. If unavailable, offer setup/reconnect and **Continue manually**. The static browser cannot secretly launch a CLI or store secrets inside an exported game. Do not design a custom Claude password form or pretend provider subscription eligibility/billing is guaranteed.

Include run budget/usage, permission scope and reference-data handling, but avoid a settings wall in the first-use flow. Say **Runs on this computer · model requests sent to provider**, not “everything stays offline.” Costs may be estimates; unavailable remaining subscription limits should not be invented.

## 8. Required final screens

Create one navigable prototype or separately named readable frames. Use shared components and consistent state. Prioritize S04, S05, S06, S08 and S09 as full-size working screens; supporting flows can be focused dialogs/sheets with clear entry/exit. Do not compress all fourteen into one tiny image.

| ID | Screen | Must demonstrate |
| --- | --- | --- |
| **S01** | Connections and first use | Existing Claude Code, API connection, separate media services, local-companion missing and connected states, Continue manually |
| **S02** | Describe a scene | Game slot/standalone, brief, style/environment references, cast, duration, asset strategy, budget scope, Build first draft and Start manually |
| **S03** | Shot plan and assembling draft | Editable shot cards, actual inventory/missing assets, playable blockout, meaningful activity, Stop and recoverable failure |
| **S04** | Final main director | Large stage, compact storyboard, right Direction/Inspect/Changes dock, scope chips, current selection/playhead, manual editing and expandable timeline |
| **S05** | Layered set editing | Building/platform/props/foreground/lights/weather separation, lamp selection/move, rain parameter, actor occlusion and protected layers |
| **S06** | Switch style | 8-bit/16-bit/realistic previews of the same scene; scope, preserved items, override exceptions, ready versus missing actions/layers |
| **S07** | Prepare missing style assets | Realistic missing walk/foreground tasks, fitting preview/anchors, media service, progress/estimate, partial candidate, retry without regenerating completed assets |
| **S08** | Weather and lighting | Sunny/rain/storm candidates, separated channels, baked-background limitation, protected-night conflict and clear-night remedy, manual lamp override |
| **S09** | Review and compare candidates | Matched shot-time before/after playback, concise change groups, preserved items, A/B variants, Keep/Revise/Discard and undo |
| **S10** | Targeted revision and manual conflict | Selected Shot 2 request, protected cast/dialogue/layout, human lamp move during agent work, independent rain change accepted without overwriting lamp |
| **S11** | Dialogue and music drill-in | Inline/Lines edit, known stale recording/transcript, voice/mouth/reveal detail, reading gate; Open in Pocket Score and return to same shot/time before explicit reference update |
| **S12** | Assets, fitting room and reuse | Asset families/looks, set/shot templates, import mapping for missing Walk, ground/hand/speech anchors, this-instance default and optional Save as reusable |
| **S13** | Use in game | Target slot, outcomes, selected style/environment, dependencies/blockers/size, explicit install, successful preview at trigger; disconnected download fallback |
| **S14** | Recovery and responsive states | Quota/auth/service loss, cancelled run with retained assets, reopened correct scene/session, 1280px editing arrangement and readable phone playback |

Include these linked walkthroughs:

1. **Brief → draft → revise → keep → install.**
2. **Ready style swap → realistic preparation → compare → keep → switch back from saved variants.**
3. **Weather change → protected-night conflict → clear-night choice or explicit daytime inclusion → inspect layers.**
4. **Manual edit during agent run → merge independent changes → preserve conflicting human edit.**

## 9. Implementation handoff quality

Deliver one consistent design system with color/spacing/type tokens, button/control hierarchy, selection/focus/error states and reusable components. Provide an annotated screen/route map and state-transition notes. Main components should include scene/shot navigator, stage tools, contextual prompt, run activity, preservation chips, style coverage list, environment inspector, variant comparison, timeline groups, fitting-room preview and install summary.

For each complex interaction, specify what changes in the document, what is preview-only, what is persisted, how it is undone and what happens on failure. Keep engineering terminology in the handoff appendix, not ordinary product copy.

Use readable sample text, distinguish missing/working/ready/installed states, and show keyboard focus and non-drag alternatives. Do not rely only on color, hover or precision handles. Tooltips supplement labels. Preserve captions/reduced motion in phone playback.

If interactive prototypes are supported, implement selection/navigation, editable sample dialogue, simulated candidate switching, style readiness, weather conflict, compare/keep/discard, settings states and basic numeric/path adjustments. Mark simulated generation/install/audio behavior honestly. Backend, actual model calls, authentication and game deployment are not required for this design deliverable; do not claim they are implemented.

End with a compact implementation handoff: chosen layout, components, data/state assumptions, priority order and unresolved visual decisions. Resolve routine design choices yourself. The result should be cohesive enough to implement without conducting another five-direction concept round.
