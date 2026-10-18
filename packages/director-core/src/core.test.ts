import { describe, it, expect } from "vitest";
import {
  createDemoScene,
  validateScene,
  evaluateScene,
  applyCommands,
  createCandidate,
  mergeCandidate,
  planWeatherChange,
  planStyleChange,
  styleCoverage,
  effectiveCoverage,
} from "./index";
import type { SceneCommand } from "./types";
const set = (
  target: SceneCommand["target"],
  property: string,
  value: unknown,
  targetId?: string,
): SceneCommand => ({ type: "set", target, targetId, property, value });
function timingFixture() {
  const s = createDemoScene();
  s.dialogue[0] = {
    ...s.dialogue[0],
    id: "line-arrival",
    shotId: "arrival-wide",
    start: 210,
    duration: 90,
  };
  return s;
}
describe("director canonical core", () => {
  it("ships an original valid fixture and honest style coverage", () => {
    const s = createDemoScene();
    expect(validateScene(s)).toEqual([]);
    expect(styleCoverage(s, "8-bit").every((x) => x.ready)).toBe(true);
    expect(
      styleCoverage(s, "realistic")
        .filter((x) => !x.ready)
        .map((x) => x.familyId),
    ).toEqual(["lantern:keeper", "lantern:foreground"]);
  });
  it("evaluates random/backwards seeks without mutating input", () => {
    const s = createDemoScene(),
      before = JSON.stringify(s),
      a = evaluateScene(s, 140);
    evaluateScene(s, 700);
    expect(evaluateScene(s, 140)).toEqual(a);
    expect(a.actors[0].x).toBeGreaterThan(40);
    expect(a.actors[0].action).toBe("walk");
    expect(evaluateScene(s, 300).actors[0].x).toBe(132);
    expect(JSON.stringify(s)).toBe(before);
    expect(evaluateScene(s, 779).gate).toBe("line-keeper");
  });
  it("keeps story and staging when changing appearance/weather", () => {
    const s = createDemoScene();
    const n = applyCommands(s, [
      ...planStyleChange(s, "16-bit"),
      ...planWeatherChange(s, "storm", "arrival-wide"),
    ]);
    for (const k of ["actors", "motions", "dialogue", "camera"] as const)
      expect(n[k]).toEqual(s[k]);
    expect(evaluateScene(n, 1).environment.weather).toBe("storm");
    expect(evaluateScene(n, 361).environment.weather).toBe("rain");
  });
  it("enforces locks through shot overrides and array replacement", () => {
    const s = createDemoScene();
    expect(() =>
      applyCommands(s, [
        set("environment", "timeOfDay", "day", "arrival-wide"),
      ]),
    ).toThrow("Protected");
    s.locks.push({
      id: "position",
      target: "actor",
      targetId: "courier",
      property: "x",
      label: "Position",
    });
    const actors = structuredClone(s.actors);
    actors[0].x = 99;
    expect(() => applyCommands(s, [set("scene", "actors", actors)])).toThrow(
      "Protected",
    );
    expect(() => applyCommands(s, [set("scene", "actors", [])])).toThrow();
  });
  it("blocks effective appearance and linked timing edits", () => {
    const s = timingFixture();
    s.locks.push({
      id: "look",
      target: "actor",
      targetId: "courier",
      property: "appearance",
      label: "Courier look",
    });
    expect(() => applyCommands(s, planStyleChange(s, "16-bit"))).toThrow(
      "Protected",
    );
    s.motions[0].endLink = "line-arrival";
    s.locks.push({
      id: "timing",
      target: "motion",
      targetId: s.motions[0].id,
      property: "duration",
      label: "Walk timing",
    });
    expect(() =>
      applyCommands(s, [set("dialogue", "start", 230, "line-arrival")]),
    ).toThrow("Protected");
  });
  it("merges unrelated human work and candidates atomically", () => {
    const s = createDemoScene();
    const c = createCandidate(
      s,
      planWeatherChange(s, "storm"),
      "Storm",
      "agent",
    );
    const current = applyCommands(s, [set("environment", "lantern", 0.3)]);
    const result = mergeCandidate(current, c);
    expect(result.conflicts).toEqual([]);
    expect(result.scene.environment.lantern).toBe(0.3);
    expect(result.scene.environment.weather).toBe("storm");
    expect(c.base).toEqual(s);
  });
  it("requires explicit conflict resolution without partial writes", () => {
    const s = createDemoScene(),
      c = createCandidate(
        s,
        [set("environment", "lantern", 0.1), set("scene", "title", "Changed")],
        "Dim",
      );
    const current = applyCommands(s, [set("environment", "lantern", 0.5)]);
    const result = mergeCandidate(current, c);
    expect(result.scene).toBe(current);
    expect(result.applied).toEqual([]);
    const kept = mergeCandidate(current, c, {
      [result.conflicts[0].key]: "current",
    });
    expect(kept.scene.environment.lantern).toBe(0.5);
    expect(kept.scene.title).toBe("Changed");
  });
  it("rejects unknown writes, references, nonfinite values and invalid linked timing", () => {
    const s = createDemoScene();
    expect(() => applyCommands(s, [set("scene", "locks", [])])).toThrow(
      "Unsupported",
    );
    expect(() =>
      applyCommands(s, [set("actor", "familyId", "missing", "courier")]),
    ).toThrow();
    expect(() =>
      applyCommands(s, [set("environment", "wetness", 2)]),
    ).toThrow();
    expect(() =>
      applyCommands(s, [
        set("motion", "endLink", "missing", "courier-arrives"),
      ]),
    ).toThrow();
    expect(
      validateScene({ ...s, fps: 30 as 60 }).some((d) => d.code === "schema"),
    ).toBe(true);
  });
});

describe("portable assets and effective editing boundaries", () => {
  it("supports scene additions under an inherited night lock and prevents shot replacement bypass", () => {
    const s = createDemoScene();
    const shots = [
      ...s.shots,
      { id: "departure", name: "Departure", start: 1080, duration: 180 },
    ];
    const next = applyCommands(s, [set("scene", "shots", shots)]);
    expect(next.shots).toHaveLength(4);
    shots[0] = { ...shots[0], environment: { timeOfDay: "day" } };
    expect(() => applyCommands(s, [set("scene", "shots", shots)])).toThrow(
      "Protected",
    );
  });
  it("preserves wildcard environment and inherited shot weather locks", () => {
    const s = createDemoScene();
    s.locks.push({
      id: "weather",
      target: "environment",
      targetId: "arrival-wide",
      property: "weather",
      label: "Shot weather",
    });
    expect(() => applyCommands(s, planWeatherChange(s, "storm"))).toThrow(
      "Protected",
    );
    s.locks = [
      {
        id: "all-env",
        target: "environment",
        property: "*",
        label: "All environment",
      },
    ];
    expect(() =>
      applyCommands(s, [
        set("shot", "environment", { lantern: 0 }, "arrival-wide"),
      ]),
    ).toThrow("Protected");
  });
  it("prevents target deletion even when all references are replaced atomically", () => {
    const s = createDemoScene();
    s.locks.push({
      id: "actor",
      target: "actor",
      targetId: "courier",
      property: "*",
      label: "Courier",
    });
    expect(() =>
      applyCommands(s, [
        set(
          "scene",
          "actors",
          s.actors.filter((a) => a.id !== "courier"),
        ),
        set(
          "scene",
          "motions",
          s.motions.filter((m) => m.actorId !== "courier"),
        ),
        set(
          "scene",
          "dialogue",
          s.dialogue.filter((l) => l.actorId !== "courier"),
        ),
      ]),
    ).toThrow("Protected");
  });
  it("validates malformed imported assets and duplicate identities without throwing", () => {
    for (const mutate of [
      (s: ReturnType<typeof createDemoScene>) => {
        s.assets[0].variants[0].frames = null as never;
      },
      (s: ReturnType<typeof createDemoScene>) => {
        s.assets[0].variants[1].id = s.assets[0].variants[0].id;
      },
      (s: ReturnType<typeof createDemoScene>) => {
        s.assets[0].variants[0].sockets.ground.x = NaN;
      },
      (s: ReturnType<typeof createDemoScene>) => {
        s.assets[0].variants[0].frames[0].x = -1;
      },
      (s: ReturnType<typeof createDemoScene>) => {
        s.camera[0].zoom = 0;
      },
    ]) {
      const s = createDemoScene();
      mutate(s);
      expect(validateScene(s).some((d) => d.severity === "error")).toBe(true);
    }
  });
  it("uses variable frame ticks and handles nonloop endpoints deterministically", () => {
    const s = createDemoScene();
    const variant = s.assets[0].variants.find((v) => v.style === s.style)!;
    variant.frames[0].duration = 3;
    variant.frames[1].duration = 9;
    variant.clips.find((c) => c.name === "walk")!.frames = [0, 1];
    expect(evaluateScene(s, 2).actors[0].frameIndex).toBe(0);
    expect(evaluateScene(s, 3).actors[0].frameIndex).toBe(1);
    expect(evaluateScene(s, 12).actors[0].frameIndex).toBe(0);
    variant.clips.find((c) => c.name === "walk")!.loop = false;
    expect(evaluateScene(s, 80).actors[0].frameIndex).toBe(1);
  });
  it("retimes linked motion atomically while preserving dialogue duration and reading gate", () => {
    const s = timingFixture();
    s.motions[0].endLink = "line-arrival";
    const next = applyCommands(s, [
      set("dialogue", "start", 200, "line-arrival"),
    ]);
    expect(next.motions[0].duration).toBe(200);
    expect(next.dialogue[0].duration).toBe(90);
    expect(evaluateScene(next, 199).actors[0].action).toBe("walk");
    expect(evaluateScene(next, 200).actors[0].action).toBe("idle");
    expect(next.revision).toBe(s.revision + 1);
  });
  it("preserves main draft when a candidate group becomes invalid against concurrent work", () => {
    const s = timingFixture();
    s.dialogue[0].start = 260;
    const candidate = createCandidate(
      s,
      [
        set("dialogue", "duration", 100, "line-arrival"),
        set("scene", "title", "Longer line"),
      ],
      "Longer",
    );
    const current = applyCommands(s, [
      set("dialogue", "start", 270, "line-arrival"),
    ]);
    const result = mergeCandidate(current, candidate);
    expect(result.scene).toBe(current);
    expect(result.applied).toEqual([]);
    expect(result.diagnostics.some((d) => d.code === "merge-invalid")).toBe(
      true,
    );
  });
});

describe("effective instance bindings", () => {
  it("preserves a pinned actor while switching scene style and validates portable mixed variants", async () => {
    const s = createDemoScene();
    s.actors[0].variantId = "lantern:courier:8-bit";
    const next = applyCommands(s, planStyleChange(s, "16-bit"));
    expect(next.actors[0].variantId).toBe("lantern:courier:8-bit");
    expect(effectiveCoverage(next).every((c) => c.ready)).toBe(true);
    expect(
      effectiveCoverage(next).find((c) => c.familyId === "lantern:courier")
        ?.variantId,
    ).toBe("lantern:courier:8-bit");
    const { exportScenePack, importScenePack } = await import(
      "../../director-io/src/index"
    );
    const portable = importScenePack(exportScenePack(next));
    expect(effectiveCoverage(portable).every((c) => c.ready)).toBe(true);
    expect(portable.actors[0].variantId).toBe("lantern:courier:8-bit");
  });
  it("checks the pinned variant clips, speech sockets, and referenced media", () => {
    const s = createDemoScene();
    s.actors[1].variantId = "lantern:keeper:8-bit";
    const variant = s.assets[1].variants.find(
      (v) => v.id === s.actors[1].variantId,
    )!;
    variant.clips = variant.clips.filter((c) => c.name !== "walk");
    delete variant.sockets.speech;
    variant.mediaId = "missing";
    const missing = effectiveCoverage(s).find(
      (c) => c.familyId === "lantern:keeper",
    )!.missing;
    expect(missing).toContain("walk clip");
    expect(missing).toContain("speech socket");
    expect(missing).toContain("appearance media");
  });
  it("refuses a candidate from another scene even when property values coincide", () => {
    const s = createDemoScene();
    const candidate = createCandidate(
      s,
      [set("scene", "title", "Changed")],
      "Change",
    );
    const current = { ...s, id: "other-scene" };
    const result = mergeCandidate(current, candidate);
    expect(result.scene).toBe(current);
    expect(result.applied).toEqual([]);
    expect(result.diagnostics[0].code).toBe("scene-mismatch");
  });
});

it("requires output layer artwork even when editor visibility is disabled", () => {
  const s = createDemoScene();
  s.style = "realistic";
  s.layers.find((l) => l.id === "foreground")!.visible = false;
  expect(
    effectiveCoverage(s).find((c) => c.familyId === "lantern:foreground")
      ?.ready,
  ).toBe(false);
  expect(
    styleCoverage(s, "realistic").find(
      (c) => c.familyId === "lantern:foreground",
    )?.ready,
  ).toBe(false);
});
