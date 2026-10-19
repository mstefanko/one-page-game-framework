# M1 independent review: disposition and re-review guide

October 19, 2026. This records the independently supplied ranked review and the implementation response. The original review correctly found six major defects despite passing acceptance commands. The refreshed [review handoff](35-m1-review-handoff.md) contains final measured results; do not reuse its original counts or golden bytes.

## Major findings

| Finding | Investigation and fix | Re-review entry point |
| --- | --- | --- |
| Exhausted restored counters can partially update a world | Confirmed. Validate safe integer counters at restore; preflight all required headroom before stepping/decoding and before level replacement clears actors. Reserve actor-spawn/execution increments, not merely one counter increment. Exhausted safe counters may restore so the last committed state round-trips; the next step rejects atomically before mutation. | `game-simulation/src/checkpoint.ts`, `simulation.ts`, counter regression tests |
| Shipped scenarios are vacuous; assertions scalar-only | Confirmed. Ship actionful scenarios with assertions, restart command coverage and recursively bounded structural comparisons of JSON values. A failing nested expectation must fail the command. | `examples/game-m1/scenarios`, `game-project/src/validate.ts`, `game-simulation/src/replay.ts`, `tests/game/tools.test.mjs` |
| Hit victims finish attacks during stun | Confirmed. Decision: unguarded damage interrupts the victim's execution. Gather simultaneous contacts first so genuine trades remain possible; apply interruption after gathering. Guarded contacts retain their separate rules. | `game-simulation/src/simulation.ts`, combat regressions |
| RAF exceptions silently freeze game | Confirmed. Report phase-specific faults visibly and stop safely. Presentation/input/clock faults can retry; simulation faults require restart/restore. A denied gamepad disables that device after reporting so other controls remain usable. | `game-runtime/src/index.ts`, `scheduler.ts`, host browser regressions |
| Back/forward cache returns a dead page | Confirmed lifecycle defect. Persisted pagehide pauses/retains resources; pageshow restores a usable paused host. Final pagehide disposes. | `apps/game/src/main.ts`, browser lifecycle regressions |
| Cmd/Ctrl shortcuts swallowed, keys stuck | Confirmed. Preserve native modifier chords and cancel held game controls when modifiers intervene, including missing macOS keyup. | `game-runtime/src/input.ts`, device tests and browser shortcut regression |

## Additional findings

- **Purity guard:** confirmed gaps for constructor escapes, locale-sensitive operations, Intl and import.meta. Expanded AST checks and escape fixtures. This remains a guard for trusted source, not a hostile-code sandbox.
- **Canonical JSON:** reject duplicate decoded keys and negative-zero number tokens on restore; normalize arithmetic zeros in live state. Continue full-byte save/restore checks.
- **Cross-field validity:** reject zero motion epochs, active executions during stun, won worlds without a living player in the goal, and defeated placement identities whose enemy remains alive. Idle actors with freeze/stun are sometimes valid: guard contacts, interrupted attacks and final-active-frame hits can produce them. Do not reject those legitimate states merely because execution is absent.
- **Rules identity:** confirmed the original SHA hashed a separate esbuild compilation, not shipping bytes. The approved policy now hashes a deterministic versioned runtime-source closure for checkpoint compatibility. A separate emitted artifact manifest hashes actual production files and records toolchain provenance. Compiler changes require cross-engine replay evidence, but do not gratuitously invalidate source-compatible checkpoints. This deliberately updates specification section 4; preserve actual builds for archival replay.
- **Host consistency:** prefer the newest in-memory save after a storage quota failure; restore scenario selection along with its world; prevent terminal Resume; reset interpolation on resume; interpolate camera and sprites on the same sample; clean up partial renderer initialization.
- **Tick order:** sample all AI intents before any actor moves, process buffers before motion/carry, and commit restart as the final flow transition. The old order was deterministic but observably different from the stated contract.
- **Campaign bookkeeping:** consume defeated placements on level entry, account for all death routes and cap the ledger so valid campaign state fits the checkpoint budget. This remains M1 bookkeeping, not full campaign migration.
- **Tool loader/dev refresh:** stat the opened file before bounded reads, enforce containment for single-file and split projects, reject unsafe link/file replacement, and handle create/delete changes as well as updates. Keep the last valid content after malformed changes.
- **Test count:** the earlier handoff said 380; the reviewer observed 381 in the mutable full checkout. Final counts must come from the isolated delivery branch and identify game/tool/browser totals separately.

## Intentional changes to expected evidence

Attack interruption, phase ordering, scenario content and identity policy change the replay baseline deliberately. A changed golden is justified by these reviewed decisions, not simply by a failing comparison. Inspect the new coverage and keep Node/browser full-byte equivalence. The long replay is not evidence of map transitions; the objective test supplies that coverage.

Use `docs/38-m2-handoff.md` for follow-on scope. The existing creative tools and unrelated local expansion work are outside this M1 commit. Physical GPU/controller/phone testing and unaided human playtesting are separate evidence gates; automated browser tests do not establish them.
