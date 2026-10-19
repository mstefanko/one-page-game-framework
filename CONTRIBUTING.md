# Contributing

Pocket Score is the first working feature slice. The first game-runtime milestone is implemented separately from the creative tools; the broader framework remains in development. Start with the [current implementation plan](docs/06-pocket-score-implementation.md) and [repository strategy](docs/03-repository-and-asset-strategy.md).

Use Node 24 or newer (CI targets Node 24). Run `npm ci` then `npm run check`. `npm run dev` starts the composer; `npm run build` generates a static distribution and the embedded offline-player runtime. After `npx playwright install chromium`, run `npm run test:browser` against the built distribution and local Vite server. CI installs browser system dependencies too.

The bootstrap checkout uses the repository's [.githooks/pre-commit](.githooks/pre-commit), which runs the scaffold check and staged whitespace check. For a fresh clone, `npm run setup:hooks` opts this repository into that hook; it replaces any inherited hooks path for this repository only. This avoids requiring the bootstrap machine's global Ruby/Overcommit configuration in a Node project. CI remains the shared check. Extend the hook and CI with meaningful implementation checks as code arrives.

Use focused branches and PRs after bootstrap. State the behavior, validation performed and remaining limits. Keep schema changes, migrations, fixtures and documentation together. Do not edit historical archives. New original code/docs use MIT; preserve notices and asset provenance.

Keep editor/storage/import dependencies out of playback bundles. The standalone composer and game studio must mount the same composer feature and use the same score and synth. The game runtime cannot depend on a mutable personal library. Check the package dependency graph as implementation is added.

Commit only redistributable original fixtures. Personal music libraries, imported recordings, credentials and build artifacts do not belong in this source repository. A sample template must be editable and exportable before it is called shipped.

The Terminator adapter accepts an explicitly supplied trusted local source file with `npm run import:terminator -- /path/to/index.html`. Its generated preview stays in the ignored `apps/composer/public/local-games` directory for the development server. Production builds disable automatic public-directory copying and emit the dependency notices explicitly; imported game content is excluded. Keep new public release assets explicit in the Vite build configuration. Local Terminator browser tests are additional coverage when the import exists; public CI does not fetch or redistribute that game.


## Game runtime M1

Read [the M1 specification](docs/32-v1-spec.md) and [review handoff](docs/35-m1-review-handoff.md). Run `npm run dev:game` for the local First Light game on port 4180, or `npm run build:game` for `dist-game/`.

Focused checks are `npm run check:game-purity`, `npm run game:validate`, `npm run test:game`, `npm run game:scenario`, `npm run game:replay` and `npm run game:replay:golden`. The golden replay is an explicit behavior baseline; update it only after reviewing an intentional rules/content change. `npm run game:benchmark` measures only the small M1 fixture. After `npx playwright install chromium firefox webkit`, use `npm run build:game && npm run test:game:browser` for exact 10,000-tick browser replay and host checks. Browser tests need permission to launch browser processes and bind local ports. The separate CI job installs all three engines with system dependencies.

Pure gameplay lives in `packages/game-simulation`, bounded definitions/codecs in `packages/game-project`, and browser ownership/presentation in `packages/game-runtime`. Authoring schemas are a separate export. Never import a schema compiler, browser API, storage, clock or editor into the simulation. The pre-commit hook checks relevant staged pure code before the existing repository checks; partially staged pure code must match the files being verified.

Edit the JSON documents under `examples/game-m1`; IDs remain stable when files move within their document directory. The dev server validates edits after 150ms, reports file/pointer diagnostics, and retains the last valid game on invalid writes. Valid changes restart the named scenario. Keep the isolated proof and benchmark unchanged. New content should add data rather than special cases in scheduler, input or snapshot infrastructure.
