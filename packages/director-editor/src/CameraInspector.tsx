import type {
  SceneCommand,
  SceneDocument,
  Shot,
  CameraKey,
} from "@onepage/director-core";
import { planClipTiming, evaluateScene } from "@onepage/director-core";

export function CameraInspector({
  scene,
  shot,
  selected,
  onCommit,
  onSelect,
  onSeek,
  onDirection,
  allowProtected,
  onError,
}: {
  scene: SceneDocument;
  shot: Shot;
  selected: string;
  onCommit: (commands: SceneCommand[]) => void;
  onSelect: (id: string) => void;
  allowProtected?: boolean;
  onError: (message: string) => void;
  onSeek: (tick: number) => void;
  onDirection: (text: string) => void;
}) {
  const keys = scene.camera.filter((key) => key.shotId === shot.id);
  const key = keys.find((key) => key.id === selected) ?? keys[0];
  const set = (property: string, value: unknown) =>
    key &&
    onCommit([
      { type: "set", target: "camera", targetId: key.id, property, value },
    ]);
  function preset(name: "wide" | "close" | "pan" | "push") {
    const actor = evaluateScene(scene, shot.start + (key?.start ?? 0))
      .actors[0];
    const center = { x: scene.width / 2, y: scene.height / 2 };
    const focus = actor
      ? { x: actor.x, y: actor.y - 16 * actor.scale }
      : center;
    const next: CameraKey = {
      id: key?.id ?? `camera:${crypto.randomUUID()}`,
      shotId: shot.id,
      start: key?.start ?? 0,
      duration: key?.duration ?? shot.duration,
      from:
        name === "close"
          ? focus
          : name === "pan"
            ? { ...center, x: center.x - 12 }
            : center,
      to:
        name === "close"
          ? focus
          : name === "pan"
            ? { ...center, x: center.x + 12 }
            : center,
      fromZoom: name === "close" ? 1.8 : 1,
      zoom: name === "close" ? 1.8 : name === "push" ? 1.5 : 1,
    };
    onCommit([
      {
        type: "set",
        target: "scene",
        property: "camera",
        value: [...scene.camera.filter((c) => c.id !== key?.id), next],
      },
    ]);
    onSelect(next.id);
    onSeek(shot.start + next.start);
  }
  return (
    <section className="pd-camera-inspector" aria-label="Camera controls">
      <h2>Camera & framing</h2>
      <p className="pd-muted">
        2D framing in scene coordinates. Pan moves the frame; zoom crops in.
        Preview size does not change the camera.
      </p>
      <div className="pd-new-actions">
        <button onClick={() => preset("wide")}>Wide frame</button>
        <button onClick={() => preset("close")}>Close on first actor</button>
        <button onClick={() => preset("pan")}>Pan across</button>
        <button onClick={() => preset("push")}>Push in</button>
      </div>
      {keys.length > 1 && (
        <label>
          Camera clip
          <select value={key?.id} onChange={(e) => onSelect(e.target.value)}>
            {keys.map((c, i) => (
              <option key={c.id} value={c.id}>
                Camera {i + 1}
              </option>
            ))}
          </select>
        </label>
      )}
      {key && (
        <>
          <div className="pd-fitting-grid">
            {(["from", "to"] as const).flatMap((point) =>
              (["x", "y"] as const).map((axis) => (
                <label key={point + axis}>
                  {point === "from" ? "Camera start" : "Camera end"}{" "}
                  {axis.toUpperCase()}
                  <input
                    type="number"
                    value={key[point][axis]}
                    onChange={(e) =>
                      set(point, { ...key[point], [axis]: +e.target.value })
                    }
                  />
                </label>
              )),
            )}
            <label>
              Start zoom
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="8"
                value={key.fromZoom ?? key.zoom}
                onChange={(e) => set("fromZoom", +e.target.value)}
              />
            </label>
            <label>
              End zoom
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="8"
                value={key.zoom}
                onChange={(e) => set("zoom", +e.target.value)}
              />
            </label>
          </div>
          <label>
            Camera start (seconds in shot)
            <input
              type="number"
              min="0"
              step={1 / 60}
              value={key.start / 60}
              onChange={(e) => {
                try {
                  onCommit(
                    planClipTiming(
                      scene,
                      "camera",
                      key.id,
                      { start: +e.target.value * 60 },
                      { allowProtected },
                    ),
                  );
                } catch (error) {
                  onError(String(error));
                }
              }}
            />
          </label>
          <label>
            Camera duration (seconds)
            <input
              type="number"
              min={1 / 60}
              step={1 / 60}
              value={key.duration / 60}
              onChange={(e) => {
                try {
                  onCommit(
                    planClipTiming(
                      scene,
                      "camera",
                      key.id,
                      { duration: +e.target.value * 60 },
                      { allowProtected },
                    ),
                  );
                } catch (error) {
                  onError(String(error));
                }
              }}
            />
          </label>
          <div className="pd-new-actions">
            <button onClick={() => onSeek(shot.start + key.start)}>
              Show camera start
            </button>
            <button
              onClick={() =>
                onSeek(
                  Math.min(
                    shot.start + shot.duration - 1,
                    shot.start + key.start + key.duration,
                  ),
                )
              }
            >
              Show camera end
            </button>
          </div>
        </>
      )}
      <details className="pd-callout">
        <summary>Different angle or perspective</summary>
        <p>
          This set is a flat side view. An overhead, reverse, or three-quarter
          shot needs a matching set view and actor directions. Changing zoom
          cannot reveal the backs of objects.
        </p>
        <button
          onClick={() =>
            onDirection(
              `Plan a three-quarter view for shot "${shot.name}". Keep story and timing. First audit available set views and actor directions. List missing view assets in the proposal name if unavailable; do not fake a new perspective with camera zoom or rotation. If compatible assets exist, stage a separate shot with matching layers, ground anchors and actor directions, then propose its camera framing.`,
            )
          }
        >
          Ask agent to plan another angle
        </button>
        <p className="pd-muted">
          Import the matching set and sprite views in Assets before applying the
          new staging.
        </p>
      </details>
      <hr />
    </section>
  );
}
