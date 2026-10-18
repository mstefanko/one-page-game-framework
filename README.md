# One-page game framework

A modular toolkit for making small games and creative assets that are useful on their own. The first tool is Pocket Score, a browser chiptune composer: remix a starter, compose your own song, import MIDI, save reusable assets, and export music for games or other content.

**Status:** a working composer with Sketch/Studio, live takes, a playable musical character in Arcade, IndexedDB drafts/versions, MIDI and portable packs, WAV and offline HTML players. Game audio can adapt the actual local Terminator game through an explicit source import; the original Lantern Courier fixture remains available without that import. The full game framework and arbitrary game import remain planned. Source publication does not deploy a composer website.

Start with [the Arcade experiments plan](docs/15-arcade-experiments.md), [composing alongside the game](docs/16-compose-with-game.md), [the musical-play option study](docs/17-musical-play-research.md), and [validation and remaining gates](docs/08-implementation-validation.md). The [integrated plan](docs/14-playable-composer-plan.md), [original composer plan](docs/06-pocket-score-implementation.md), and [backend proof](docs/07-backend-proof.md) retain the architectural context.

## Plans and design handoff

1. [Research and decisions](docs/01-research.md) — primary-source findings, accepted recommendations, corrected claims, dependency/licensing choices, and remaining evidence gates.
2. [Architecture and implementation plan](docs/02-framework-plan.md) — layer contracts, headless runtime, interchangeable sprites, music/SFX, level and cutscene editors, local studio, live tuning, single-file export/recovery, and dependency-ordered milestones. Section 17 preserves the detailed source-linked game anatomy.
3. [Repository and asset strategy](docs/03-repository-and-asset-strategy.md) — personal GitHub monorepo, standalone tools, package boundaries, distribution, and local shared asset libraries with pinned game dependencies.
4. [Chiptune composer plan](docs/04-chiptune-composer-plan.md) — library comparison, composing workflows, MIDI conversion, exports, storage, UI states and ordered acceptance gates.
5. [Copy-paste Claude design prompt](docs/05-claude-design-prompt.md) — six distinct interface concepts, including Flowpad: a guided live music scratchpad.

Reference: [play Terminator: Liquid Metal](https://mstefanko.github.io/terminator-game/) · [pinned source](https://github.com/mstefanko/terminator-game/blob/00b2f8b1bdf02f82576ab15e29d9ba7c4f46b7b0/index.html).

The repository/library and composer plans specialize the original architecture and prioritize a standalone composer track. Game-runtime work retains the original headless and Canvas-versus-LittleJS gates. The reference game's original source remains separate and unchanged; its development preview is generated locally.

Track execution in [GitHub milestones](https://github.com/mstefanko/one-page-game-framework/milestones) and [implementation issues](https://github.com/mstefanko/one-page-game-framework/issues). The first composer task is [C1: contracts and backend proof](https://github.com/mstefanko/one-page-game-framework/issues/1), followed by [C2: the audible standalone slice](https://github.com/mstefanko/one-page-game-framework/issues/2). Implementation now covers parts of C1–C3; issue completion must follow the documented acceptance gates, including device listening.

## Workspace

`apps/composer` hosts the shared React editor. `apps/studio` remains the future framework host for that same editor. Shared packages separate project documents, music event compilation, Web Audio playback, editing, import/export, and asset storage. See [package responsibilities](docs/03-repository-and-asset-strategy.md#2-boundaries-and-folder-ownership).

With Node 24 or newer:

```sh
npm ci
npm run check
npx playwright install chromium
npm run test:browser
npm run dev
```

Open the local URL printed by Vite (normally port 4173). `npm run check` checks repository metadata, TypeScript, unit tests and a production build. Browser tests exercise real audio rendering, offline player downloads, editing, persistence and game preview. `npm run build` emits `dist/` with relative asset URLs for a static host, including GitHub Pages under a repository subpath. A backend, account and CDN are not required.

Drafts and saved versions live in IndexedDB on this browser/origin. They are not cloud backups. Download an editable source pack or a library backup from Library; game assignments have their own export. Opening the app on another origin, browser or device creates a separate library. See [contributor guidance](CONTRIBUTING.md).

## Playable composition and the actual game

Arcade offers three experiments: **Phrase Rider** steers continuing musical ideas, **Groove Fighter** conducts drum grooves and fills, and **Ribbon Lead** turns held movement into a scale-guided melody. Jam without recording, choose the backing, then capture one bounded loop. Weapons select instruments; kept takes become ordinary editable parts. The [musical-play research](docs/17-musical-play-research.md) compares ten concepts and explains the limits of the music rules.

To connect your existing local Terminator checkout:

```sh
npm run import:terminator -- /path/to/terminator-game-repo/index.html
npm run dev
```

Open a song, then **Game audio** or **Preview game beside editor**. The project selector offers Terminator and the original fixture. The import generates an instrumented development copy and an editable audio catalog; it does not edit the original game. Generated files are ignored by Git and excluded from `npm run build`, so the public static distribution contains no imported game assets. A fresh checkout can use the original fixture immediately.

Use **Edit original** to begin with a copy of a game cue, or **Start fresh** to compose a new one. Working-score monitoring keeps the game and its sound effects running while the editor plays your music. Live score edits apply at a loop boundary. Switching back to original/saved music is an audition choice; assigning the result to a cue remains an explicit save.

See the [Arcade implementation plan](docs/13-arcade-implementation.md), [Terminator integration guide](docs/12-terminator-integration.md), and [integrated execution plan](docs/14-playable-composer-plan.md) for controls, package ownership, acceptance gates and follow-up experiments.

## Ownership and publication

Personal repository: [mstefanko/one-page-game-framework](https://github.com/mstefanko/one-page-game-framework). Individual games can live in their own repositories and publish a single HTML file. Standalone tools will use conventional static builds; user libraries stay outside this source repo.

New original code and documentation use [MIT](LICENSE). Imported content, historical documents and future starter assets have separate provenance requirements; see [attribution boundaries](NOTICE.md).

[Historical drafts and supplied review reports](archive/README.md) are preserved for traceability. They may contain superseded or corrected claims and are not additional plans to follow.

## Pocket Director

The cutscene tool now lives alongside Pocket Score. Run `npm run dev:director` and open `http://127.0.0.1:4174`. It includes layered staging, dialogue and audio, prepared looks/weather, asset-pack and image/sprite imports, candidate review, persistent drafts and offline HTML output. `npm run director:companion` enables a separately paired local Claude connection.

Read the [Director quickstart](apps/director/README.md), [implementation plan](docs/20-cutscene-director-implementation-plan.md), and [delivery evidence and remaining gates](docs/26-director-delivery.md). The realistic-art study and media generation are explicitly incomplete; project registration requires a compatible game host.
