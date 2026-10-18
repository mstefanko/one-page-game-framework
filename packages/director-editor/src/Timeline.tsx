import { useEffect, useRef, useState } from "react";
import {
  applyCommands,
  planClipTiming,
  sceneDuration,
} from "@onepage/director-core";
import type { SceneCommand, SceneDocument } from "@onepage/director-core";
import "./timeline.css";
export interface TimelineProps {
  scene: SceneDocument;
  tick: number;
  selected?: string;
  allowProtected?: boolean;
  onSelect: (id: string, tick: number) => void;
  onCommit: (commands: SceneCommand[]) => void;
}
type Target = "motion" | "dialogue" | "camera" | "audio";
type Mode = "move" | "start" | "end";
interface Clip {
  id: string;
  target: Target;
  start: number;
  duration: number;
  offset: number;
  scope: number;
  label: string;
  row: number;
}
interface Gesture {
  base: SceneDocument;
  id: string;
  mode: Mode;
  pointerId: number;
  x: number;
  pixelsPerTick: number;
  original: Clip;
  commands: SceneCommand[];
  moved: boolean;
}
const groups = [
  { target: "motion", name: "Motion" },
  { target: "dialogue", name: "Dialogue" },
  { target: "camera", name: "Camera" },
  { target: "audio", name: "Audio" },
] as const;
function clipsFor(scene: SceneDocument, target: Target): Clip[] {
  const source =
    target === "motion"
      ? scene.motions
      : target === "dialogue"
        ? scene.dialogue
        : target === "camera"
          ? scene.camera
          : scene.audio;
  const clips: Clip[] = source
    .map((item) => {
      const shot =
        "shotId" in item
          ? scene.shots.find((s) => s.id === item.shotId)
          : undefined;
      return {
        id: item.id,
        target,
        start: item.start,
        duration: item.duration,
        offset: shot?.start ?? 0,
        scope: shot?.duration ?? sceneDuration(scene),
        label:
          "text" in item
            ? item.text
            : "action" in item
              ? `${scene.actors.find((a) => a.id === item.actorId)?.name ?? "Actor"} · ${item.action}`
              : "title" in item
                ? item.title
                : `${shot?.name ?? "Scene"} camera`,
        row: 0,
      };
    })
    .sort((a, b) => a.offset + a.start - (b.offset + b.start));
  const ends: number[] = [];
  for (const clip of clips) {
    const start = clip.offset + clip.start;
    let row = ends.findIndex((end) => end <= start);
    if (row < 0) row = ends.length;
    ends[row] = start + clip.duration;
    clip.row = row;
  }
  return clips;
}
const time = (ticks: number) => `${(ticks / 60).toFixed(2)}s · ${ticks}f`;
export function Timeline({
  scene,
  tick,
  selected,
  allowProtected = false,
  onSelect,
  onCommit,
}: TimelineProps) {
  const rail = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [transient, setTransient] = useState<SceneDocument | null>(null);
  const [dragId, setDragId] = useState("");
  const [status, setStatus] = useState(
    "Drag to move; use the clip edges to resize. Arrow keys adjust one frame; Shift adjusts ten.",
  );
  const total = Math.max(1, sceneDuration(scene));
  const shown = transient ?? scene;
  function cancel() {
    gesture.current = null;
    setTransient(null);
    setDragId("");
    setStatus("Timing edit cancelled.");
  }
  useEffect(() => {
    if (gesture.current) cancel();
  }, [scene]);
  function begin(
    e: React.PointerEvent<HTMLButtonElement>,
    clip: Clip,
    mode: Mode,
  ) {
    if (e.button !== 0 || gesture.current) return;
    e.preventDefault();
    e.stopPropagation();
    const width = rail.current?.getBoundingClientRect().width ?? 0;
    if (!width) return;
    gesture.current = {
      base: scene,
      id: clip.id,
      mode,
      pointerId: e.pointerId,
      x: e.clientX,
      pixelsPerTick: width / total,
      original: clip,
      commands: [],
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function request(clip: Clip, mode: Mode, delta: number) {
    if (mode === "move") {
      const d = Math.max(
        -clip.start,
        Math.min(clip.scope - clip.start - clip.duration, delta),
      );
      return { start: clip.start + d };
    }
    if (mode === "start") {
      const d = Math.max(-clip.start, Math.min(clip.duration - 1, delta));
      return { start: clip.start + d, duration: clip.duration - d };
    }
    const d = Math.max(
      1 - clip.duration,
      Math.min(clip.scope - clip.start - clip.duration, delta),
    );
    return { duration: clip.duration + d };
  }
  function move(e: React.PointerEvent<HTMLButtonElement>) {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;
    if (g.base !== scene) {
      cancel();
      return;
    }
    if (!g.moved && Math.abs(e.clientX - g.x) < 4) return;
    g.moved = true;
    setDragId(g.id);
    const delta = Math.round((e.clientX - g.x) / g.pixelsPerTick);
    try {
      const patch = request(g.original, g.mode, delta);
      if (
        (patch.start === undefined || patch.start === g.original.start) &&
        (patch.duration === undefined || patch.duration === g.original.duration)
      ) {
        g.commands = [];
        setTransient(null);
        setStatus("No timing change.");
        return;
      }
      const commands = planClipTiming(scene, g.original.target, g.id, patch, {
        allowProtected,
      });
      const preview = applyCommands(scene, commands, { allowProtected });
      g.commands = commands;
      setTransient(preview);
      const result = clipsFor(preview, g.original.target).find(
        (c) => c.id === g.id,
      );
      if (result)
        setStatus(
          `${g.mode === "move" ? "Move" : g.mode === "start" ? "Trim start" : "Resize end"}: ${result.label}. Start ${time(result.start + result.offset)}, duration ${time(result.duration)}.`,
        );
    } catch (error) {
      g.commands = [];
      setTransient(null);
      setStatus(`Cannot change timing: ${String(error)}`);
    }
  }
  function end(e: React.PointerEvent<HTMLButtonElement>) {
    const current = gesture.current;
    if (!current || current.pointerId !== e.pointerId) return;
    if (current.base !== scene) {
      cancel();
      return;
    }
    // Pointerup is authoritative even if the browser coalesced its final move.
    move(e);
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;
    gesture.current = null;
    setTransient(null);
    setDragId("");
    if (g.moved) {
      if (g.commands.length) {
        try {
          onCommit(g.commands);
          setStatus("Timing edit applied as one undo step.");
        } catch (error) {
          setStatus(`Timing edit was not applied: ${String(error)}`);
        }
      }
    } else if (g.mode === "move")
      onSelect(g.id, g.original.offset + g.original.start);
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  }
  function key(
    e: React.KeyboardEvent<HTMLButtonElement>,
    clip: Clip,
    mode: Mode,
  ) {
    if (e.key === "Escape") {
      cancel();
      return;
    }
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const delta = (e.key === "ArrowLeft" ? -1 : 1) * (e.shiftKey ? 10 : 1);
    try {
      const commands = planClipTiming(
        scene,
        clip.target,
        clip.id,
        request(clip, mode, delta),
        { allowProtected },
      );
      onCommit(commands);
      setStatus(
        `${clip.label}: timing adjusted by ${delta} frame${Math.abs(delta) === 1 ? "" : "s"}.`,
      );
    } catch (error) {
      setStatus(`Cannot change timing: ${String(error)}`);
    }
  }
  const pointerProps = (clip: Clip, mode: Mode) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) =>
      begin(e, clip, mode),
    onPointerMove: move,
    onPointerUp: end,
    onPointerCancel: cancel,
    onLostPointerCapture: () => {
      if (gesture.current) cancel();
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) =>
      key(e, clip, mode),
  });
  return (
    <section
      className="pd-editable-timeline"
      aria-label="Scene timeline"
      onKeyDown={(e) => {
        if (e.key === "Escape") cancel();
      }}
    >
      <div className="pd-timing-ruler">
        <b>TRACKS</b>
        <div ref={rail}>
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} style={{ left: `${(i / 6) * 100}%` }}>
              {(((total / 60) * i) / 6).toFixed(1)}s
            </span>
          ))}
        </div>
      </div>
      {groups.map((group) => {
        const clips = clipsFor(shown, group.target);
        const rows = Math.max(1, ...clips.map((c) => c.row + 1));
        return (
          <div
            className={`pd-timing-lane pd-timing-${group.target}`}
            key={group.target}
          >
            <b>
              {group.name}
              <small>
                {clips.length} clip{clips.length === 1 ? "" : "s"}
              </small>
            </b>
            <div className="pd-timing-rail" style={{ height: rows * 34 + 9 }}>
              {clips.map((clip) => (
                <div
                  key={clip.id}
                  className={`pd-timing-clip ${selected === clip.id ? "is-selected" : ""} ${dragId === clip.id ? "is-dragging" : ""}`}
                  style={{
                    left: `${((clip.offset + clip.start) / total) * 100}%`,
                    width: `${(clip.duration / total) * 100}%`,
                    top: clip.row * 34 + 5,
                  }}
                  role="group"
                  aria-label={`${clip.label}, start ${time(clip.offset + clip.start)}, duration ${time(clip.duration)}`}
                >
                  <button
                    {...pointerProps(clip, "start")}
                    className="pd-timing-edge pd-timing-start"
                    aria-label={`Resize start of ${clip.label}`}
                    title="Drag start edge; arrow keys adjust frames"
                  >
                    ⋮
                  </button>
                  <button
                    {...pointerProps(clip, "move")}
                    className="pd-timing-body"
                    aria-label={`Select or move ${clip.label}`}
                    title={`${clip.label}\n${time(clip.offset + clip.start)} – ${time(clip.offset + clip.start + clip.duration)}`}
                    onClick={(e) => {
                      if (e.detail === 0)
                        onSelect(clip.id, clip.offset + clip.start);
                    }}
                  >
                    {clip.label}
                  </button>
                  <button
                    {...pointerProps(clip, "end")}
                    className="pd-timing-edge pd-timing-end"
                    aria-label={`Resize end of ${clip.label}`}
                    title="Drag end edge; arrow keys adjust frames"
                  >
                    ⋮
                  </button>
                </div>
              ))}
              <i
                className="pd-timing-playhead"
                style={{
                  left: `${Math.min(100, Math.max(0, (tick / total) * 100))}%`,
                }}
                aria-hidden="true"
              />
            </div>
          </div>
        );
      })}
      <p className="pd-timing-status" role="status" aria-live="polite">
        {status}
      </p>
    </section>
  );
}
