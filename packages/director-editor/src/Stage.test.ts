import { describe, it, expect } from "vitest";
import { createDemoScene, evaluateScene } from "@onepage/director-core";
import {
  stageToWorld,
  worldToStage,
  stageTarget,
  hitActor,
  actorBounds,
} from "./Stage";
describe("stage direct manipulation", () => {
  it("inverts CSS scaling, pan and zoom without positional drift", () => {
    const size = { width: 256, height: 176 },
      camera = { x: 148, y: 88, zoom: 1.12 },
      bounds = { left: 200, top: 100, width: 768, height: 528 },
      point = { x: 172, y: 130 },
      screen = worldToStage(point, size, camera),
      client = { x: bounds.left + screen.x * 3, y: bounds.top + screen.y * 3 };
    expect(stageToWorld(client, bounds, size, camera)).toEqual(point);
  });
  it("maps selected motion to explicit from/to handles independently of playhead", () => {
    const scene = createDemoScene(),
      motion = scene.motions[0];
    expect(stageTarget(scene, 900, motion.id, "Starting pose")).toMatchObject({
      id: motion.id,
      actorId: motion.actorId,
      point: motion.from,
    });
    expect(stageTarget(scene, 0, motion.id, "Action endpoint")?.point).toEqual(
      motion.to,
    );
    expect(
      stageTarget(scene, 0, "not-an-object", "Starting pose"),
    ).toBeUndefined();
  });
  it("does not select actors from empty sky; actual sprite bounds and depth resolve hits", () => {
    const frame = evaluateScene(createDemoScene(), 0);
    expect(hitActor(frame.actors, { x: 128, y: 20 })).toBeUndefined();
    const actor = frame.actors[0],
      bounds = actorBounds(actor);
    expect(
      hitActor(frame.actors, {
        x: bounds.left + bounds.width / 2,
        y: bounds.top + bounds.height / 2,
      })?.id,
    ).toBe(actor.id);
    const front = { ...actor, id: "front", y: actor.y + 1 };
    expect(hitActor([actor, front], { x: actor.x, y: actor.y - 10 })?.id).toBe(
      "front",
    );
    expect(
      hitActor([actor, { ...actor, id: "last-painted" }], {
        x: actor.x,
        y: actor.y - 10,
      })?.id,
    ).toBe("last-painted");
  });
  it("uses imported sprite dimensions, logical scale and ground anchor for hit bounds", () => {
    const actor = evaluateScene(createDemoScene(), 0).actors[0];
    actor.scale = 2;
    actor.variant = {
      ...actor.variant!,
      logicalHeight: 16,
      frames: [
        {
          x: 0,
          y: 0,
          width: 20,
          height: 32,
          duration: 6,
          sockets: { ground: { x: 5, y: 30 } },
        },
      ],
    };
    actor.frameIndex = 0;
    expect(actorBounds(actor)).toEqual({
      left: actor.x - 5,
      top: actor.y - 30,
      width: 20,
      height: 32,
    });
  });
});
