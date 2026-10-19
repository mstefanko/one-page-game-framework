# Repository direction after M1

Decision: October 19, 2026. Keep the existing personal GitHub monorepo at **mstefanko/one-page-game-framework**. Broaden the product description to **Pocket Game Toolkit**; retain the repository URL, npm workspace names and existing directory boundaries. A repository rename or package split is not required to build M2.

The [original repository strategy](03-repository-and-asset-strategy.md) already treats one-page games as an export target and keeps independently usable creative tools together. The implemented runtime now makes that distinction concrete. Renaming folders or publishing packages would create migration work without improving an integration boundary. Reconsider extraction when separate consumers, release schedules or maintainers actually need it.

## Ownership and layout

| Location | Responsibility |
| --- | --- |
| `apps/` | Independently runnable product shells: Score, Director, game player and, when committed, Assets. No game rules here. |
| `packages/game-project` | Bounded gameplay documents, immutable definitions and authoring contracts. |
| `packages/game-simulation` | Pure deterministic rules, state, checkpoint and replay. |
| `packages/game-runtime` | Browser scheduling, devices, rendering and presentation ownership. |
| Existing creative packages | Reusable Score/Director/Assets models and adapters; editor/service dependencies do not enter the player. |
| `examples/` | Editable, runnable games and focused integration examples; examples exercise production code. |
| `scripts/` | Current focused validation/build/benchmark commands. Extract `game-tools` only when M2 asset resolution/build APIs need a reusable package. |
| `tests/` | Cross-package/browser/build verification. Unit tests remain beside implementation. |
| `experiments/` | Optional isolated research. Never silently used as production evidence or dependencies. |
| `docs/evidence/` | Small reviewed fixtures, measured results and screenshots with environment/provenance. Generated builds remain ignored. |

Keep domain packages rather than making a generic engine bucket or one package per helper. A future standalone game can consume versioned runtime packages once the interfaces are proven; there is no reason to create that split for the first example.

## M1 commit boundary

The M1 delivery branch is `codex/game-runtime-m1`, based on the existing committed Director/Score history. Its game packages, app, content, tooling, evidence and documentation are isolated from the original checkout's unrelated Assets, Director expansion and music experiments. Those local changes remain in their original checkout and need their own review/commit. The branch includes no physical reorganization of those tools.

M2 must start from a committed baseline and explicitly resolve creative-tool prerequisites. In particular, the local Assets work is **not supplied by the M1 commit**. Do not quietly copy a dirty editor tree into a player build. Review and commit its required APIs separately, then record the prerequisite revision. See the [M2 handoff](38-m2-handoff.md).
