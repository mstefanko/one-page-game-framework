import { describe, expect, it } from "vitest";
import { assertScore, createStarter } from "@onepage/project";
import { createGameDraft } from "./game-music";

describe("compose with a game", () => {
  it("creates a valid empty loop with the source cue's tempo and repeat length", () => {
    const source = createStarter("midnight-delivery");
    const before = structuredClone(source);
    source.loop = { startTick: 960, endTick: 2880 };
    const blank = createGameDraft(source, "Night chase");
    assertScore(blank);
    expect(blank.bpm).toBe(source.bpm);
    expect(blank.lengthTicks).toBe(1920);
    expect(blank.patterns.flatMap((p) => p.notes)).toEqual([]);
    expect(blank.loop).toEqual({ startTick: 0, endTick: 1920 });
    expect(blank.patterns[0]!.lengthTicks).toBe(1920);
    expect(source.patterns).toEqual(before.patterns);
    blank.scale.root = 7;
    expect(source.scale.root).toBe(before.scale.root);
  });
});
