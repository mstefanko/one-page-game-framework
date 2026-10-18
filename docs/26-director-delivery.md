# Pocket Director delivery and validation

October 18, 2026. Implementation branch: `codex/pocket-director-implementation`. Foundation commit: `531a925`.

## Implemented package boundaries

| Package | Responsibility |
| --- | --- |
| `director-core` | Portable types, original station fixture, validation, pure evaluator, scoped commands, preservation locks, appearance coverage and three-way candidate merge |
| `director-runtime` | Canvas rendering, embedded image/audio hosts, reading/skip/complete lifecycle and shared standalone player |
| `director-io` | Draft/version and pack sidecar storage, safe import, Aseprite/image adapters, identity remapping, selected dependency closure and offline HTML |
| `director-editor` | Direct/Edit/Assets, storyboard/timeline/stage, inspectors, fitting/import, compare/conflicts, persistence and export |
| `director-service` | Native Claude / API proposal supervision, token/origin protected loopback service, CLI and atomic pinned project registry |
| `apps/director` | Vite entry and companion connection UI; shipped alongside Pocket Score |

All workers used GPT-6.1 Sol, with exclusive file ownership and integration review. Existing uncommitted Pocket Score/Arcade work was preserved separately.

## Accepted design and corrections

The latest final ZIP is treated as reference material, not executable production code. We retained its warm shell, large stage, three workspaces, shot navigation, Direction/Inspect/Changes, candidate acceptance and manual/agent separation. Packs add explicit selection, action mapping, provenance and immutable version storage. Non-sprite images can become independently editable set/prop layers.

The prototype's simulated provider rendering, service connections, prices, generated frames and successful installation banners are not production facts. Preview rendering is local. Missing realistic art stays unavailable. Native authentication stays in Claude Code. Project registration accurately states that a game host must implement the slot contract.

Times are integer 60 Hz ticks. Shots and global audio cues use scene time; motion/dialogue/camera starts use shot-local time. This distinction fixes the prototype's otherwise ambiguous global/local timing labels. The original acceptance fixture has 6s / 7s + reading / 5s shots, the warning at 7.6s, and NIGHT LINE at the ending.

## Validation evidence

`npm run check` passes from a clean archive of implementation commit `c05173c`: 145 unit tests in 16 files, TypeScript, scaffold/link checks and production builds for both tools. Dependencies were installed with `npm ci --offline --ignore-scripts`. The shared working tree also passes 147 tests; its two additional music tests belong to unrelated uncommitted work and are not part of this branch. `npm run test:director:browser` passes all 6 Chromium tests, including selective pack import/persistence, incomplete-style blocking, companion authentication/origin rejection, edit/keep/undo/reload, offline file playback and 1280px layout. Tests cover scene/pack correctness, effective preservation, atomic merge, variable frame timings, lifecycle gates, import safety, provider proposals and registry rollback/conflicts. Browser tests exercise editing, acceptance/undo, persistence, downloads, offline player and compact layout.

No live paid Claude/media generation run was used to manufacture a connected demonstration. Provider behavior is verified through structured adapter tests; native CLI options were checked against the installed binary and official documentation. Final provider account authentication/entitlement remains the user's own connection step.

## Explicit remaining roadmap

- Media-generation and voice services, resumable asset-preparation jobs and visual frame feedback to agents.
- Curated realistic character/foreground animation and multi-style reference art QA; current detailed art is an illustration study.
- Arbitrary ZIP/native `.aseprite`/trimmed or rotated atlas adapters. Current import is framework JSON packs, untrimmed PNG+Aseprite JSON and ordinary images.
- Full timing/keyframe editor, arbitrary object additions and layered-set authoring beyond the current fixture/layer bindings.
- Pocket Score guarded music round trip, authored live-game trigger bridge and Terminator cutscene reconstruction. Existing music tooling remains separate.
- MCP transport, provider session history, durable multi-job run recovery and OS-vault credential setup UI. Current API credentials are environment-only; browser pairing is tab-scoped.
- Multi-browser/physical-phone accessibility/performance certification and comprehensive scenario-based UI polish.

These are the remaining R0–R8 release gates, not hidden mock implementations. The current editor can author and export scenes without them.

The original standalone fixture measures 23,045 bytes raw / 8,398 bytes gzip in the measured build. The complete Director editor JavaScript is approximately 101 KiB gzip. These are build-size measurements, not physical-phone frame-time or input-ready certification.

## Provider references checked

Native subprocess behavior and structured JSON output follow [Claude Code headless documentation](https://code.claude.com/docs/en/headless). Authentication remains in the unmodified installed binary, consistent with [Claude Code authentication and product-use guidance](https://code.claude.com/docs/en/legal-and-compliance). The separate API route uses the user's own key and explicit model selection. Recheck provider terms and capabilities before wider distribution.
