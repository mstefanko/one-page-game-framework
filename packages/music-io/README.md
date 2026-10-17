# @onepage/music-io

Bounded source/library ZIP packs, strict MIDI preflight with explicit losses, MIDI export, and self-contained HTML player generation. `npm run build:player` bundles the shared runtime before tests/build.

Implemented limited adapters; unsupported expression/timing is rejected. WAV rendering lives in music-web-audio. No compressed audio/video export.

See the [current implementation plan](../../docs/06-pocket-score-implementation.md) and [validation limits](../../docs/08-implementation-validation.md). These workspaces remain private source packages, not published npm releases.
