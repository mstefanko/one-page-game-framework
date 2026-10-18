# Pocket Director implementation contract

This implements the October 18 final S01–S14 handoff. The attached HTML is a design reference, not a production implementation. Its agent runs, spending, media generation and installations are simulated. The implementation must expose real readiness and keep missing services explicit.

## Parallel ownership

- Core: `packages/director-core`: canonical types, original fixture, validation, evaluator, commands, preservation, candidates, merge and coverage.
- Editor: `packages/director-editor`: React shell and workflows, styles, editor tests. Uses the shared renderer and evaluator.
- Runtime and I/O: `packages/director-runtime`, `packages/director-io`: shared Canvas renderer/player, storage, pack import/export, offline HTML.
- Integrator: app entry, root tooling, local companion/CLI, browser tests, documentation and cross-package fixes.

The foundation contract is `packages/director-core/src/types.ts`. Additive changes are coordinated. No worker edits another worker's files without notifying the integrator. Existing Pocket Score/Arcade changes are unrelated and must remain intact.

## Public API agreement

Core exports all types plus `createDemoScene(): SceneDocument`, `validateScene(scene): Diagnostic[]`, `evaluateScene(scene,tick): EvaluatedFrame`, `sceneDuration(scene): number`, `applyCommands(scene,commands,options?: {allowProtected?: boolean}): SceneDocument` (throws on invalid commands), `createCandidate(scene,commands,name,source?): Candidate`, `mergeCandidate(current,candidate,resolutions?: Record<string,'current'|'candidate'>): MergeResult`, `styleCoverage(scene,style): Coverage[]`, `planStyleChange(scene,style): SceneCommand[]`, `planWeatherChange(scene,weather,shotId?): SceneCommand[]`. Inputs are immutable; candidates retain a base snapshot. `allowProtected` is for an explicit manual override, never agent default.

Runtime exports `renderScene(canvas: HTMLCanvasElement,scene: SceneDocument,tick: number,options?: {guides?: boolean; selectedId?: string; reducedMotion?: boolean; preview?: boolean}): void` and a shared playback controller with reading gates. Canvas scales through CSS; backing size can be logical or device-scaled. Imported media hydration must be supported without remote fetching. Pure evaluation drives the editor and offline player.

I/O exports `saveDraft(scene): Promise<void>`, `loadDraft(): Promise<SceneDocument|null>`, `exportScenePack(scene): string`, `importScenePack(json): SceneDocument`, `exportAssetPack(pack): string`, `importAssetPack(json): PackManifest`, `addPackToScene(scene,pack,selectedFamilyIds): SceneDocument`, `exportStandaloneHtml(scene): Promise<string>`. JSON packs are portable and bounded; original ZIP/Aseprite normalization can be additive. Pack content is data, never scripts. Preserve license/source and use selected dependency closure. Runtime and I/O workers coordinate renderer bundling for HTML.

## Final design corrections and pack requirements

Keep the warm shell, large stage, three workspaces, contextual dock and grouped timeline. Preserve shot/selection/time across workspace switches. Stage manipulation and numeric controls share commands and undo. Candidates stay separate until Keep, which is one undo step. A manual lamp change must survive an independent weather candidate; conflicts need an explicit choice.

Packs are containers of versioned families, not single assets or automatically complete styles. Add a Packs inventory and pack detail/import flow showing source, author, license, count, preview, format, required mappings, selected entries and used-by scenes. A fighter pack can supply idle/walk/attack/hit sprites without turning cutscene motions into combat AI. Hitboxes and gameplay balance are outside appearance import. Missing action names must be mapped explicitly; preview direction, timing, trim and anchors before saving.

Store original source membership and provenance, immutable pack versions, normalized family/variant records and content-addressed media separately from instance overrides. A pack update creates a new revision and compatibility report. Installed scenes remain pinned. Runtime export includes only the selected families/variants and referenced media, not every fighter, alternate costume or source archive. Removing a pack must not destroy used assets. Aseprite PNG+JSON imports and framework JSON packs are the first real adapters; arbitrary commercial ZIP conventions are inspected/mapped rather than guessed. Never execute supplied scripts or unpack unsafe paths.

Style is an appearance binding; weather/time/lighting/wetness/audio are independent environment channels. Existing variants switch locally. Missing frames remain missing until imported or actually created by a configured service. Do not label smooth placeholder art photorealistic or manufacture an available service. Browser-only editing, packs and HTML playback must work without the companion.

## Validation and delivery evidence

Run unit checks for evaluation, gates, protection, candidate merge, imports/closure and recovery. Browser-check editing, selection, weather/style preview/Keep/Undo, pack import, refresh, standalone offline playback and 1280px layout. Validate the whole repository without changing unrelated music work. Document what runs now and any remaining roadmap items instead of representing all R0–R8 as complete.
