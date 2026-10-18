# Pocket Director

A local-first cutscene editor alongside Pocket Score. Built from the final S01–S14 design revision, with independent scene semantics, appearance variants, layered scenery and weather.

```sh
npm install
npm run dev:director
```

Open **http://127.0.0.1:4174**. `npm run build` builds Pocket Score into `dist/` and Director into `dist/director/`. The Director app works without a model connection. Browser drafts use a separate IndexedDB database from music projects.

## Working features

- Direct / Edit / Assets workspaces sharing scene, selection and playhead.
- Original 18-second, three-shot station starter; editable shots, dialogue, actor staging/endpoints, layers and camera playback.
- Pure 60 Hz evaluation, frame scrubbing, reading gates, skip/complete outcomes, embedded audio playback and reduced-motion player.
- Prepared 8-bit/16-bit swaps, separate weather candidates, protected properties, before/after review, conflict resolution and Undo.
- Framework asset packs with selective family import, immutable pack revisions, provenance, collision remapping and dependency-only exports.
- PNG + Aseprite JSON sprite imports with explicit semantic action mappings. Untrimmed, non-rotated sheets only.
- Static PNG/JPEG/WebP backgrounds and props; bind imported families to set layers.
- Full draft backup, portable scene packs, and a standalone offline HTML player using the same renderer.
- Local Claude Code or Anthropic API proposal adapter. No fake connected states or media generation.

## Claude connection

```sh
npm run director:companion
```

The companion binds `127.0.0.1:4175`. Open the editor’s agent connection, paste the pairing token printed in that terminal, and test. Tokens are kept in the browser tab’s session storage; API credentials never go to the browser. Sign in through Claude Code’s own terminal. The companion runs the user-installed, unmodified binary in an isolated temporary working directory, with file/shell tools and hooks disabled. It validates returned commands before producing a candidate. Keeping the candidate is an editor action.

For API mode, set `ANTHROPIC_API_KEY` and `DIRECTOR_MODEL` in the companion process environment or your system’s secret manager, then run:

```sh
npm run director:companion -- --provider api
```

Native runs default to a $1 provider-estimated budget (`DIRECTOR_RUN_BUDGET`), a three-minute timeout and 20 attempts per companion session. API mode is limited to one response / 4096 output tokens; **it does not enforce a dollar budget**. Configure account spending limits with the provider. Cancel terminates native execution or aborts API transport; an already processed provider request may still be billed.

Requests send the direction and validated scene/capability metadata, not image/audio bytes. This first adapter produces structured scene commands; it does not autonomously search/download external packs, generate art or synthesize speech. Imported assets remain usable without any provider. No live paid model request is needed for the test suite.

## Scene handoff and project registration

```sh
npm run -s director:cli -- demo > scene.pack.json
npm run -s director:cli -- validate scene.pack.json
npm run -s director:cli -- inspect scene.pack.json
npm run -s director:cli -- evaluate scene.pack.json --tick 504
npm run -s director:cli -- build scene.pack.json --out scene.html
npm run -s director:cli -- propose scene.pack.json --prompt 'Halve the foreground rain in The warning'
```

An external agent can inspect and validate the same pack without driving the UI. `propose` returns a candidate, not a changed game. A pack embeds the selected asset closure, so its player has no library, agent or network dependency.

A compatible project can keep a pinned scene-slot registry:

```sh
npm run -s director:cli -- install scene.pack.json --project /path/to/game --dry-run
npm run -s director:cli -- install scene.pack.json --project /path/to/game --expected-revision 0
```

Registration writes `director-scenes.json` atomically and preserves the previous registry. It checks the expected revision and rejects symlink registries. The game host must read the slot and use its complete/skip outcomes. This does **not** rewrite arbitrary game code or automatically patch Terminator. The browser can register after starting the companion with `--project /path/to/game`; otherwise download a pack.

## Asset model

Pack → family → appearance variant → semantic clips / frames / embedded media. A fighter pack is a source of cinematic animation, not combat logic. Instance position, motion, dialogue and weather remain outside imported artwork. Imported licenses are retained; a pack’s license does not replace different per-asset licenses. Pack updates are new revisions; importing does not silently mutate existing pinned families.

The runtime pack contains used families/variants and referenced media only. Use **Back up draft** for all authoring variants. Ready styles switch without model calls. The realistic option is an incomplete illustration study with missing keeper walking/foreground artwork, deliberately blocked from claiming readiness. A supplied still is not an animation.

## Verification and remaining work

```sh
npm run check
npm run test:director:browser
```

Read [the implementation plan](../../docs/20-cutscene-director-implementation-plan.md), [build contract](../../docs/25-director-build-contract.md), and [delivery evidence](../../docs/26-director-delivery.md). The larger R0–R8 plan includes further work: actual media-provider jobs, native ZIP/proprietary import adapters, full realistic art, advanced keyframe editing, Pocket Score copied-draft round trips, engine-specific in-game bridges and measured phone performance. This implementation is a working first release, not a claim that every roadmap gate is complete.

## Editing scenes

Use **New scene** in the header for an empty stage, a prompt, the station example or a recent saved scene. Prompt creation opens agent setup if needed and retains your brief. Blank scenes have no inherited station content. In Assets, add the starter library or import your pack, then place a family on stage; the inspector adds walks and dialogue. **Title card** also works without an actor.

Select a motion in the timeline to place its endpoint. **Stage operation** switches between the starting pose and endpoint. Drag the highlighted handle or character body; the pointer keeps its grab offset. Numeric inspector fields use logical scene coordinates. Drag a timeline clip to move it, or its edges to resize it. Arrow keys adjust one frame (Shift: ten). Each drag is one undo step; Escape cancels. Linked dialogue/motion timing is validated together.

The preview has a 768 × 528 CSS-pixel ceiling and fits down to leave room for controls. Collapse Timeline for more preview space. This sizing never changes exported resolution or camera framing.

Open **Camera & framing** for each shot. Wide/close/pan/push-in presets and numeric centers/zoom define the actual exported camera. The camera frames flat 2D artwork; other angles need matching set and actor views. **Ask agent to plan another angle** starts that inventory/staging request rather than pretending the current artwork can rotate.

Look choices show availability. Changing Look opens a **Preview only** comparison; **Keep revision** applies it. Missing pieces are listed and cannot be accepted as ready content. The current scene stays unchanged until you keep the candidate.
