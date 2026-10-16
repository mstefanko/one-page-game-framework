# One-page game framework: research and review

Prepared October 16, 2026. This is a design package, not an implemented framework. The published Terminator game is unchanged.

**Reference game:** [Play Terminator: Liquid Metal](https://mstefanko.github.io/terminator-game/) · [Repository](https://github.com/mstefanko/terminator-game) · [Inspected revision](https://github.com/mstefanko/terminator-game/tree/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0).

Read these in order:

1. [How the existing game is built](docs/01-game-anatomy.md) — source-backed explanation of rendering, sprites, music, input, moves, levels, UI, cinematics, packaging, and testing. Includes instructions for another agent building a similar game.
2. [Framework and editor architecture](docs/02-framework-plan.md) — recommended boundaries, asset contracts, visual tools, export pipeline, implementation phases, and decisions to review.
3. [Existing frameworks and authoring tools](docs/03-existing-tools-research.md) — delegated research, official sources, comparisons, and licensing/export caveats.

The proposed product has three parts: a small runtime, a shared project format, and an authoring application. Agents and humans edit the same project data. Each game builds into its own self-contained `index.html`; the authoring application is not included in that file.

Recommended first proof: an original small arena game with two interchangeable character skins, one reusable move, a short editable synthesized track, a level, and a sprite-based cutscene. Use it to prove the contracts before migrating the complete Terminator campaign.
