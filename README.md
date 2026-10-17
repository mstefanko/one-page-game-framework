# One-page game framework

A modular toolkit for making small games and creative assets that are useful on their own. The first planned tool is a chiptune composer: remix a starter, compose your own song, import MIDI, save reusable assets, and export music for games or other content.

**Status:** research, implementation plans and private npm workspace scaffolding. No composer, game runtime, synth, library service or export pipeline has been implemented or deployed yet.

## Plans and design handoff

1. [Research and decisions](docs/01-research.md) — primary-source findings, accepted recommendations, corrected claims, dependency/licensing choices, and remaining evidence gates.
2. [Architecture and implementation plan](docs/02-framework-plan.md) — layer contracts, headless runtime, interchangeable sprites, music/SFX, level and cutscene editors, local studio, live tuning, single-file export/recovery, and dependency-ordered milestones. Section 17 preserves the detailed source-linked game anatomy.
3. [Repository and asset strategy](docs/03-repository-and-asset-strategy.md) — personal GitHub monorepo, standalone tools, package boundaries, distribution, and local shared asset libraries with pinned game dependencies.
4. [Chiptune composer plan](docs/04-chiptune-composer-plan.md) — library comparison, composing workflows, MIDI conversion, exports, storage, UI states and ordered acceptance gates.
5. [Copy-paste Claude design prompt](docs/05-claude-design-prompt.md) — six distinct interface concepts, including Flowpad: a guided live music scratchpad.

Reference: [play Terminator: Liquid Metal](https://mstefanko.github.io/terminator-game/) · [pinned source](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html).

The repository/library and composer plans specialize the original architecture and prioritize a standalone composer track. Start composer implementation with C1: validated score contracts and a measured backend proof. Game-runtime work retains the original headless and Canvas-versus-LittleJS gates. The reference game remains separate and unchanged.

Track execution in [GitHub milestones](https://github.com/mstefanko/one-page-game-framework/milestones) and [implementation issues](https://github.com/mstefanko/one-page-game-framework/issues). The first composer task is [C1: contracts and backend proof](https://github.com/mstefanko/one-page-game-framework/issues/1), followed by [C2: the audible standalone slice](https://github.com/mstefanko/one-page-game-framework/issues/2). All seven seeded implementation issues are future work.

## Workspace

`apps/composer` and `apps/studio` are shells for two entry points to the same planned editing features. Shared packages separate project documents, music event compilation, Web Audio playback, editing, import/export, and asset storage. See [package responsibilities](docs/03-repository-and-asset-strategy.md#2-boundaries-and-folder-ownership).

With Node 24 or newer:

```sh
npm ci
npm run check
```

These commands install workspace links and check scaffold metadata, current relative documentation links and archived file hashes. There are no third-party production dependencies or application dev/build commands yet. See [contributor guidance](CONTRIBUTING.md).

## Ownership and publication

Personal repository: [mstefanko/one-page-game-framework](https://github.com/mstefanko/one-page-game-framework). Individual games can live in their own repositories and publish a single HTML file. Standalone tools will use conventional static builds; user libraries stay outside this source repo.

New original code and documentation use [MIT](LICENSE). Imported content, historical documents and future starter assets have separate provenance requirements; see [attribution boundaries](NOTICE.md).

[Historical drafts and supplied review reports](archive/README.md) are preserved for traceability. They may contain superseded or corrected claims and are not additional plans to follow.
