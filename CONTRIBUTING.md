# Contributing

This is a planning and workspace scaffold, not a working game engine or composer. Start with the [repository strategy](docs/03-repository-and-asset-strategy.md) and [composer milestones](docs/04-chiptune-composer-plan.md#10-ordered-implementation-work-and-acceptance).

Use Node 24 or newer (CI targets Node 24). Run `npm ci` then `npm run check`. There are currently no application build/dev commands or installed production libraries. Add those with the first usable implementation, including appropriate validation.

Use focused branches and PRs after bootstrap. State the behavior, validation performed and remaining limits. Keep schema changes, migrations, fixtures and documentation together. Do not edit historical archives. New original code/docs use MIT; preserve notices and asset provenance.

Keep editor/storage/import dependencies out of playback bundles. The standalone composer and game studio must mount the same composer feature and use the same score and synth. The game runtime cannot depend on a mutable personal library. Check the package dependency graph as implementation is added.

Commit only redistributable original fixtures. Personal music libraries, imported recordings, credentials and build artifacts do not belong in this source repository. A sample template must be editable and exportable before it is called shipped.
