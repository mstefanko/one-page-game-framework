# M1 game runtime: independent code-review handoff

Date: October 19, 2026. This document is for a fresh reviewing agent. The delivery branch is `codex/game-runtime-m1`, based on commit `71647d741f1a6f3de60e37c57f6c99e99564ee67`. This handoff describes the reviewed M1 slice and its follow-up fixes. Read the final verification section before treating any gate as complete.

## Review request

Review **M1 only** against [the authoritative v1 specification](32-v1-spec.md), especially sections 2–5, 7–8 and the new-session instruction. Find correctness defects, regressions, missing acceptance evidence and dependency-boundary violations. Prioritize reproducible findings with file/line pointers and a failing input or test. Do not expand the work into M2 integrations, an editor, RPG systems or networking. Do not modify the isolated experiments to make production behavior appear correct.

Start with [CONTRIBUTING](../CONTRIBUTING.md), current repository instructions and `git status --short`. The delivery branch was built in an isolated worktree to exclude unrelated local Assets, Director, Score and experiment changes. Review the branch against its recorded base, not against an arbitrary dirty checkout. No existing creative-tool package source was changed for M1. The [review disposition](36-m1-review-resolution.md) maps the independent findings to fixes; [M2](38-m2-handoff.md) and the [repository decision](37-repository-direction.md) define follow-on scope.

Three GPT-6.1 Sol agents implemented the core, browser host and tooling under a supervising agent. The supervisor added authoring schemas/parity tests, CI/config integration and this handoff, and reviewed integration issues. The host implementer also performed an independent review of the core. Your review should independently reproduce the claims below rather than relying on implementation-agent summaries.

## What was built

**First Light** is a small original placeholder-art platform/combat game. Walk and jump through two rooms, fight or pass a sentinel, use a quick strike or heavy strike, reach the final exit, lose and restart. The browser provides named scenario selection, an observation inspector, exact checkpoint save/import/export and restore. The initial screen waits for Start so reading instructions cannot cost the player health.

Gameplay content is validated JSON. The second room and second strike are authored documents using the same controller, collision, scheduler, input and checkpoint APIs. The simulation owns mutable fixed-point integer state at 60 ticks/second. Rendering uses detached observations, a Pixi 8.22.0 view and a single browser accumulator. No general ECS, behavior registry or asset-baking pipeline was introduced.

The implemented mechanics include indexed tile/static AABB collision, one-way surfaces, horizontal moving-platform carry, coyote time and input buffers, distinct body/push/hurt/hit shapes, ability phases, directional guarding, simultaneous hit collection, per-execution hit ledgers, participant hit-stop, death/goal flow and map-local runtime IDs. Campaign state currently records only visited maps and defeated placement identities; it is not an RPG campaign-save implementation.

## Code map

| Area | Start here | Review focus |
| --- | --- | --- |
| Project contracts | [types.ts](../packages/game-project/src/types.ts), [runtime.ts](../packages/game-project/src/runtime.ts) | Bounds, safe integers, stable IDs, strict record validation, canonical serialization and bounded JSON |
| Content codecs | [validate.ts](../packages/game-project/src/validate.ts) | Unknown fields, references, immutable copies, geometry/path validation and actionable pointers |
| Authoring schemas | [authoring.ts](../packages/game-project/src/authoring.ts), [definition parity tests](../packages/game-project/src/authoring.test.ts), [checkpoint schema parity tests](../packages/game-project/src/checkpoint-schema.test.ts) | Schema/codec structural parity; semantic rules shared through the codec; no authoring dependencies in player |
| Simulation ownership and order | [simulation.ts](../packages/game-simulation/src/simulation.ts), [state types](../packages/game-simulation/src/types.ts) | Tick ordering, counters, input buffers, motion bounds, AI, simultaneous trades, participant freeze and objective precedence |
| Collision | [collision.ts](../packages/game-simulation/src/collision.ts) | Swept indexed candidates, half-open boundaries, X-then-Y, stable ties, one-way crossings, carry/separation and thin obstacles |
| Inputs | [core decoder](../packages/game-simulation/src/input.ts), [browser devices](../packages/game-runtime/src/input.ts) | Persistent patches versus transient edges; same-tick taps/cancels; catch-up steps; held-state restoration; overflow and device disconnect |
| Checkpoints | [checkpoint.ts](../packages/game-simulation/src/checkpoint.ts) | All future-affecting state, exact identities, collection/reference checks, fresh-world restore, canonical roundtrip and counter exhaustion |
| Replay/scenarios | [replay.ts](../packages/game-simulation/src/replay.ts) | Authored assertions, repeatable active 10,000-tick fixtures, full-byte comparisons and restore coverage |
| Host lifecycle | [runtime index](../packages/game-runtime/src/index.ts), [scheduler](../packages/game-runtime/src/scheduler.ts) | One RAF, five-step debt cap, pause/cancel, view epochs, late initialization, disposal and storage failure |
| Presentation | [view.ts](../packages/game-runtime/src/view.ts), [art.ts](../packages/game-runtime/src/art.ts), [interpolation.ts](../packages/game-runtime/src/interpolation.ts) | Original atlas/font, independent gameplay geometry, camera rounding, identity/epoch interpolation, resource ownership |
| App | [app entry](../apps/game/src/main.ts), [Vite config](../vite.game.config.ts) | Dev-only bridge exclusion, validated content injection and source/content refresh |
| Authored game | [manifest](../examples/game-m1/game.project.json), [room 1](../examples/game-m1/levels/room-1.json), [room 2](../examples/game-m1/levels/room-2.json), [quick strike](../examples/game-m1/abilities/quick-strike.json), [heavy strike](../examples/game-m1/abilities/heavy-strike.json) | Distinct reusable data; stable IDs survive filenames; body/attack geometry is explicit |
| Tool loading/identity | [loader](../scripts/lib/game-tools.mjs), [SHA identity](../scripts/lib/game-identity.mjs) | Contained paths, bounded files, canonical content SHA-256, reviewed rules-source SHA-256 and separate actual emitted artifact manifest |
| Live validation | [dev plugin](../scripts/game-dev-plugin.mjs) | 150ms debounce, partial-write rejection, last valid state, races, valid rule changes loading actual new code |
| Purity enforcement | [guard](../scripts/check-sim-purity.mjs), [tool tests](../tests/game/tools.test.mjs) | esbuild dependency graph before tree shaking + AST checks, escape fixtures, staged/index behavior |
| Browser evidence | [host regressions](../tests/game/browser/host-regressions.spec.ts), [browser tests](../tests/game/browser/replay.spec.ts), [fixture entry](../tests/game/browser/fixture.ts), [Playwright config](../playwright.game.config.ts) | Independent Node/browser full bytes, mixed display schedules, real cancellation, lifecycle and logical screenshots |
| CI | [workflow](../.github/workflows/ci.yml), [pre-commit](../.githooks/pre-commit) | Additive game checks; retained creative-tool checks; all three Playwright engines |

## How to run

From the repository root, use Node 24 or newer:

```sh
npm ci
npm run dev:game
# http://127.0.0.1:4180/

npm run check:game-purity
npm run game:validate
npm run test:game
npm run game:scenario
npm run game:replay
npm run game:replay:golden
npm run game:benchmark
npm run check
npx playwright install chromium firefox webkit
npm run build:game
npm run test:game:browser
```

The build is `dist-game/`, a separate static site with relative asset URLs. Do not mistake `dist-game-fixture/` for a shipping player: it is a dedicated browser-test bundle. The dev preview and built fixture expose automation only for testing; the shipping app must not expose the development bridge, including when debug query strings are present.

For manual play: arrows move, Z or Space jumps, X uses the quick strike, C uses the heavy strike, V guards, Escape pauses. Touch buttons provide the same actions. Player-two bindings and gamepad mappings are shown in the UI. Select a named scenario, inspect it, save during a jump/attack/freeze/carry, advance, restore, and verify the restored state and subsequent behavior. Try held input followed by pause, blur, pointer cancellation, restart and checkpoint restore.

## Changes to shared infrastructure

M1 adds runnable `game-project`, `game-simulation` and `game-runtime` packages plus `apps/game`. Root scripts/dependencies and the lockfile are additive; Pixi is pinned to 8.22.0 and the AST parser Acorn to 8.15.0. TypeScript includes the game configs. `.gitignore` excludes generated game builds. CI has a separate game-runtime job, and the existing hook gains a focused staged purity check before the existing repository check. Contributor guidance and the README point to this slice.

Both authored rooms and strikes landed alongside the new reusable core. Adding room 2 and heavy strike uses only definitions; it did not require branches in the host, scheduler, input decoder or checkpoint format. This is a first implementation, so it is not evidence that an established core can support every future profile without changes. All lines in the new game packages are new shared-core code; existing Score, Assets and Director shared-core source changes attributable to M1: **zero**.

## Review priorities and known boundaries

- Probe deterministic behavior at collision seams, equal-distance ties, one-way ascent/landing, thin walls during carry, blocked carry retry/dismount, freeze while unrelated actors move, trade/guard ordering and multi-frame hit deduplication.
- Test malformed checkpoints without mutating the running world: incompatible identity, unknown fields, inconsistent counters, missing/duplicate actors or platforms, malformed ledgers, impossible rider contacts, overflow, fractions, NaN and excess size/depth. Serialization and restoring a valid checkpoint must preserve complete bytes.
- Check decoder/host agreement after a consumed press, a queued release and cancellation before another tick; also restore checkpoints with held inputs and resume. Interpolation resets must not change authoritative checkpoint bytes.
- Inspect the actual production dependency graph. No TypeBox/compiler, editor, service, Node APIs or dev bridge should enter the player. The purity guard is a regression check for trusted code, not a sandbox for hostile plugins.
- Treat snapshot comparisons as correctness checks only when initial identities, logs, restored state and schedules agree. A low-bit hash is never the pass criterion.
- The art and font are deliberately simple original placeholders. Asset skin/socket integration, Score/audio, Director cinematics, broad Playtest Lab, full RPG seams, self-contained HTML and mobile release hardening belong to later milestones.
- No physical-phone or human playtest success is claimed. Counters and repeated mounts do not establish memory-leak absence. The small-fixture benchmark does not validate the later 40-actor/20-projectile and 100/100 budgets.

## Final verification and evidence

Final measurements are recorded after the independent review fixes, from an isolated M1 delivery checkout on macOS arm64 / Apple M4 and Node 26.0.0. CI remains configured for Node 24. The prior handoff's 380-test count was inaccurate for the reviewer's mutable checkout (381 observed); the isolated branch excludes unrelated tests, so its total is different again.

| Check | Final isolated-branch result |
| --- | --- |
| `npm ci --ignore-scripts` | Pass from the isolated lockfile |
| `npm run check` | Pass: purity, golden replay, TypeScript, **348 repository unit tests**, creative-tool builds and game build |
| `npm run test:game` | **190 game unit tests** (included above) and **18 Node tool tests** pass |
| Validate, named scenarios, Node replay | Pass; four scenarios / 25 assertions, 10,000-tick exact replay |
| `CI=true npm run test:game:browser` | **40 passed, 2 intentionally skipped**; fresh isolated servers, Chromium/Firefox/WebKit. The Chromium-specific CDP BFCache test is skipped on Firefox/WebKit; synthetic persisted lifecycle checks run on all three |
| Real BFCache navigation | Pass with full Chromium in both headed local review and headless CI-mode verification |
| `npm run game:benchmark` | Pass: small-fixture step p95 **0.006–0.019 ms**, five runs in one process on M4; not a stress or GPU benchmark |
| Production bundle | **185,085 gzip bytes (180.75 KiB)**, sum of all emitted JS using Python gzip level 9 / mtime 0; excludes CSS/media. Actual artifact bytes verified by browser tests |
| Production boundary | No dev bridge with debug query strings; no editor/service/schema compiler/Node dependencies in the player |
| Diff hygiene | `git diff --check` passes; commit hook also checks staged pure sources |

Final rules identity: `sha256:314b9295c0573fbe0e133fafd2721e6a6353f4dd9557333538cdbb43c63bcf75`. Content: `sha256:c6378414fc59fdc346fb5f450eb8122268d71797d5ceffe78cc6ca4ff9a95a4e`. Emitted artifact set: `sha256:d204392ee3e5664e36e366a74b05e69b6e1ebb2a1982f262e50931720db04402`.

The prior runtime total was 180,992 gzip bytes with the same compression method; review fixes add 4,093 bytes. Compiler-default gzip (level 6) yields 185,721 bytes for this build; do not mix the two methods when comparing budgets.

The four named scenarios (`start`, `second-room`, `lose-and-retry`, `active-mechanics`) now execute real input and **25 assertions** covering progression, both attacks, death/retry and active mechanics. Arrays/objects compare structurally with bounded depth/node counts. Negative-control tests prove wrong expectations fail. `npm run game:scenario` runs `start`; use `-- --scenario <id>` for another authored scenario. The separate replay command owns the 10,000-tick stress of implemented mechanics.

Replay coverage after intentional combat/order changes is **117 jumps, 66 hits, 17 guards, 332 ticks with participant freeze, 270 rider-contact ticks, 856 restores, 828 restores during active mechanics and 33 restarts**. The long replay stays in room 1; [objective acceptance](../packages/game-simulation/src/objective.test.ts) and named scenarios supply level-transition/final-win coverage. Lower hit/freeze counts reflect attacks being interrupted rather than continuing during stun.

Saved evidence:

- [Chromium canonical replay](evidence/game-m1/chromium-canonical-replay.json), [Firefox canonical replay](evidence/game-m1/firefox-canonical-replay.json), [WebKit canonical replay](evidence/game-m1/webkit-canonical-replay.json).
- [Chromium lifecycle](evidence/game-m1/chromium-lifecycle-evidence.json), [Firefox lifecycle](evidence/game-m1/firefox-lifecycle-evidence.json), [WebKit lifecycle](evidence/game-m1/webkit-lifecycle-evidence.json).
- [Desktop](evidence/game-m1/desktop.png), [300px viewport](evidence/game-m1/small-300px.png), [Chromium logical 320×180](evidence/game-m1/chromium-game-logical-320x180.png), [Firefox logical](evidence/game-m1/firefox-game-logical-320x180.png), [WebKit logical](evidence/game-m1/webkit-game-logical-320x180.png).
- [Node benchmark](evidence/game-m1/node-benchmark.json): five runs in one process, 2,000 warmup + 10,000 measured steps each, two actors and all measured ticks playing. Stepping is timed separately from loading, snapshotting and input generation. This is a small-fixture trend, not the future 40/20 or 100/100 gate.
- [Emitted build manifest](evidence/game-m1/game-build-manifest.json): actual production HTML/JS/CSS file hashes, aggregate artifact identity and compiler provenance. `rulesBuildId` now identifies reviewed runtime source; it is deliberately independent of compiler output. Exact source/content compatibility is checked on restore; supported builds still require full-byte replay.

Counter exhaustion is explicit: safe but exhausted checkpoints may restore, including the last possible committed tick. Further stepping rejects before consuming inputs or mutating state. This preserves exact roundtrip at finite integer boundaries. Unsafe numeric values and impossible cross-field states reject before replacing the running world.

Remaining limitations: some semantic diagnostics identify the document/root rather than a precise field. Purity checks are a trusted-source regression guard, not an untrusted-code sandbox. Browser fault injection does not establish physical GPU recovery. No physical phone, real controller, measured memory-leak or unaided human feel/playtest pass is claimed. Those evidence gates and creative integrations remain later work.
