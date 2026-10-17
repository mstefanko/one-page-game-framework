import { useEffect, useRef, useState } from "react";
import type { Score } from "@onepage/project";
import type { AudioEngine } from "@onepage/music-web-audio";
import { readAudioProject, saveAudioProject } from "@onepage/asset-library";
import { LanternGameAudio } from "./LanternGameAudio";
import {
  createPreviewHost,
  type PreviewHost,
  type PreviewReady,
  type RuntimePreviewEvent,
} from "./preview-bridge";
import {
  parseTerminatorProject,
  type TerminatorProject,
} from "./terminator-project";
import "./game-audio.css";

type Props = {
  score: Score;
  onEditScore: (score: Score) => void;
  engine: AudioEngine;
};
const base = `${import.meta.env.BASE_URL}local-games/terminator/`;
export function GameAudio(props: Props) {
  const [mode, setMode] = useState("terminator");
  const [project, setProject] = useState<TerminatorProject | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void fetch(`${base}catalog.json`)
      .then(async (r) => {
        if (!r.ok || !r.headers.get("content-type")?.includes("json"))
          throw new Error("Source not imported");
        return parseTerminatorProject(await r.json());
      })
      .then((p) => {
        if (!cancelled) setProject(p);
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <div className="game-audio-container">
      <label className="ga-project-picker">
        Project{" "}
        <select
          aria-label="Game preview project"
          value={mode}
          onChange={(e) => {
            props.engine.stop();
            setMode(e.target.value);
          }}
        >
          <option value="terminator">
            Terminator: Liquid Metal · local import
          </option>
          <option value="fixture">Lantern Courier · original fixture</option>
        </select>
      </label>
      {mode === "fixture" ? (
        <LanternGameAudio {...props} />
      ) : project ? (
        <TerminatorGameAudio {...props} project={project} />
      ) : (
        <section className="game-audio">
          <h2>Terminator: Liquid Metal</h2>
          <p>
            {missing
              ? "Import your local game source to preview its actual scenes, music and sound effects beside the editor."
              : "Looking for the local game import…"}
          </p>
          <p>
            <code>
              npm run import:terminator --
              /path/to/terminator-game-repo/index.html
            </code>
          </p>
          <p>
            The import stays on this computer. Reload this page after importing.
            The original fixture is available in the project selector.
          </p>
        </section>
      )}
    </div>
  );
}
function TerminatorGameAudio({
  score,
  onEditScore,
  engine,
  project,
}: Props & { project: TerminatorProject }) {
  const iframe = useRef<HTMLIFrameElement>(null),
    bridge = useRef<PreviewHost | null>(null),
    revision = useRef<number | null>(null),
    active = useRef(true),
    input = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState<PreviewReady>(),
    [selected, setSelected] = useState("title"),
    [context, setContext] = useState("title"),
    [message, setMessage] = useState("Connecting to the actual local game…"),
    [running, setRunning] = useState(false),
    [draft, setDraft] = useState(false),
    [sounding, setSounding] = useState<string | null>(null),
    [lastSfx, setLastSfx] = useState<string>(),
    [overrides, setOverrides] = useState<Record<string, Score>>({}),
    [stored, setStored] = useState(false),
    [recovery, setRecovery] = useState<unknown>();
  const overridesRef = useRef(overrides),
    draftRef = useRef({ enabled: draft, selected, score });
  overridesRef.current = overrides;
  draftRef.current = { enabled: draft, selected, score };
  useEffect(() => {
    active.current = true;
    void readAudioProject(project.catalog.projectId)
      .then((record) => {
        if (!active.current) return;
        if (record) {
          const value = record.manifest as {
            sourceSha256?: string;
            overrides?: Record<string, Score>;
          };
          if (value.sourceSha256 !== project.sourceSha256) {
            setRecovery(record.manifest);
            throw new Error(
              "Saved assignments belong to another game source revision. Use Export previous assignments to recover them.",
            );
          }
          const parsed = parseTerminatorProject(
            { ...project, scores: value.overrides ?? {} },
            true,
          );
          setOverrides(parsed.scores);
          revision.current = record.revision;
        }
        setStored(true);
      })
      .catch((e) => setMessage(String(e)));
    return () => {
      active.current = false;
      bridge.current?.dispose();
      bridge.current = null;
      engine.stop();
    };
  }, [project, engine]);
  useEffect(() => {
    if (!ready) return;
    const b = bridge.current;
    if (!b) return;
    if (draft && project.scores[selected]) b.previewDraft(selected, score);
    else {
      b.clearPreview();
      if (sounding && overrides[sounding])
        b.previewDraft(sounding, overrides[sounding]);
    }
  }, [draft, score, selected, ready, overrides]);
  function event(e: RuntimePreviewEvent) {
    if (!active.current) return;
    if (e.type === "contextChanged") setContext(e.contextId);
    if (e.type === "soundingCue") setSounding(e.assetId);
    if (e.type === "triggerSfx") setLastSfx(e.assetId);
    if (e.type === "error") setMessage(e.message);
    if (e.type === "requestCue") {
      const current = draftRef.current;
      const value =
        current.enabled && current.selected === e.assetId
          ? current.score
          : overridesRef.current[e.assetId];
      if (value) bridge.current?.previewDraft(e.assetId, value);
      else bridge.current?.clearPreview();
    }
  }
  async function connect() {
    bridge.current?.dispose();
    setReady(undefined);
    setRunning(false);
    if (!iframe.current?.contentWindow) return;
    const b = createPreviewHost({
      target: iframe.current.contentWindow,
      origin: location.origin,
      stopLocalAudio: () => engine.stop(),
      onEvent: event,
    });
    bridge.current = b;
    try {
      const response = await b.connect();
      if (bridge.current !== b) return;
      if (JSON.stringify(response.catalog) !== JSON.stringify(project.catalog))
        throw new Error("Game/catalog identity mismatch");
      setReady(response);
      b.loadContext("title", "start");
      setMessage(
        "Actual game connected. Press Play, then click the game if your browser asks to enable sound.",
      );
    } catch (e) {
      if (bridge.current === b) setMessage(String(e));
    }
  }
  function command(action: (b: PreviewHost) => void) {
    try {
      if (!bridge.current || !ready)
        throw new Error("Game preview is not connected");
      engine.stop();
      action(bridge.current);
    } catch (e) {
      setMessage(String(e));
    }
  }
  function load(id: string) {
    command((b) => {
      b.loadContext(id, "start");
      setContext(id);
      setRunning(false);
      setMessage("Deterministic T-800 checkpoint loaded. Press Play to begin.");
    });
  }
  async function save(next: Record<string, Score>) {
    setOverrides(next);
    try {
      const result = await saveAudioProject(
        project.catalog.projectId,
        { sourceSha256: project.sourceSha256, overrides: next },
        revision.current,
      );
      revision.current = result.revision;
      setMessage(
        "Project assignments saved in this browser. The original source remains available with Return to original.",
      );
    } catch (e) {
      setMessage(`${String(e)} Export assignments to keep this copy.`);
    }
  }
  const asset = project.catalog.assets.find((a) => a.id === selected),
    usages = project.catalog.usages.filter((u) => u.assetId === selected);
  function download(
    value: unknown = { sourceSha256: project.sourceSha256, overrides },
  ) {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "terminator.audio-assignments.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="game-audio ga-terminator">
      <header>
        <div>
          <h2>Game audio</h2>
          <p>Terminator: Liquid Metal · actual local game</p>
        </div>
        <button onClick={() => download()}>Export assignments</button>
        {recovery !== undefined && (
          <button onClick={() => download(recovery)}>
            Export previous assignments
          </button>
        )}
        <button disabled={!stored} onClick={() => input.current?.click()}>
          Import assignments
        </button>
        <input
          ref={input}
          hidden
          type="file"
          accept=".json"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              if (file.size > 4_000_000)
                throw new Error("Assignments too large");
              const value = JSON.parse(await file.text());
              if (value.sourceSha256 !== project.sourceSha256)
                throw new Error("Assignments require the same source revision");
              const parsed = parseTerminatorProject(
                { ...project, scores: value.overrides },
                true,
              );
              for (const id of Object.keys(parsed.scores))
                if (!project.scores[id])
                  throw new Error("Unknown assignment asset");
              command((b) => b.pause());
              setRunning(false);
              await save(parsed.scores);
            } catch (err) {
              setMessage(String(err));
            }
            e.target.value = "";
          }}
        />
      </header>
      <p className="ga-notice">
        The original game renders and owns audio here. Editable imports preserve
        native note timing; three editor energy levels approximate native heat
        thresholds, and synth patches approximate its orchestral timbres. Draft
        loops start at the repeat region. Previewing a draft changes only the
        selected cue.
      </p>
      <div className="ga-layout">
        <aside>
          <h3>Audio catalog</h3>
          {(["music", "sfx"] as const).map((kind) => (
            <div key={kind}>
              <h4>{kind === "music" ? "Music" : "Sound effects"}</h4>
              {project.catalog.assets
                .filter((a) => a.kind === kind)
                .map((a) => (
                  <button
                    key={a.id}
                    className={selected === a.id ? "ga-selected" : ""}
                    onClick={() => setSelected(a.id)}
                  >
                    {a.name}
                    <small>
                      {a.kind} ·{" "}
                      {
                        project.catalog.usages.filter((u) => u.assetId === a.id)
                          .length
                      }{" "}
                      mapped uses{overrides[a.id] ? " · saved override" : ""}
                    </small>
                  </button>
                ))}
            </div>
          ))}
        </aside>
        <main>
          <div className={`ga-viewport ga-real-game`}>
            <iframe
              title="Terminator: Liquid Metal playable preview"
              ref={iframe}
              src={`${base}index.html?seed=426&galleria=0`}
              allow="autoplay"
              onLoad={() => void connect()}
            />
          </div>
          <div className="ga-toolbar">
            <button
              disabled={!ready}
              onClick={() =>
                command((b) => {
                  b.play();
                  setRunning(true);
                  setMessage(
                    "Game running. Use the original mouse/keyboard or touch controls inside the frame.",
                  );
                })
              }
            >
              Play
            </button>
            <button
              disabled={!ready}
              onClick={() =>
                command((b) => {
                  b.pause();
                  setRunning(false);
                  setMessage("Game and audio paused.");
                })
              }
            >
              Pause sound
            </button>
            <button
              disabled={!ready}
              onClick={() =>
                command((b) => {
                  b.reset();
                  setRunning(false);
                  setMessage(
                    "Checkpoint reset to the same seed and starting state.",
                  );
                })
              }
            >
              Reset checkpoint
            </button>
            <span>{running ? "Playing" : "Paused"}</span>
          </div>
          <label>
            Scene / checkpoint{" "}
            <select
              aria-label="Game scene checkpoint"
              value={context}
              disabled={!ready}
              onChange={(e) => load(e.target.value)}
            >
              {project.catalog.contexts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <p className="ga-observed">
            Sounding cue: {sounding ?? "silent"} · Last effect:{" "}
            {lastSfx ?? "none"}
          </p>
          <div className="ga-source">
            <strong>
              {draft
                ? "Previewing current working draft"
                : overrides[sounding ?? ""]
                  ? "Playing saved project override"
                  : "Original game audio"}
            </strong>
            <button
              disabled={!ready || asset?.kind !== "music"}
              onClick={() => setDraft((v) => !v)}
            >
              {draft ? "Return to pinned" : "Preview current draft"}
            </button>
            <p>
              {draft
                ? `Temporary override for ${selected}; play a mapped context below to hear it.`
                : "Saved overrides apply only to this preview project."}
            </p>
          </div>
          <p role="status">{message}</p>
        </main>
        <aside>
          <h3>{asset?.name ?? "Select audio"}</h3>
          {asset?.kind === "music" ? (
            <>
              <button
                onClick={() => {
                  command((b) => b.pause());
                  setRunning(false);
                  onEditScore(
                    structuredClone(
                      overrides[selected] ?? project.scores[selected]!,
                    ),
                  );
                }}
              >
                Edit pinned snapshot as draft
              </button>
              <button
                disabled={!stored || !ready}
                onClick={() => {
                  void save({
                    ...overrides,
                    [selected]: structuredClone(score),
                  });
                  setDraft(false);
                }}
              >
                Save snapshot & apply current draft
              </button>
              <button
                disabled={!overrides[selected]}
                onClick={() => {
                  const next = { ...overrides };
                  delete next[selected];
                  void save(next);
                  setDraft(false);
                }}
              >
                Return to original
              </button>
            </>
          ) : (
            <button
              disabled={!ready?.capabilities.auditionSfx}
              onClick={() => command((b) => b.auditionSfx(selected))}
            >
              Audition sound effect
            </button>
          )}
          <h4>Where used</h4>
          {usages.length ? (
            usages.map((u) => (
              <button
                key={u.id}
                disabled={!ready}
                onClick={() => load(u.contextId)}
              >
                {
                  project.catalog.contexts.find((c) => c.id === u.contextId)
                    ?.name
                }
                <small>{u.trigger} · deterministic start</small>
              </button>
            ))
          ) : (
            <p>
              No context mapping. Audition is available for native sound
              effects.
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}
