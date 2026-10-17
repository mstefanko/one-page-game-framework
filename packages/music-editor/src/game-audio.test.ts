import { describe, it, expect } from "vitest";
import { createBlankScore } from "@onepage/project";
import { captureNote, getPitchForRole } from "./capture";
import {
  createDemoManifest,
  whereUsed,
  pinDraft,
  parseManifest,
  verifyPreviewCommand,
} from "./game-audio";
describe("game audio references and immutable assignment", () => {
  it("derives shared music/SFX where-used and preserves context checkpoints", () => {
    const m = createDemoManifest(createBlankScore());
    expect(whereUsed(m, "cue").map((u) => u.contextId)).toEqual([
      "menu",
      "explore",
      "combat",
    ]);
    expect(whereUsed(m, "arrival")[0]?.contextId).toBe("victory");
    expect(whereUsed(m, "strike")[0]?.contextId).toBe("combat");
    expect(whereUsed(m, "missing")).toEqual([]);
  });
  it("pins independent score snapshots without mutating existing project revision", () => {
    const score = createBlankScore();
    const m = createDemoManifest(score);
    score.title = "Working draft";
    expect(m.assets[0]?.name).not.toBe(score.title);
    const applied = pinDraft(m, "cue", score);
    score.title = "Changed again";
    expect(applied.assets[0]?.revision).toBe(2);
    expect(applied.assets[0]?.name).toBe("Working draft");
    expect(m.assets[0]?.revision).toBe(1);
  });
  it("rejects dangling references and unsafe SFX recipes on import", () => {
    const m = createDemoManifest(createBlankScore());
    expect(parseManifest(JSON.stringify(m))).toEqual(m);
    m.usages[0]!.assetId = "gone";
    expect(() => parseManifest(JSON.stringify(m))).toThrow("reference");
    const other = createDemoManifest(createBlankScore());
    const sfx = other.assets.find((a) => a.kind === "sfx")!;
    if (sfx.kind === "sfx") sfx.duration = Infinity;
    expect(() => parseManifest(JSON.stringify(other))).toThrow("SFX");
  });
  it("checks session and command-specific capability payloads", () => {
    expect(
      verifyPreviewCommand(
        { version: 1, session: "s", type: "loadContext", contextId: "combat" },
        "s",
      ),
    ).toBe(true);
    expect(
      verifyPreviewCommand(
        { version: 1, session: "wrong", type: "pause" },
        "s",
      ),
    ).toBe(false);
    expect(
      verifyPreviewCommand(
        { version: 1, session: "s", type: "requestEnergy", energy: 4 },
        "s",
      ),
    ).toBe(false);
  });
});
describe("take input mapping", () => {
  it("wraps captured positions and trims the note at the loop boundary", () => {
    expect(
      captureNote({
        id: "a",
        positionTick: 6239,
        loopStartTick: 3120,
        loopEndTick: 6240,
        pitch: 60,
        velocity: 2,
        durationTicks: 180,
      }),
    ).toEqual({
      id: "a",
      startTick: 3119,
      durationTicks: 1,
      pitch: 60,
      velocity: 1,
    });
    expect(
      captureNote({
        id: "b",
        positionTick: 6240,
        loopStartTick: 3120,
        loopEndTick: 6240,
        pitch: 60,
        velocity: 0.7,
        durationTicks: 180,
      }).startTick,
    ).toBe(0);
  });
  it("maps high-to-low pitch with role-specific bass and kit registers", () => {
    const scale = { root: 0, mode: "minor" };
    expect(getPitchForRole("melody", 0, scale)).toBeGreaterThan(
      getPitchForRole("melody", 1, scale),
    );
    expect(getPitchForRole("bass", 0.5, scale)).toBeLessThan(
      getPitchForRole("melody", 0.5, scale),
    );
    expect(getPitchForRole("drums", 1, scale)).toBe(36);
  });
});
