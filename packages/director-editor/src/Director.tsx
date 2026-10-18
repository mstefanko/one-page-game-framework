import { useEffect, useRef, useState } from "react";
import {
  createDemoScene,
  evaluateScene,
  applyCommands,
  createCandidate,
  mergeCandidate,
  sceneDuration,
  planStyleChange,
  planWeatherChange,
  styleCoverage,
  effectiveCoverage,
} from "@onepage/director-core";
import type {
  SceneDocument,
  SceneCommand,
  Candidate,
  StyleId,
  Weather,
  PackManifest,
} from "@onepage/director-core";
import {
  renderScene,
  hydrateSceneMedia,
  createPlaybackController,
  createAudioHost,
} from "@onepage/director-runtime";
import {
  loadDraft,
  saveDraft,
  saveAssetPack,
  loadAssetPacks,
  importScenePack,
  importAssetPack,
  addPackToScene,
  exportScenePack,
  exportStandaloneHtml,
} from "@onepage/director-io";
import "./director.css";
import { FittingRoom } from "./FittingRoom";
import { ImageImport } from "./ImageImport";
import { AudioImport } from "./AudioImport";
export interface DirectorProps {
  companion?: {
    status?: string;
    run?: (
      scene: SceneDocument,
      prompt: string,
      signal?: AbortSignal,
    ) => Promise<Candidate>;
    configure?: () => void;
    install?: (scene: SceneDocument) => Promise<{ message: string }>;
  };
}
function Stage({
  scene,
  tick,
  selected,
  guides = false,
  revealDialogue = false,
  onSelect,
  onMove,
}: {
  scene: SceneDocument;
  tick: number;
  selected?: string;
  guides?: boolean;
  revealDialogue?: boolean;
  onSelect?: (id: string) => void;
  onMove?: (x: number, y: number, id: string) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; id: string } | null>(null);
  useEffect(() => {
    if (canvas.current)
      renderScene(canvas.current, scene, tick, {
        preview: true,
        revealDialogue,
        selectedId: selected,
        guides,
      });
  }, [scene, tick, selected, guides, revealDialogue]);
  useEffect(() => {
    let active = true;
    void hydrateSceneMedia(scene).then(() => {
      if (active && canvas.current)
        renderScene(canvas.current, scene, tick, {
          preview: true,
          revealDialogue,
          selectedId: selected,
          guides,
        });
    });
    return () => {
      active = false;
    };
  }, [scene]);
  return (
    <canvas
      ref={canvas}
      width={scene.width}
      height={scene.height}
      aria-label="Scene preview; drag the selected actor to move its starting pose"
      tabIndex={0}
      onPointerDown={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const frame = evaluateScene(scene, tick);
        const x =
          (((e.clientX - r.left) / r.width) * scene.width - scene.width / 2) /
            frame.camera.zoom +
          frame.camera.x;
        const y =
          (((e.clientY - r.top) / r.height) * scene.height - scene.height / 2) /
            frame.camera.zoom +
          frame.camera.y;
        const a = [...frame.actors].sort(
          (a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y),
        )[0];
        if (a) onSelect?.(a.id);
        drag.current = a ? { x: e.clientX, y: e.clientY, id: a.id } : null;
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerUp={(e) => {
        if (
          drag.current &&
          onMove &&
          Math.hypot(e.clientX - drag.current.x, e.clientY - drag.current.y) > 5
        ) {
          const r = e.currentTarget.getBoundingClientRect();
          const camera = evaluateScene(scene, tick).camera;
          onMove(
            Math.round(
              (((e.clientX - r.left) / r.width) * scene.width -
                scene.width / 2) /
                camera.zoom +
                camera.x,
            ),
            Math.round(
              (((e.clientY - r.top) / r.height) * scene.height -
                scene.height / 2) /
                camera.zoom +
                camera.y,
            ),
            drag.current.id,
          );
        }
        drag.current = null;
      }}
    />
  );
}
export function Director({ companion }: DirectorProps) {
  const [scene, setScene] = useState(createDemoScene);
  const [workspace, setWorkspace] = useState("Direct");
  const [operation, setOperation] = useState("Starting pose");
  const [dock, setDock] = useState("Direction");
  const [selected, setSelected] = useState("");
  const [tick, updateTick] = useState(0);
  const controller = useRef<ReturnType<typeof createPlaybackController> | null>(
    null,
  );
  const audio = useRef<ReturnType<typeof createAudioHost> | null>(null);
  const tickRef = useRef(0);
  const playLimit = useRef<number | null>(null);
  function setTick(value: number | ((t: number) => number)) {
    const next = typeof value === "function" ? value(tickRef.current) : value;
    tickRef.current = next;
    playLimit.current = null;
    controller.current?.seek(next);
    updateTick(next);
  }
  const [playing, setPlaying] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [undo, setUndo] = useState<SceneDocument[]>([]);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [resolutions, setResolutions] = useState<
    Record<string, "current" | "candidate">
  >({});
  const [notice, setNotice] = useState("Opening local draft…");
  const [ready, setReady] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState("");
  const [pendingPack, setPendingPack] = useState<PackManifest | null>(null);
  const [libraryPacks, setLibraryPacks] = useState<PackManifest[]>([]);
  const [selectedFamilies, setSelectedFamilies] = useState<string[]>([]);
  const [guides, setGuides] = useState(true);
  const [assetView, setAssetView] = useState("Families");
  const [search, setSearch] = useState("");
  const [override, setOverride] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const file = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const runGeneration = useRef(0);
  const shot =
    scene.shots.find((s) => tick >= s.start && tick < s.start + s.duration) ??
    scene.shots[0];
  const actor = scene.actors.find((a) => a.id === selected) ?? scene.actors[0];
  const layer = scene.layers.find((a) => a.id === selected);
  const line =
    scene.dialogue.find((d) => d.id === selected) ??
    scene.dialogue.find((d) => d.shotId === shot?.id);
  const duration = sceneDuration(scene);
  const preview = candidate ? applyPreview(candidate) : scene;
  const merge = candidate
    ? mergeCandidate(scene, candidate, resolutions)
    : null;
  const missingCoverage = candidate
    ? effectiveCoverage(preview).filter((c) => !c.ready)
    : [];
  function applyPreview(c: Candidate) {
    try {
      return applyCommands(c.base, c.commands);
    } catch {
      return c.base;
    }
  }
  useEffect(() => {
    loadAssetPacks()
      .then(setLibraryPacks)
      .catch((e) => setNotice(`Pack library unavailable: ${String(e)}`));
  }, []);
  async function retainPack(pack: PackManifest) {
    await saveAssetPack(pack);
    setLibraryPacks(await loadAssetPacks());
  }
  function moveStartingPose(id: string, x: number, y: number) {
    const motion = scene.motions.find(
      (m) => m.actorId === id && m.shotId === shot.id,
    );
    commit([
      { type: "set", target: "actor", targetId: id, property: "x", value: x },
      { type: "set", target: "actor", targetId: id, property: "y", value: y },
      ...(motion
        ? [
            {
              type: "set" as const,
              target: "motion" as const,
              targetId: motion.id,
              property: "from",
              value: { x, y },
            },
          ]
        : []),
    ]);
  }
  useEffect(() => {
    loadDraft()
      .then((saved) => {
        if (saved) setScene(saved);
        setNotice(
          saved
            ? "Draft restored from this browser"
            : "Original starter · ready to direct",
        );
      })
      .catch((e) =>
        setNotice(
          `Recovery: ${String(e)}. Starter is available; export a backup before leaving.`,
        ),
      )
      .finally(() => setReady(true));
  }, []);
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      saveDraft(scene)
        .then(() => setNotice("Saved in this browser"))
        .catch((e) =>
          setNotice(
            `Save failed: ${String(e)} · export a scene pack to keep your work`,
          ),
        );
    }, 450);
    return () => clearTimeout(timer);
  }, [scene, ready]);
  useEffect(() => {
    const host = createAudioHost(scene);
    audio.current = host;
    const playback = createPlaybackController(scene, {
      onChange: (state) => {
        tickRef.current = state.tick;
        updateTick(state.tick);
        setPlaying(state.playing);
        setRevealed(state.revealed);
        host.sync(state.tick, state.playing);
      },
      onComplete: () => setNotice("Scene complete · preview only"),
      onSkip: () => setNotice("Scene skipped · preview only"),
    });
    controller.current = playback;
    playback.seek(tickRef.current);
    return () => {
      playback.dispose();
      host.dispose();
    };
  }, [scene]);
  useEffect(() => {
    if (playing) controller.current?.play();
    else controller.current?.pause();
  }, [playing]);
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let frame = 0;
    const advance = (now: number) => {
      const delta = Math.floor((now - last) * 0.06);
      if (delta > 0) {
        last += delta / 0.06;
        const limit = playLimit.current;
        const current = controller.current?.getState().tick ?? 0;
        controller.current?.step(
          limit === null
            ? delta
            : Math.max(0, Math.min(delta, limit - current)),
        );
        if (
          limit !== null &&
          (controller.current?.getState().tick ?? 0) >= limit
        ) {
          playLimit.current = null;
          controller.current?.pause();
        }
      }
      frame = requestAnimationFrame(advance);
    };
    frame = requestAnimationFrame(advance);
    return () => cancelAnimationFrame(frame);
  }, [playing]);
  function replaceDocument(next: SceneDocument) {
    setUndo((u) => [...u, scene]);
    setScene({ ...next, revision: scene.revision + 1 });
    setCandidate(null);
    setResolutions({});
    runGeneration.current++;
    abort.current?.abort();
    setBusy(false);
    setPlaying(false);
  }
  function commit(commands: SceneCommand[]) {
    try {
      const next = applyCommands(scene, commands, { allowProtected: override });
      setUndo((u) => [...u, scene]);
      setScene(next);
    } catch (e) {
      setNotice(String(e));
    }
  }
  function proposeStyle(style: StyleId) {
    try {
      propose(planStyleChange(scene, style), `${style} appearance`);
    } catch (e) {
      setNotice(`Appearance needs preparation: ${String(e)}`);
      setDock("Inspect");
    }
  }
  function proposeWeather(weather: Weather) {
    try {
      propose(
        planWeatherChange(scene, weather, shot?.id),
        `${weather} · ${shot?.name}`,
      );
    } catch (e) {
      setNotice(`Weather revision unavailable: ${String(e)}`);
    }
  }
  function propose(commands: SceneCommand[], name: string) {
    runGeneration.current++;
    abort.current?.abort();
    setBusy(false);
    try {
      setCandidate(createCandidate(scene, commands, name, "manual"));
      setResolutions({});
      setDock("Changes");
      setPlaying(false);
    } catch (e) {
      setNotice(String(e));
    }
  }
  function setValue(
    target: SceneCommand["target"],
    targetId: string | undefined,
    property: string,
    value: unknown,
  ) {
    commit([{ type: "set", target, targetId, property, value }]);
  }
  function download(data: string, name: string, type: string) {
    const url = URL.createObjectURL(new Blob([data], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importFile(f: File) {
    try {
      const text = await f.text();
      let next: SceneDocument;
      try {
        next = importScenePack(text);
      } catch {
        const pack = importAssetPack(text);
        setPendingPack(pack);
        setSelectedFamilies(pack.assets.map((a) => a.id));
        setModal("Import pack");
        return;
      }
      setUndo((u) => [...u, scene]);
      setScene(next);
      setCandidate(null);
      setResolutions({});
      runGeneration.current++;
      abort.current?.abort();
      setBusy(false);
      setNotice(`Imported ${f.name}`);
    } catch (e) {
      setNotice(`Import rejected: ${String(e)}`);
    }
  }
  async function run() {
    if (!companion?.run) {
      if (companion?.configure) companion.configure();
      else setModal("Connection");
      return;
    }
    setBusy(true);
    const generation = ++runGeneration.current;
    abort.current = new AbortController();
    const signal = abort.current.signal;
    try {
      const result = await companion.run(scene, prompt, signal);
      if (signal.aborted || generation !== runGeneration.current) return;
      setCandidate(result);
      setResolutions({});
      setDock("Changes");
    } catch (e) {
      if (signal.aborted || generation !== runGeneration.current) return;
      setNotice(`Direction failed: ${String(e)}. Your draft is preserved.`);
    } finally {
      if (generation === runGeneration.current) setBusy(false);
    }
  }
  return (
    <div className="pd">
      <header className="pd-header">
        <strong className="pd-brand">
          <i />
          Pocket Director
        </strong>
        <span className="pd-project">Original stories /</span>
        <b className="pd-title">{scene.title}</b>
        <nav aria-label="Workspace">
          {["Direct", "Edit", "Assets"].map((w) => (
            <button
              key={w}
              className={workspace === w ? "active" : ""}
              onClick={() => setWorkspace(w)}
            >
              {w}
            </button>
          ))}
        </nav>
        <span className="pd-spacer" />
        <button onClick={() => setModal("Settings")} aria-label="Settings">
          ⚙
        </button>
        <button className="pd-primary" onClick={() => setModal("Use in game")}>
          Use in game ↗
        </button>
      </header>
      <div className="pd-status">
        <span>
          <i className="pd-dot" />
          {notice}
        </span>
        <span>
          60 fps · {scene.width} × {scene.height} · revision {scene.revision}
        </span>
      </div>
      <main className="pd-main">
        <aside className="pd-sidebar">
          <div className="pd-section-title">
            SCENE <span>{scene.shots.length} shots</span>
          </div>
          <h3>{scene.title}</h3>
          <p className="pd-muted">{scene.brief}</p>
          <div className="pd-section-title">STORYBOARD</div>
          {scene.shots.map((s, i) => (
            <button
              className={`pd-shot ${shot?.id === s.id ? "selected" : ""}`}
              key={s.id}
              onClick={() => {
                setTick(s.start);
                setPlaying(false);
              }}
            >
              <span className="pd-shot-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>
                <b>{s.name}</b>
                <small>
                  {(s.duration / 60).toFixed(1)}s{" "}
                  {scene.dialogue.some(
                    (d) => d.shotId === s.id && d.waitForInput,
                  )
                    ? " · reading gate"
                    : ""}
                </small>
              </span>
            </button>
          ))}
          <div className="pd-section-title">
            LAYERS <span>click to inspect</span>
          </div>
          {[
            ...scene.actors.map((a) => ({ id: a.id, name: a.name, icon: "♙" })),
            ...scene.layers.map((l) => ({ id: l.id, name: l.name, icon: "▧" })),
          ].map((l) => (
            <button
              key={l.id}
              className={`pd-layer ${selected === l.id ? "selected" : ""}`}
              onClick={() => {
                setSelected(l.id);
                setDock("Inspect");
              }}
            >
              <span>{l.icon}</span>
              {l.name}
            </button>
          ))}
          <button
            className="pd-wide"
            onClick={() => {
              const id = `shot:${crypto.randomUUID()}`;
              replaceDocument({
                ...scene,
                shots: [
                  ...scene.shots,
                  {
                    id,
                    name: `Shot ${scene.shots.length + 1}`,
                    start: duration,
                    duration: 300,
                  },
                ],
              });
              setTick(duration);
            }}
          >
            ＋ Add shot
          </button>
          <button className="pd-library" onClick={() => setWorkspace("Assets")}>
            ▦ Browse asset library
          </button>
        </aside>
        <section className="pd-workarea">
          {workspace === "Assets" ? (
            <>
              <div className="pd-stage-heading">
                <div>
                  <small>YOUR LIBRARY</small>
                  <h2>Assets & packs</h2>
                </div>
                <button
                  className="pd-primary"
                  onClick={() => file.current?.click()}
                >
                  ＋ Import JSON pack
                </button>
              </div>
              <button onClick={() => setModal("Fit sprite sheet")}>
                Fit PNG + Aseprite…
              </button>
              <button onClick={() => setModal("Import image")}>
                Import image…
              </button>
              <button onClick={() => setModal("Import audio")}>
                Import audio…
              </button>
              <div className="pd-tabs">
                {["Families", "Packs", "Compatibility"].map((v) => (
                  <button
                    className={assetView === v ? "active" : ""}
                    onClick={() => setAssetView(v)}
                    key={v}
                  >
                    {v}
                  </button>
                ))}
                <input
                  aria-label="Search assets"
                  placeholder="Search characters, sets, props…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              {assetView === "Packs" && (
                <div className="pd-pack-library">
                  <h3>Saved pack revisions</h3>
                  {libraryPacks.length ? (
                    libraryPacks.map((pack) => (
                      <article key={`${pack.id}:${pack.version}`}>
                        <b>
                          {pack.name} · {pack.version}
                        </b>
                        <p className="pd-muted">
                          {pack.author} · {pack.license} · {pack.assets.length}{" "}
                          families
                        </p>
                        <button
                          onClick={() => {
                            setPendingPack(pack);
                            setSelectedFamilies(pack.assets.map((a) => a.id));
                            setModal("Import pack");
                          }}
                        >
                          Choose families…
                        </button>
                      </article>
                    ))
                  ) : (
                    <p className="pd-muted">
                      No saved packs yet. Imported pack revisions are kept in
                      this browser separately from the draft.
                    </p>
                  )}
                </div>
              )}
              <div className="pd-assets">
                {scene.assets
                  .filter((a) =>
                    (a.name + " " + a.kind + " " + a.packId)
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .map((a) => (
                    <article key={a.id}>
                      <div className="pd-asset-art">
                        {a.kind === "character"
                          ? "♙"
                          : a.kind === "set"
                            ? "▥"
                            : "✦"}
                      </div>
                      <small>
                        {assetView === "Packs"
                          ? (a.packId ?? "Original starter")
                          : a.kind}
                      </small>
                      <h3>{a.name}</h3>
                      <p>
                        {a.variants.length} appearances ·{" "}
                        {a.variants.filter((v) => v.ready).length} ready
                      </p>
                      <p className="pd-muted">
                        {a.source} · {a.license}
                      </p>
                      <details>
                        <summary>Capabilities & provenance</summary>
                        {a.variants.map((v) => (
                          <p key={v.id}>
                            {v.name}:{" "}
                            {v.clips.map((c) => c.name).join(", ") ||
                              "Static artwork"}{" "}
                            · {v.ready ? "ready" : v.missing?.join(", ")}
                          </p>
                        ))}
                      </details>
                    </article>
                  ))}
              </div>
              <div className="pd-callout">
                <b>Bring your own actors</b>
                <p>
                  Framework JSON scene and asset packs are supported. Preserve
                  source, author and license in the pack. PNG / Aseprite fitting
                  is available through the import adapter when included in a
                  normalized pack; native .aseprite and arbitrary ZIP files are
                  not supported here.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="pd-shot-ribbon">
                {scene.shots.map((s, i) => (
                  <button
                    key={s.id}
                    className={shot?.id === s.id ? "selected" : ""}
                    onClick={() => setTick(s.start)}
                  >
                    <span>0{i + 1}</span>
                    <b>{s.name}</b>
                    <small>{s.duration / 60}s</small>
                  </button>
                ))}
              </div>
              <div className="pd-stage-heading">
                <div>
                  <small>
                    SHOT {scene.shots.indexOf(shot) + 1} / {scene.shots.length}{" "}
                    <span>•</span>{" "}
                    {workspace === "Edit"
                      ? operation.toUpperCase()
                      : "SCENE PREVIEW"}
                  </small>
                  <h2>{shot?.name}</h2>
                </div>
                <label>
                  <input
                    type="checkbox"
                    checked={guides}
                    onChange={(e) => setGuides(e.target.checked)}
                  />{" "}
                  Guides
                </label>
                <button
                  onClick={() => {
                    setTick(shot.start);
                    playLimit.current = shot.start + shot.duration;
                    setPlaying(true);
                  }}
                >
                  ▶ Play shot
                </button>
              </div>
              <div className="pd-stagebar">
                <span>STAGE</span>
                <select
                  aria-label="Stage operation"
                  value={operation}
                  onChange={(e) => setOperation(e.target.value)}
                >
                  <option>Starting pose</option>
                  <option>Action endpoint</option>
                </select>
                <span className="pd-spacer" />
                <label>
                  Look{" "}
                  <select
                    value={scene.style}
                    onChange={(e) => proposeStyle(e.target.value as StyleId)}
                  >
                    <option>8-bit</option>
                    <option>16-bit</option>
                    <option>realistic</option>
                  </select>
                </label>
                <label>
                  Weather{" "}
                  <select
                    value={
                      shot.environment?.weather ?? scene.environment.weather
                    }
                    onChange={(e) => proposeWeather(e.target.value as Weather)}
                  >
                    <option>clear</option>
                    <option>rain</option>
                    <option>storm</option>
                  </select>
                </label>
              </div>
              <div
                className={`pd-stage ${candidate ? "comparing" : ""} ${scene.style !== "realistic" ? "pd-pixel" : ""}`}
              >
                {candidate && (
                  <div className="pd-stage-pane">
                    <span>Current draft</span>
                    <Stage
                      scene={scene}
                      tick={tick}
                      revealDialogue={revealed}
                    />
                  </div>
                )}
                <div className="pd-stage-pane">
                  {candidate && <span>Candidate · {candidate.name}</span>}
                  <Stage
                    scene={preview}
                    tick={tick}
                    revealDialogue={revealed}
                    selected={selected}
                    guides={guides}
                    onSelect={setSelected}
                    onMove={
                      workspace === "Edit" && actor
                        ? (x, y, id) => {
                            const motion = scene.motions.find(
                              (m) => m.actorId === id && m.shotId === shot.id,
                            );
                            if (operation === "Action endpoint") {
                              if (motion)
                                commit([
                                  {
                                    type: "set",
                                    target: "motion",
                                    targetId: motion.id,
                                    property: "to",
                                    value: { x, y },
                                  },
                                ]);
                              else
                                setNotice(
                                  "This actor has no action in this shot. Choose Starting pose.",
                                );
                            } else
                              commit([
                                {
                                  type: "set",
                                  target: "actor",
                                  targetId: id,
                                  property: "x",
                                  value: x,
                                },
                                {
                                  type: "set",
                                  target: "actor",
                                  targetId: id,
                                  property: "y",
                                  value: y,
                                },
                                ...(motion
                                  ? [
                                      {
                                        type: "set" as const,
                                        target: "motion" as const,
                                        targetId: motion.id,
                                        property: "from",
                                        value: { x, y },
                                      },
                                    ]
                                  : []),
                              ]);
                          }
                        : undefined
                    }
                  />
                </div>
              </div>
              <div className="pd-transport">
                <button
                  aria-label="Previous frame"
                  onClick={() => {
                    setPlaying(false);
                    setTick((t) => Math.max(0, t - 1));
                  }}
                >
                  Ⅰ◀
                </button>
                <button
                  className="pd-play"
                  aria-label={playing ? "Pause" : "Play scene"}
                  onClick={() => {
                    playLimit.current = null;
                    setPlaying(!playing);
                  }}
                >
                  {playing ? "Ⅱ" : "▶"}
                </button>
                <button
                  aria-label="Next frame"
                  onClick={() => {
                    setPlaying(false);
                    setTick((t) => Math.min(duration, t + 1));
                  }}
                >
                  ▶Ⅰ
                </button>
                <button onClick={() => controller.current?.advance()}>
                  Continue ↵
                </button>
                <code>
                  {(tick / 60).toFixed(2)}{" "}
                  <span>/ {(duration / 60).toFixed(2)} s</span>
                </code>
                <input
                  aria-label="Scene playhead"
                  type="range"
                  min={0}
                  max={duration}
                  value={tick}
                  onChange={(e) => {
                    setPlaying(false);
                    setTick(+e.target.value);
                  }}
                />
                <button onClick={() => setExpanded(!expanded)}>
                  {expanded ? "⌄" : "⌃"} Timeline
                </button>
              </div>
              {expanded && (
                <div className="pd-timeline">
                  <div className="pd-ruler">
                    <b>TRACKS</b>
                    {Array.from({ length: 7 }, (_, i) => (
                      <span key={i}>{((duration / 360) * i).toFixed(0)}s</span>
                    ))}
                  </div>
                  {[
                    { name: "Motion", items: scene.motions },
                    { name: "Dialogue", items: scene.dialogue },
                    { name: "Camera", items: scene.camera },
                    { name: "Sound & ambience", items: scene.audio },
                  ].map((group) => (
                    <div className="pd-track" key={group.name}>
                      <b>{group.name}</b>
                      <div>
                        {group.items.map((item) => (
                          <button
                            key={item.id}
                            style={{
                              left: `${((item.start + ("shotId" in item ? (scene.shots.find((s) => s.id === item.shotId)?.start ?? 0) : 0)) / duration) * 100}%`,
                              width: `${Math.max(3, (item.duration / duration) * 100)}%`,
                            }}
                            onClick={() => {
                              setTick(
                                item.start +
                                  ("shotId" in item
                                    ? (scene.shots.find(
                                        (s) => s.id === item.shotId,
                                      )?.start ?? 0)
                                    : 0),
                              );
                              setSelected(item.id);
                              setDock("Inspect");
                            }}
                            title={"text" in item ? item.text : group.name}
                          >
                            {"text" in item
                              ? item.text
                              : "action" in item
                                ? item.action
                                : "title" in item
                                  ? item.title
                                  : group.name}
                          </button>
                        ))}
                        <i style={{ left: `${(tick / duration) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
        <aside className="pd-dock">
          <div className="pd-tabs">
            {["Direction", "Inspect", "Changes"].map((d) => (
              <button
                className={dock === d ? "active" : ""}
                key={d}
                onClick={() => setDock(d)}
              >
                {d}
                {d === "Changes" && candidate ? " •" : ""}
              </button>
            ))}
          </div>
          {dock === "Direction" ? (
            <div className="pd-dock-content">
              <small className="pd-eyebrow">DIRECT THE NEXT PASS</small>
              <h2>What should change?</h2>
              <p className="pd-muted">
                A revision stays separate until you keep it. Your manual edits
                stay in the draft.
              </p>
              <div className="pd-context">
                {shot?.name}
                <br />
                <small>
                  {selected || "Whole scene"} · {(tick / 60).toFixed(2)}s ·{" "}
                  {scene.locks.length} protections
                </small>
              </div>
              <label>
                Direction
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Make the arrival feel quieter. Keep dialogue and timing."
                />
              </label>
              <button
                className="pd-primary pd-wide"
                disabled={busy || !prompt.trim()}
                onClick={run}
              >
                {busy ? "Preparing candidate…" : "Create candidate ↗"}
              </button>
              {busy && (
                <button
                  className="pd-wide"
                  onClick={() => {
                    runGeneration.current++;
                    abort.current?.abort();
                    setBusy(false);
                    setNotice("Direction cancelled · draft preserved");
                  }}
                >
                  Stop direction
                </button>
              )}
              <button
                className="pd-connection"
                onClick={() =>
                  companion?.configure
                    ? companion.configure()
                    : setModal("Connection")
                }
              >
                ○ {companion?.status ?? "Agent not connected"}{" "}
                <span>Setup →</span>
              </button>
              <hr />
              <h3>Try a local revision</h3>
              <p className="pd-muted">
                Prepared appearances and environment changes preview instantly.
              </p>
              <label>
                Appearance
                <select
                  value={scene.style}
                  onChange={(e) => proposeStyle(e.target.value as StyleId)}
                >
                  {["8-bit", "16-bit", "realistic"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <div className="pd-weather">
                {(["clear", "rain", "storm"] as Weather[]).map((w) => (
                  <button key={w} onClick={() => proposeWeather(w)}>
                    {w === "clear" ? "☀" : w === "rain" ? "☂" : "ϟ"} {w}
                  </button>
                ))}
              </div>
              <div className="pd-protection">
                <b>♧ Preservation rules</b>
                {scene.locks.map((l) => (
                  <p key={l.id}>✓ {l.label}</p>
                ))}
              </div>
            </div>
          ) : dock === "Inspect" ? (
            <div className="pd-dock-content">
              <label>
                Shot name
                <input
                  type="text"
                  value={shot.name}
                  onChange={(e) =>
                    setValue("shot", shot.id, "name", e.target.value)
                  }
                />
              </label>
              <label>
                Shot duration (seconds)
                <input
                  type="number"
                  min={1 / 60}
                  step={1 / 60}
                  value={shot.duration / 60}
                  onChange={(e) => {
                    const value = Math.round(+e.target.value * 60);
                    const delta = value - shot.duration;
                    commit([
                      {
                        type: "set",
                        target: "shot",
                        targetId: shot.id,
                        property: "duration",
                        value,
                      },
                      ...scene.shots
                        .filter((s) => s.start > shot.start)
                        .map((s) => ({
                          type: "set" as const,
                          target: "shot" as const,
                          targetId: s.id,
                          property: "start",
                          value: s.start + delta,
                        })),
                    ]);
                  }}
                />
              </label>
              <button
                onClick={() => {
                  const index = scene.shots.indexOf(shot);
                  if (index <= 0) return;
                  const shots = [...scene.shots];
                  [shots[index - 1], shots[index]] = [
                    shots[index],
                    shots[index - 1],
                  ];
                  let start = 0;
                  const next = shots.map((s) => {
                    const n = { ...s, start };
                    start += s.duration;
                    return n;
                  });
                  replaceDocument({
                    ...scene,
                    shots: next,
                  });
                  setTick(next[index - 1].start);
                }}
                disabled={scene.shots.indexOf(shot) === 0}
              >
                ↑ Move shot earlier
              </button>
              <hr />
              <small className="pd-eyebrow">INSTANCE INSPECTOR</small>
              <h2>{layer?.name ?? actor?.name ?? "Scene"}</h2>
              <p className="pd-muted">Changes apply to this scene instance.</p>
              <label className="pd-check">
                <input
                  type="checkbox"
                  checked={override}
                  onChange={(e) => setOverride(e.target.checked)}
                />{" "}
                Explicitly override protected properties
              </label>
              {layer ? (
                <>
                  <label>
                    Layer artwork
                    <select
                      value={layer.familyId ?? ""}
                      onChange={(e) =>
                        setValue("layer", layer.id, "familyId", e.target.value)
                      }
                    >
                      <option value="">Built-in layer</option>
                      {scene.assets
                        .filter((a) => a.kind === "set" || a.kind === "prop")
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    X position
                    <input
                      type="number"
                      value={layer.x}
                      onChange={(e) =>
                        setValue("layer", layer.id, "x", +e.target.value)
                      }
                    />
                  </label>
                  <label>
                    Y position
                    <input
                      type="number"
                      value={layer.y}
                      onChange={(e) =>
                        setValue("layer", layer.id, "y", +e.target.value)
                      }
                    />
                  </label>
                  <label>
                    Opacity
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={layer.opacity}
                      onChange={(e) =>
                        setValue("layer", layer.id, "opacity", +e.target.value)
                      }
                    />
                  </label>
                  <label className="pd-check">
                    <input
                      type="checkbox"
                      checked={layer.visible}
                      onChange={(e) =>
                        setValue("layer", layer.id, "visible", e.target.checked)
                      }
                    />{" "}
                    Show in editor
                  </label>
                  <label className="pd-check">
                    <input
                      type="checkbox"
                      checked={layer.output}
                      onChange={(e) =>
                        setValue("layer", layer.id, "output", e.target.checked)
                      }
                    />{" "}
                    Include in output
                  </label>
                </>
              ) : (
                actor && (
                  <>
                    <label>
                      Actor family
                      <select
                        value={actor.familyId}
                        onChange={(e) =>
                          commit([
                            {
                              type: "set",
                              target: "actor",
                              targetId: actor.id,
                              property: "familyId",
                              value: e.target.value,
                            },
                          ])
                        }
                      >
                        {scene.assets
                          .filter((a) => a.kind === "character")
                          .map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Starting X
                      <input
                        type="number"
                        value={
                          scene.motions.find(
                            (m) =>
                              m.actorId === actor.id && m.shotId === shot.id,
                          )?.from.x ?? actor.x
                        }
                        onChange={(e) =>
                          moveStartingPose(
                            actor.id,
                            +e.target.value,
                            scene.motions.find(
                              (m) =>
                                m.actorId === actor.id && m.shotId === shot.id,
                            )?.from.y ?? actor.y,
                          )
                        }
                      />
                    </label>
                    <label>
                      Starting Y
                      <input
                        type="number"
                        value={
                          scene.motions.find(
                            (m) =>
                              m.actorId === actor.id && m.shotId === shot.id,
                          )?.from.y ?? actor.y
                        }
                        onChange={(e) =>
                          moveStartingPose(
                            actor.id,
                            scene.motions.find(
                              (m) =>
                                m.actorId === actor.id && m.shotId === shot.id,
                            )?.from.x ?? actor.x,
                            +e.target.value,
                          )
                        }
                      />
                    </label>
                    <label>
                      Scale
                      <input
                        type="number"
                        step={0.1}
                        value={actor.scale}
                        onChange={(e) =>
                          setValue("actor", actor.id, "scale", +e.target.value)
                        }
                      />
                    </label>
                    {scene.motions
                      .filter(
                        (m) => m.actorId === actor.id && m.shotId === shot?.id,
                      )
                      .map((m) => (
                        <div key={m.id}>
                          <label>
                            Motion start (seconds in shot)
                            <input
                              type="number"
                              min={0}
                              step={1 / 60}
                              value={m.start / 60}
                              onChange={(e) =>
                                setValue(
                                  "motion",
                                  m.id,
                                  "start",
                                  Math.round(+e.target.value * 60),
                                )
                              }
                            />
                          </label>
                          <label>
                            Motion duration (seconds)
                            <input
                              type="number"
                              min={1 / 60}
                              step={1 / 60}
                              value={m.duration / 60}
                              onChange={(e) =>
                                setValue(
                                  "motion",
                                  m.id,
                                  "duration",
                                  Math.round(+e.target.value * 60),
                                )
                              }
                            />
                          </label>
                          <label>
                            Action endpoint X
                            <input
                              type="number"
                              value={m.to.x}
                              onChange={(e) =>
                                setValue("motion", m.id, "to", {
                                  ...m.to,
                                  x: +e.target.value,
                                })
                              }
                            />
                          </label>
                        </div>
                      ))}
                  </>
                )
              )}
              {line && (
                <>
                  <hr />
                  <h3>Dialogue</h3>
                  <label>
                    Dialogue start (seconds in shot)
                    <input
                      type="number"
                      min={0}
                      step={1 / 60}
                      value={line.start / 60}
                      onChange={(e) =>
                        setValue(
                          "dialogue",
                          line.id,
                          "start",
                          Math.round(+e.target.value * 60),
                        )
                      }
                    />
                  </label>
                  <label>
                    Dialogue duration (seconds)
                    <input
                      type="number"
                      min={1 / 60}
                      step={1 / 60}
                      value={line.duration / 60}
                      onChange={(e) =>
                        setValue(
                          "dialogue",
                          line.id,
                          "duration",
                          Math.round(+e.target.value * 60),
                        )
                      }
                    />
                  </label>
                  <button onClick={() => setModal("Import audio")}>
                    {line.voiceMediaId
                      ? "Replace voice recording…"
                      : "Attach voice recording…"}
                  </button>
                  {line.voiceMediaId && (
                    <p className="pd-muted">
                      {line.voiceNeedsReview
                        ? "Voice needs review: text and recording may differ."
                        : "Embedded voice attached."}
                    </p>
                  )}
                  <label>
                    Line text
                    <textarea
                      value={line.text}
                      onChange={(e) =>
                        setValue("dialogue", line.id, "text", e.target.value)
                      }
                    />
                  </label>
                  <label className="pd-check">
                    <input
                      type="checkbox"
                      checked={line.waitForInput}
                      onChange={(e) =>
                        setValue(
                          "dialogue",
                          line.id,
                          "waitForInput",
                          e.target.checked,
                        )
                      }
                    />{" "}
                    Wait for reader
                  </label>
                </>
              )}
              {!line && actor && (
                <button
                  className="pd-wide"
                  onClick={() => {
                    const id = `line:${crypto.randomUUID()}`;
                    replaceDocument({
                      ...scene,
                      dialogue: [
                        ...scene.dialogue,
                        {
                          id,
                          shotId: shot.id,
                          actorId: actor.id,
                          text: "Your dialogue here.",
                          start: 0,
                          duration: 180,
                          revealRate: 30,
                          waitForInput: true,
                          voiceNeedsReview: false,
                          style: "caption",
                        },
                      ],
                    });
                    setSelected(id);
                  }}
                >
                  ＋ Add dialogue to this shot
                </button>
              )}
              <hr />
              <h3>Environment · {shot.name}</h3>
              <p className="pd-muted">
                Overrides apply only to this shot. Protected night changes
                require the explicit override above.
              </p>
              <label>
                Time of day
                <select
                  value={
                    shot.environment?.timeOfDay ?? scene.environment.timeOfDay
                  }
                  onChange={(e) =>
                    setValue(
                      "environment",
                      shot.id,
                      "timeOfDay",
                      e.target.value,
                    )
                  }
                >
                  <option value="night">Night</option>
                  <option value="day">Day</option>
                </select>
              </label>
              {(["frontRain", "backRain", "lantern", "wetness"] as const).map(
                (property) => (
                  <label key={property}>
                    {
                      {
                        frontRain: "Foreground rain",
                        backRain: "Background rain",
                        lantern: "Lantern light",
                        wetness: "Surface wetness",
                      }[property]
                    }
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={
                        shot.environment?.[property] ??
                        scene.environment[property]
                      }
                      onChange={(e) =>
                        setValue(
                          "environment",
                          shot.id,
                          property,
                          +e.target.value,
                        )
                      }
                    />
                    <small>
                      {Math.round(
                        (shot.environment?.[property] ??
                          scene.environment[property]) * 100,
                      )}
                      %
                    </small>
                  </label>
                ),
              )}
              <hr />
              <h3>Appearance coverage</h3>
              {effectiveCoverage(scene).map((c) => (
                <p key={c.familyId}>
                  {c.ready ? "✓" : "!"} {c.name}
                  <small className="pd-muted"> {c.missing.join(", ")}</small>
                </p>
              ))}
            </div>
          ) : (
            <div className="pd-dock-content">
              <small className="pd-eyebrow">REVIEW A REVISION</small>
              <h2>{candidate?.name ?? "No pending changes"}</h2>
              {candidate ? (
                <>
                  <p className="pd-muted">
                    Synchronized current and candidate previews. Nothing is
                    applied until Keep.
                  </p>
                  {candidate.commands.map((c, i) => (
                    <button
                      className="pd-change"
                      key={i}
                      onClick={() => {
                        setSelected(c.targetId ?? "");
                        setTick(shot?.start ?? 0);
                      }}
                    >
                      <b>
                        {c.targetId ?? c.target} · {c.property}
                      </b>
                      <small>{JSON.stringify(c.value)}</small>
                    </button>
                  ))}
                  {merge?.conflicts.map((c) => (
                    <div className="pd-conflict" key={c.key}>
                      <b>Conflict: {c.command.property}</b>
                      <p>
                        Current: {JSON.stringify(c.currentValue)}
                        <br />
                        Candidate: {JSON.stringify(c.proposedValue)}
                      </p>
                      <select
                        aria-label={`Resolve ${c.command.property}`}
                        value={resolutions[c.key] ?? ""}
                        onChange={(e) =>
                          setResolutions((r) => ({
                            ...r,
                            [c.key]: e.target.value as "current" | "candidate",
                          }))
                        }
                      >
                        <option value="">Choose a value…</option>
                        <option value="current">Keep my current value</option>
                        <option value="candidate">Use candidate value</option>
                      </select>
                    </div>
                  ))}
                  {missingCoverage.length > 0 && (
                    <div className="pd-error">
                      <b>Appearance incomplete · Keep unavailable</b>
                      {missingCoverage.map((c) => (
                        <p key={c.familyId}>
                          {c.name}:{" "}
                          {c.missing.join(", ") ||
                            "compatible appearance missing"}
                        </p>
                      ))}
                      <button
                        onClick={() => {
                          setWorkspace("Assets");
                          file.current?.click();
                        }}
                      >
                        Import compatible asset pack
                      </button>
                    </div>
                  )}
                  {merge?.diagnostics.map((d, i) => (
                    <p className="pd-error" key={i}>
                      {d.message}
                    </p>
                  ))}
                  <button
                    className="pd-primary pd-wide"
                    disabled={
                      missingCoverage.length > 0 ||
                      !!merge?.conflicts.length ||
                      merge?.diagnostics.some((d) => d.severity === "error")
                    }
                    onClick={() => {
                      if (merge) {
                        setUndo((u) => [...u, scene]);
                        setScene(merge.scene);
                        setCandidate(null);
                        setResolutions({});
                        setNotice("Candidate kept · one undo step");
                      }
                    }}
                  >
                    Keep revision
                  </button>
                  <button
                    className="pd-wide"
                    onClick={() => {
                      setCandidate(null);
                      setResolutions({});
                    }}
                  >
                    Discard candidate
                  </button>
                </>
              ) : (
                <p className="pd-muted">
                  Create a weather, appearance or agent candidate in Direction.
                  Manual edits are saved directly and can be undone.
                </p>
              )}
            </div>
          )}
          <footer>
            <button
              disabled={!undo.length}
              onClick={() => {
                const previous = undo[undo.length - 1];
                if (previous) {
                  setScene(previous);
                  setUndo((u) => u.slice(0, -1));
                  setNotice("Undid last change");
                }
              }}
            >
              ↶ Undo {undo.length ? `(${undo.length})` : ""}
            </button>
            <span>Local draft</span>
          </footer>
        </aside>
      </main>
      <input
        hidden
        ref={file}
        type="file"
        accept=".json,application/json"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void importFile(f);
          e.currentTarget.value = "";
        }}
      />
      {modal && (
        <div className="pd-overlay" onClick={() => setModal("")}>
          <section
            className="pd-modal"
            role="dialog"
            aria-modal="true"
            aria-label={modal}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="pd-close"
              aria-label="Close dialog"
              onClick={() => setModal("")}
            >
              ×
            </button>
            <small className="pd-eyebrow">POCKET DIRECTOR</small>
            <h2>{modal}</h2>
            {modal === "Import audio" ? (
              <div className="pd-fitting">
                <AudioImport
                  hasLine={!!line}
                  onImport={(media, kind, length, transcript) => {
                    const withMedia = importScenePack(
                      JSON.stringify({
                        ...scene,
                        media: [...scene.media, media],
                      }),
                    );
                    let commands: SceneCommand[];
                    if (kind === "voice" && line) {
                      commands = [
                        {
                          type: "set",
                          target: "dialogue",
                          targetId: line.id,
                          property: "voiceMediaId",
                          value: media.id,
                        },
                        {
                          type: "set",
                          target: "dialogue",
                          targetId: line.id,
                          property: "voiceNeedsReview",
                          value: !!transcript && transcript !== line.text,
                        },
                        ...(transcript
                          ? [
                              {
                                type: "set" as const,
                                target: "dialogue" as const,
                                targetId: line.id,
                                property: "transcript",
                                value: transcript,
                              },
                            ]
                          : []),
                      ];
                    } else {
                      commands = [
                        {
                          type: "set",
                          target: "scene",
                          property: "audio",
                          value: [
                            ...scene.audio,
                            {
                              id: `cue:${crypto.randomUUID()}`,
                              kind,
                              start: tick,
                              duration: Math.min(
                                length,
                                Math.max(1, duration - tick),
                              ),
                              mediaId: media.id,
                              title: media.name,
                              volume: 1,
                            },
                          ],
                        },
                      ];
                    }
                    const next = applyCommands(withMedia, commands, {
                      allowProtected: override,
                    });
                    replaceDocument(importScenePack(JSON.stringify(next)));
                    setModal("");
                    setNotice("Audio embedded · press Play to audition");
                  }}
                />
              </div>
            ) : modal === "Import image" ? (
              <div className="pd-fitting">
                <ImageImport
                  onImport={async (pack) => {
                    await retainPack(pack);
                    replaceDocument(
                      addPackToScene(
                        scene,
                        pack,
                        pack.assets.map((a) => a.id),
                      ),
                    );
                    setModal("");
                    setNotice(
                      "Artwork imported · bind it to a layer in Inspect",
                    );
                  }}
                />
              </div>
            ) : modal === "Import pack" && pendingPack ? (
              <>
                <p>
                  {pendingPack.name} · revision {pendingPack.version}
                </p>
                <p className="pd-muted">
                  {pendingPack.author} · {pendingPack.license}
                  <br />
                  {pendingPack.source}
                </p>
                <p>
                  Select the families to add to this scene. Referenced media is
                  imported with them; this does not place actors on stage.
                </p>
                {pendingPack.assets.map((a) => (
                  <label className="pd-check" key={a.id}>
                    <input
                      type="checkbox"
                      checked={selectedFamilies.includes(a.id)}
                      onChange={(e) =>
                        setSelectedFamilies((ids) =>
                          e.target.checked
                            ? [...ids, a.id]
                            : ids.filter((id) => id !== a.id),
                        )
                      }
                    />
                    {a.name} · {a.kind}
                  </label>
                ))}
                <button
                  className="pd-primary pd-wide"
                  disabled={!selectedFamilies.length}
                  onClick={async () => {
                    try {
                      await retainPack(pendingPack);
                      replaceDocument(
                        addPackToScene(scene, pendingPack, selectedFamilies),
                      );
                      setPendingPack(null);
                      setModal("");
                      setNotice("Selected pack families imported");
                    } catch (e) {
                      setNotice(String(e));
                    }
                  }}
                >
                  Import {selectedFamilies.length} selected families
                </button>
              </>
            ) : modal === "Fit sprite sheet" ? (
              <FittingRoom
                onImport={async (pack) => {
                  try {
                    await retainPack(pack);
                    setUndo((u) => [...u, scene]);
                    setScene(
                      addPackToScene(
                        scene,
                        pack,
                        pack.assets.map((a) => a.id),
                      ),
                    );
                    setModal("");
                    setNotice(
                      "Imported sprite family · choose a family in the actor inspector",
                    );
                  } catch (e) {
                    setNotice(String(e));
                  }
                }}
              />
            ) : modal === "Use in game" ? (
              <>
                <p>
                  Export an editable dependency pack or a self-contained player.
                  Exporting does not install or change a game.
                </p>
                <div className="pd-context">
                  <b>{scene.slot.name}</b>
                  <p>
                    On complete → {scene.slot.onComplete}
                    <br />
                    On skip → {scene.slot.onSkip}
                  </p>
                  <small>
                    Revision {scene.revision} · {scene.assets.length} asset
                    families
                  </small>
                </div>
                <button
                  className="pd-primary pd-wide"
                  onClick={() =>
                    download(
                      exportScenePack(scene),
                      "scene-pack.json",
                      "application/json",
                    )
                  }
                >
                  Download scene pack
                </button>
                <button
                  className="pd-wide"
                  onClick={async () => {
                    try {
                      download(
                        await exportStandaloneHtml(scene),
                        "scene-player.html",
                        "text/html",
                      );
                      setNotice("Standalone HTML exported");
                    } catch (e) {
                      setNotice(`Export failed: ${String(e)}`);
                    }
                  }}
                >
                  Download offline HTML player
                </button>
                {companion?.install && (
                  <button
                    className="pd-wide"
                    onClick={async () => {
                      try {
                        const result = await companion.install!(scene);
                        setNotice(result.message);
                      } catch (e) {
                        setNotice(`Registration failed: ${String(e)}`);
                      }
                    }}
                  >
                    Register scene in connected project
                  </button>
                )}
                <p className="pd-muted">
                  Game playback requires a compatible game host and explicit
                  placement. Project registration pins the scene dependency
                  pack; it does not add scene playback to arbitrary game code.
                </p>
              </>
            ) : modal === "Connection" ? (
              <>
                <p>{companion?.status ?? "No local agent is connected."}</p>
                {companion?.configure && (
                  <button className="pd-primary" onClick={companion.configure}>
                    Configure companion
                  </button>
                )}
                <p>
                  Manual editing, local candidates, imports and offline export
                  are available now. Start the framework companion and configure
                  an agent route to send direction.
                </p>
                <code>npm run director:companion</code>
                <p className="pd-muted">
                  Credentials stay in the local companion and are never included
                  in exported scenes.
                </p>
              </>
            ) : (
              <>
                <label>
                  Scene title
                  <input
                    type="text"
                    value={scene.title}
                    onChange={(e) =>
                      setValue("scene", undefined, "title", e.target.value)
                    }
                  />
                </label>
                <label>
                  Story brief
                  <textarea
                    value={scene.brief}
                    onChange={(e) =>
                      setValue("scene", undefined, "brief", e.target.value)
                    }
                  />
                </label>
                <button
                  onClick={() => {
                    if (
                      !window.confirm(
                        "Start a fresh scene? Export a backup first if you need a portable copy. Your previous draft remains available in Undo.",
                      )
                    )
                      return;
                    const starter = createDemoScene();
                    replaceDocument({
                      ...starter,
                      id: `scene:${crypto.randomUUID()}`,
                      title: "Untitled scene",
                      brief: "Describe your story here.",
                      shots: [
                        {
                          id: "shot:opening",
                          name: "Opening",
                          start: 0,
                          duration: 300,
                        },
                      ],
                      motions: [],
                      dialogue: [],
                      camera: [],
                      audio: [],
                      locks: [],
                    });
                    setTick(0);
                    setModal("");
                    setWorkspace("Edit");
                  }}
                >
                  Start a fresh scene
                </button>
                <p className="pd-muted">
                  Fresh scenes keep the original cast and set for staging. Undo
                  restores your previous draft.
                </p>
                <h3>Storage & services</h3>
                {companion?.configure && (
                  <button onClick={companion.configure}>
                    Configure agent connection
                  </button>
                )}
                <p>{notice}</p>
                <p>
                  Agent: {companion?.status ?? "not connected"}
                  <br />
                  Media generation: not configured
                  <br />
                  Project installation: no adapter
                </p>
                <button
                  onClick={() =>
                    download(
                      JSON.stringify(scene, null, 2),
                      "director-backup.json",
                      "application/json",
                    )
                  }
                >
                  Back up draft
                </button>
                <button onClick={() => file.current?.click()}>
                  Restore scene pack
                </button>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
