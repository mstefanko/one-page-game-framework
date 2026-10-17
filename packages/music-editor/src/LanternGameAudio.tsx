import { useEffect, useRef, useState } from "react";
import type { Score } from "@onepage/project";
import { readAudioProject, saveAudioProject } from "@onepage/asset-library";
import type { AudioEngine } from "@onepage/music-web-audio";
import {
  CONTEXTS,
  clone,
  createDemoManifest,
  parseManifest,
  pinDraft,
  whereUsed,
  type ContextId,
  type SfxAsset,
} from "./game-audio";
import "./game-audio.css";
export function LanternGameAudio({
  score,
  onEditScore,
  engine,
}: {
  score: Score;
  onEditScore: (score: Score) => void;
  engine: AudioEngine;
}) {
  const [manifest, setManifest] = useState(() => createDemoManifest(score));
  const [selected, setSelected] = useState("cue");
  const [context, setContext] = useState<ContextId>("menu");
  const [running, setRunning] = useState(false);
  const [watch, setWatch] = useState(false);
  const [draft, setDraft] = useState(false);
  const [energy, setEnergy] = useState(1);
  const [x, setX] = useState(18);
  const [hits, setHits] = useState(0);
  const [frame, setFrame] = useState(0);
  const [message, setMessage] = useState(
    "Choose Play or Watch replay to enable sound.",
  );
  const [ready, setReady] = useState(false);
  const projectRevision = useRef<number | null>(null);
  const saving = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  const stops = useRef<(() => void)[]>([]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      engine.stop();
      stops.current.forEach((stop) => stop());
    };
  }, [engine]);
  useEffect(() => {
    let cancelled = false;
    void readAudioProject("lantern-courier-demo")
      .then(async (record) => {
        if (cancelled) return;
        if (record) {
          setManifest(parseManifest(JSON.stringify(record.manifest)));
          projectRevision.current = record.revision;
        } else {
          try {
            const saved = await saveAudioProject(
              "lantern-courier-demo",
              manifest,
              null,
            );
            if (cancelled) return;
            projectRevision.current = saved.revision;
          } catch (error) {
            const latest = await readAudioProject("lantern-courier-demo");
            if (!latest) throw error;
            if (cancelled) return;
            setManifest(parseManifest(JSON.stringify(latest.manifest)));
            projectRevision.current = latest.revision;
          }
        }
        setReady(true);
      })
      .catch((error) => {
        if (!cancelled) {
          setMessage(
            `Project storage unavailable: ${String(error)}. Export assignments to preserve your work.`,
          );
          setReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);
  async function commit(next: typeof manifest) {
    if (saving.current) return;
    saving.current = true;
    setManifest(next);
    try {
      const saved = await saveAudioProject(
        next.projectId,
        next,
        projectRevision.current,
      );
      projectRevision.current = saved.revision;
      setMessage(
        "Project assignments saved in this browser. Export for a separate backup.",
      );
    } catch (error) {
      setMessage(
        `${String(error)} Local assignments are kept in memory; export them now.`,
      );
    } finally {
      saving.current = false;
    }
  }
  const asset = manifest.assets.find((a) => a.id === selected);
  const assigned = manifest.assets.find(
    (a) =>
      a.id ===
      manifest.usages.find(
        (u) =>
          u.contextId === context &&
          manifest.assets.some((a) => a.id === u.assetId && a.kind === "music"),
      )?.assetId,
  );
  const sound = (id: string) => {
    const a = manifest.assets.find((a) => a.id === id);
    if (a?.kind === "sfx") {
      const s = a as SfxAsset;
      stops.current.push(
        engine.previewNote(s.patch, s.pitch, 0.7, s.duration, 0.45),
      );
      stops.current = stops.current.slice(-32);
    }
  };
  useEffect(() => {
    engine.stop();
    if (!running) return;
    let cancelled = false;
    const music = draft
      ? score
      : assigned?.kind === "music"
        ? assigned.score
        : null;
    if (music)
      void engine
        .play(music, { loop: context !== "victory", energy })
        .catch((error) => {
          if (!cancelled) setMessage(String(error));
        });
    return () => {
      cancelled = true;
      engine.stop();
    };
  }, [running, context, draft, score, manifest, engine]);
  useEffect(() => {
    engine.setEnergy(energy);
  }, [energy, engine]);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setFrame((f) => f + 1), 80);
    return () => clearInterval(timer);
  }, [running]);
  useEffect(() => {
    if (!running || !watch) return;
    let step = 0;
    setContext("menu");
    setX(18);
    setHits(0);
    const timer = setInterval(() => {
      step++;
      if (step === 2) setContext("explore");
      if (step >= 2 && step < 6) {
        setX(18 + (step - 2) * 16);
        sound("step");
      }
      if (step === 6) setContext("combat");
      if (step > 6 && step < 10) {
        setHits(step - 6);
        sound("strike");
      }
      if (step === 10) {
        setContext("victory");
        sound("win");
      }
      if (step === 14) {
        step = 0;
        setContext("menu");
        setX(18);
        setHits(0);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [running, watch, manifest]);
  function load(id: ContextId) {
    setContext(id);
    setHits(0);
    setX(18);
    setWatch(false);
    setMessage(`Checkpoint loaded: ${id}. Press Play to hear assigned audio.`);
  }
  async function start(replay: boolean) {
    engine.stop();
    try {
      await engine.enable();
      if (!alive.current) return;
      setWatch(replay);
      setRunning(true);
      setMessage(
        replay
          ? "Deterministic replay: title → path → encounter → delivery."
          : "Play: move along the path, then strike three times.",
      );
    } catch (e) {
      setMessage(String(e));
    }
  }
  function action(kind: "move" | "strike" | "start") {
    if (!running || watch) return;
    if (kind === "start") {
      setContext("explore");
      return;
    }
    if (context === "explore" && kind === "move") {
      sound("step");
      setX((v) => {
        if (v >= 66) setContext("combat");
        return Math.min(82, v + 12);
      });
    }
    if (context === "combat" && kind === "strike") {
      sound("strike");
      setHits((v) => {
        if (v >= 2) {
          setContext("victory");
          sound("win");
        }
        return v + 1;
      });
    }
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(manifest, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "lantern-courier.audio.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="game-audio">
      <header>
        <div>
          <h2>Game audio</h2>
          <p>Lantern Courier · demo project</p>
        </div>
        <button onClick={download}>Export assignments</button>
        <button disabled={!ready} onClick={() => input.current?.click()}>
          Import assignments
        </button>
        <input
          ref={input}
          type="file"
          accept=".json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              if (f.size > 4_000_000) throw new Error("Manifest too large");
              const m = parseManifest(await f.text());
              engine.stop();
              setRunning(false);
              await commit(m);
              setSelected(m.assets[0]?.id ?? "");
            } catch (err) {
              setMessage(String(err));
            }
            e.target.value = "";
          }}
        />
      </header>
      <p className="ga-notice">
        Explore music and sound effects in a playable example.
      </p>
      <div className="ga-layout">
        <aside>
          <h3>Audio catalog</h3>
          {(["music", "sfx"] as const).map((kind) => (
            <div key={kind}>
              <h4>{kind === "music" ? "Music" : "Sound effects"}</h4>
              {manifest.assets
                .filter((a) => a.kind === kind)
                .map((a) => (
                  <button
                    key={a.id}
                    className={selected === a.id ? "ga-selected" : ""}
                    onClick={() => setSelected(a.id)}
                  >
                    {a.name}
                    <small>
                      v{a.revision} · {whereUsed(manifest, a.id).length} uses
                    </small>
                  </button>
                ))}
            </div>
          ))}
        </aside>
        <main>
          <div
            className={`ga-viewport ga-${context}`}
            tabIndex={0}
            aria-label="Lantern Courier playable preview"
            onKeyDown={(e) => {
              if (e.repeat) return;
              if (["ArrowRight", " ", "Enter"].includes(e.key)) {
                e.preventDefault();
                action(
                  e.key === "ArrowRight"
                    ? "move"
                    : context === "menu"
                      ? "start"
                      : "strike",
                );
              }
            }}
          >
            <div className="ga-stars">✧ · ✦ · · ✧ · ✦</div>
            <div className="ga-game-title">
              {context === "menu"
                ? "LANTERN COURIER"
                : context === "explore"
                  ? "Follow the moonlit path"
                  : context === "combat"
                    ? `Paper phantoms · ${Math.max(0, 3 - hits)} remaining`
                    : "DELIVERY COMPLETE"}
            </div>
            <div className="ga-moon">☾</div>
            <div className="ga-path" />
            <div
              className="ga-courier"
              style={{
                left: `${context === "menu" ? 25 : x}%`,
                transform: `translateY(${running && frame % 2 ? -4 : 0}px)`,
              }}
            >
              ♟<span>✦</span>
            </div>
            {context === "combat" && (
              <div
                className="ga-phantom"
                style={{ transform: `translateY(${frame % 2 ? 5 : -5}px)` }}
              >
                ♧
              </div>
            )}
            {context === "victory" && (
              <div className="ga-delivered">
                ✦<p>One small light, safely home.</p>
              </div>
            )}
            <div className="ga-game-actions">
              {context === "menu" ? (
                <button
                  disabled={!running || watch}
                  onClick={() => action("start")}
                >
                  Begin journey
                </button>
              ) : context === "explore" ? (
                <button
                  disabled={!running || watch}
                  onClick={() => action("move")}
                >
                  Walk →
                </button>
              ) : context === "combat" ? (
                <button
                  disabled={!running || watch}
                  onClick={() => action("strike")}
                >
                  Strike · Space
                </button>
              ) : (
                <button onClick={() => load("menu")}>Back to title</button>
              )}
            </div>
          </div>
          <div className="ga-toolbar">
            <button onClick={() => void start(false)}>Play</button>
            <button onClick={() => void start(true)}>Watch replay</button>
            <button
              onClick={() => {
                engine.stop();
                setRunning(false);
                setWatch(false);
              }}
            >
              Pause sound
            </button>
            <button
              onClick={() => {
                engine.stop();
                setRunning(false);
                setWatch(false);
                load("menu");
              }}
            >
              Reset
            </button>
          </div>
          <div className="ga-contexts">
            {CONTEXTS.map((id) => (
              <button
                key={id}
                aria-pressed={context === id}
                onClick={() => load(id)}
              >
                {id}
              </button>
            ))}
          </div>
          <label>
            Energy{" "}
            <input
              type="range"
              min="1"
              max="3"
              step="1"
              value={energy}
              onChange={(e) => setEnergy(Number(e.target.value))}
            />
            {energy}
          </label>
          <div className="ga-source">
            <strong>
              {draft
                ? "Previewing current working draft"
                : "Playing pinned project snapshot"}
            </strong>
            <button onClick={() => setDraft((v) => !v)}>
              {draft ? "Return to pinned" : "Preview current draft"}
            </button>
            <p>
              {draft
                ? "Draft changes are temporary. Project assignments remain pinned."
                : assigned?.kind === "music"
                  ? `${assigned.name} · v${assigned.revision}`
                  : "No music assigned"}
            </p>
          </div>
          <p role="status">{message}</p>
        </main>
        <aside>
          <h3>{asset?.name ?? "Select an asset"}</h3>
          {asset?.kind === "sfx" && (
            <button
              onClick={async () => {
                try {
                  await engine.enable();
                  sound(asset.id);
                } catch (err) {
                  setMessage(String(err));
                }
              }}
            >
              Audition sound effect
            </button>
          )}
          {asset?.kind === "music" && (
            <>
              <button
                onClick={() => {
                  engine.stop();
                  setRunning(false);
                  onEditScore(clone(asset.score));
                }}
              >
                Edit pinned snapshot as draft
              </button>
              <button
                disabled={!ready}
                onClick={() => {
                  void commit(pinDraft(manifest, asset.id, score));
                  setDraft(false);
                }}
              >
                Save snapshot & apply current draft
              </button>
            </>
          )}
          <h4>Where used</h4>
          {asset &&
            whereUsed(manifest, asset.id).map((u) => (
              <button
                key={u.id}
                onClick={() => {
                  load(u.contextId);
                  setMessage(
                    `${u.contextName} · ${u.trigger} · replay ${u.checkpoint}s`,
                  );
                }}
              >
                {u.contextName}
                <small>
                  {u.trigger} · checkpoint {u.checkpoint}s
                </small>
              </button>
            ))}
        </aside>
      </div>
    </section>
  );
}
