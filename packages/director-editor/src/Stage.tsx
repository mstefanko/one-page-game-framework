import { useEffect, useRef, useState } from "react";
import { evaluateScene } from "@onepage/director-core";
import type {
  SceneDocument,
  EvaluatedActor,
  Point,
  Motion,
} from "@onepage/director-core";
import { renderScene, hydrateSceneMedia } from "@onepage/director-runtime";
export type StageOperation = "Starting pose" | "Action endpoint";
export interface StageProps {
  scene: SceneDocument;
  tick: number;
  selected?: string;
  guides?: boolean;
  revealDialogue?: boolean;
  operation?: StageOperation;
  onSelect?: (id: string) => void;
  onMove?: (x: number, y: number, id: string) => void;
}
interface Camera {
  x: number;
  y: number;
  zoom: number;
}
interface Bounds {
  left: number;
  top: number;
  width: number;
  height: number;
}
/** CSS coordinates -> logical world coordinates, undoing the evaluated camera. */
export function stageToWorld(
  point: Point,
  bounds: Bounds,
  size: { width: number; height: number },
  camera: Camera,
): Point {
  return {
    x:
      (((point.x - bounds.left) / bounds.width) * size.width - size.width / 2) /
        camera.zoom +
      camera.x,
    y:
      (((point.y - bounds.top) / bounds.height) * size.height -
        size.height / 2) /
        camera.zoom +
      camera.y,
  };
}
export function worldToStage(
  point: Point,
  size: { width: number; height: number },
  camera: Camera,
): Point {
  return {
    x: (point.x - camera.x) * camera.zoom + size.width / 2,
    y: (point.y - camera.y) * camera.zoom + size.height / 2,
  };
}
export function actorBounds(actor: EvaluatedActor): Bounds {
  const variant = actor.variant,
    frame = variant?.frames[actor.frameIndex];
  if (!frame || !variant)
    return {
      left: actor.x - 12 * actor.scale,
      top: actor.y - 36 * actor.scale,
      width: 24 * actor.scale,
      height: 38 * actor.scale,
    };
  const scale = (actor.scale * variant.logicalHeight) / frame.height,
    ground = frame.sockets?.ground ??
      variant.sockets.ground ?? { x: frame.width / 2, y: frame.height };
  return {
    left: actor.x - ground.x * scale,
    top: actor.y - ground.y * scale,
    width: frame.width * scale,
    height: frame.height * scale,
  };
}
export function hitActor(
  actors: EvaluatedActor[],
  point: Point,
): EvaluatedActor | undefined {
  return [...actors]
    .sort((a, b) => a.y - b.y)
    .reverse()
    .find((actor) => {
      const b = actorBounds(actor);
      return (
        point.x >= b.left &&
        point.x <= b.left + b.width &&
        point.y >= b.top &&
        point.y <= b.top + b.height
      );
    });
}
export interface StageTarget {
  id: string;
  actorId: string;
  point: Point;
  motion?: Motion;
}
export function stageTarget(
  scene: SceneDocument,
  tick: number,
  selected: string | undefined,
  operation: StageOperation,
): StageTarget | undefined {
  const explicit = scene.motions.find((m) => m.id === selected),
    actor = scene.actors.find((a) => a.id === (explicit?.actorId ?? selected));
  if (!actor) return;
  const shot = evaluateScene(scene, tick).shot,
    motion =
      explicit ??
      scene.motions.find(
        (m) => m.actorId === actor.id && m.shotId === shot?.id,
      );
  if (operation === "Action endpoint" && !motion) return;
  return {
    id: explicit?.id ?? actor.id,
    actorId: actor.id,
    motion,
    point: motion
      ? operation === "Action endpoint"
        ? motion.to
        : motion.from
      : { x: actor.x, y: actor.y },
  };
}
interface Drag {
  base: SceneDocument;
  pointerId: number;
  target: StageTarget;
  offset: Point;
  origin: Point;
  point: Point;
  moved: boolean;
}
export function Stage({
  scene,
  tick,
  selected,
  guides = false,
  revealDialogue = false,
  operation = "Starting pose",
  onSelect,
  onMove,
}: StageProps) {
  const canvas = useRef<HTMLCanvasElement>(null),
    drag = useRef<Drag | null>(null),
    [ghost, setGhost] = useState<{ actorId: string; point: Point } | null>(
      null,
    ),
    [mediaRevision, setMediaRevision] = useState(0);
  const target = stageTarget(scene, tick, selected, operation);
  useEffect(() => {
    let active = true;
    void hydrateSceneMedia(scene).then(() => {
      if (active) setMediaRevision((v) => v + 1);
    });
    return () => {
      active = false;
    };
  }, [scene]);
  useEffect(() => {
    const d = drag.current;
    if (d && canvas.current) cancel(canvas.current, d.pointerId);
    else setGhost(null);
  }, [scene, operation]);
  useEffect(() => {
    const d = drag.current;
    if (d && selected !== d.target.id && selected !== d.target.actorId) {
      if (canvas.current) cancel(canvas.current, d.pointerId);
    }
  }, [selected]);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const frame = evaluateScene(scene, tick);
    renderScene(el, scene, tick, {
      preview: true,
      revealDialogue,
      selectedId: target?.actorId ?? selected,
      guides,
      actorPreview: ghost ? { id: ghost.actorId, ...ghost.point } : undefined,
    });
    if (!target || !onMove) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    const map = (point: Point) => worldToStage(point, scene, frame.camera),
      handle = map(ghost?.point ?? target.point);
    ctx.save();
    ctx.strokeStyle = "#f8d591";
    ctx.fillStyle = "#142b38";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 2]);
    if (target.motion) {
      const from = map(
          operation === "Starting pose" && ghost
            ? ghost.point
            : target.motion.from,
        ),
        to = map(
          operation === "Action endpoint" && ghost
            ? ghost.point
            : target.motion.to,
        );
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      for (const p of [from, to]) {
        ctx.strokeRect(p.x - 2, p.y - 2, 4, 4);
      }
    }
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(handle.x, handle.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffdfa2";
    ctx.font = "6px sans-serif";
    ctx.textAlign = handle.x > scene.width / 2 ? "right" : "left";
    ctx.fillText(
      operation,
      Math.max(4, Math.min(scene.width - 4, handle.x)),
      Math.max(8, Math.min(scene.height - 4, handle.y + 12)),
    );
    if (!ghost) {
      ctx.globalAlpha = 0.5;
      ctx.setLineDash([2, 2]);
      ctx.strokeRect(
        handle.x - 10 * frame.camera.zoom,
        handle.y - 32 * frame.camera.zoom,
        20 * frame.camera.zoom,
        32 * frame.camera.zoom,
      );
    }
    ctx.restore();
  }, [
    scene,
    tick,
    selected,
    guides,
    revealDialogue,
    operation,
    ghost,
    mediaRevision,
    onMove,
  ]);
  const world = (e: React.PointerEvent<HTMLCanvasElement>) =>
    stageToWorld(
      { x: e.clientX, y: e.clientY },
      e.currentTarget.getBoundingClientRect(),
      scene,
      evaluateScene(scene, tick).camera,
    );
  const cancel = (el: HTMLCanvasElement, pointerId: number) => {
    drag.current = null;
    setGhost(null);
    if (el.hasPointerCapture?.(pointerId)) el.releasePointerCapture(pointerId);
  };
  return (
    <canvas
      ref={canvas}
      width={scene.width}
      height={scene.height}
      tabIndex={0}
      aria-label={`Scene preview. ${operation}: select an actor or drag its highlighted handle. Numeric controls are available in Inspect.`}
      style={{ touchAction: "none" }}
      onPointerDown={(e) => {
        if (e.button !== 0 || drag.current) return;
        const p = world(e),
          frame = evaluateScene(scene, tick),
          handle =
            target &&
            Math.hypot(p.x - target.point.x, p.y - target.point.y) <=
              7 / frame.camera.zoom;
        const actor = handle ? undefined : hitActor(frame.actors, p),
          next = handle
            ? target
            : actor
              ? target?.actorId === actor.id
                ? target
                : stageTarget(scene, tick, actor.id, operation)
              : undefined;
        if (actor) onSelect?.(next?.id ?? actor.id);
        if (!next || !onMove) return;
        drag.current = {
          base: scene,
          pointerId: e.pointerId,
          target: next,
          offset: { x: p.x - next.point.x, y: p.y - next.point.y },
          origin: { x: e.clientX, y: e.clientY },
          point: next.point,
          moved: false,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
        e.preventDefault();
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d || d.pointerId !== e.pointerId) return;
        if (d.base !== scene) {
          cancel(e.currentTarget, e.pointerId);
          return;
        }
        const p = world(e);
        d.point = { x: p.x - d.offset.x, y: p.y - d.offset.y };
        d.moved ||=
          Math.hypot(e.clientX - d.origin.x, e.clientY - d.origin.y) > 3;
        if (d.moved) setGhost({ actorId: d.target.actorId, point: d.point });
      }}
      onPointerUp={(e) => {
        const d = drag.current;
        if (!d || d.pointerId !== e.pointerId) return;
        if (d.base !== scene) {
          cancel(e.currentTarget, e.pointerId);
          return;
        }
        const p = world(e),
          point = {
            x: Math.round(p.x - d.offset.x),
            y: Math.round(p.y - d.offset.y),
          };
        cancel(e.currentTarget, e.pointerId);
        if (
          (d.moved ||
            Math.hypot(e.clientX - d.origin.x, e.clientY - d.origin.y) > 3) &&
          (point.x !== d.target.point.x || point.y !== d.target.point.y)
        )
          onMove?.(point.x, point.y, d.target.id);
      }}
      onPointerCancel={(e) => {
        if (drag.current?.pointerId === e.pointerId)
          cancel(e.currentTarget, e.pointerId);
      }}
      onLostPointerCapture={(e) => {
        if (drag.current?.pointerId === e.pointerId) {
          drag.current = null;
          setGhost(null);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && drag.current)
          cancel(e.currentTarget, drag.current.pointerId);
      }}
    />
  );
}
