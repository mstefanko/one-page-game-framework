import { describe, it, expect } from "vitest";
import {
  importTerminatorTrack,
  parseTerminatorProject,
} from "./terminator-project";
import {
  extractTerminator,
  instrumentTerminator,
} from "../../../scripts/import-terminator.mjs";
const native = {
  bpm: 94,
  loop: true,
  loopFrom: 1,
  phrases: [
    {
      beats: 6,
      events: [
        {
          at: 0,
          voice: "brass",
          note: "D4",
          dur: 1,
          vel: 0.8,
          pan: 0,
          heat: 0,
        },
      ],
    },
    {
      beats: 6.5,
      events: [
        {
          at: 0.75,
          voice: "pulse",
          note: "A#2",
          dur: 0.25,
          vel: 0.7,
          pan: -0.2,
          heat: 3,
        },
      ],
    },
  ],
};
const score = importTerminatorTrack("title", native);
const project = () => ({
  schemaVersion: 1,
  sourceSha256: "a".repeat(64),
  catalog: {
    projectId: "terminator-liquid-metal",
    projectName: "Local test game",
    contexts: [{ id: "title", name: "Title", kind: "menu" }],
    assets: [
      { id: "title", name: "Title", kind: "music", revision: "one" },
      { id: "sfx-title", name: "Title hit", kind: "sfx", revision: "one" },
    ],
    usages: [
      {
        id: "enter",
        contextId: "title",
        assetId: "title",
        trigger: "enter",
        checkpoint: "start",
      },
    ],
  },
  scores: { title: score },
});
describe("local Terminator score adapter", () => {
  it("preserves original fractional timing, note pitches, layer threshold and intro loop boundary", () => {
    expect(score.lengthTicks).toBe(6000);
    expect(score.loop).toEqual({ startTick: 2880, endTick: 6000 });
    expect(score.patterns[0]!.notes[0]).toMatchObject({
      pitch: 62,
      startTick: 0,
      durationTicks: 480,
    });
    expect(score.patterns[1]!.notes[0]).toMatchObject({
      pitch: 46,
      startTick: 3240,
      durationTicks: 120,
    });
    expect(score.tracks[1]!.minEnergy).toBe(3);
  });
  it("validates catalogs, missing scores, music assignment identities and canonical score values before rendering", () => {
    expect(parseTerminatorProject(project()).scores.title).toEqual(score);
    expect(() => parseTerminatorProject({ ...project(), scores: {} })).toThrow(
      "Missing",
    );
    expect(
      parseTerminatorProject({ ...project(), scores: {} }, true).scores,
    ).toEqual({});
    expect(() =>
      parseTerminatorProject(
        { ...project(), scores: { "sfx-title": score } },
        true,
      ),
    ).toThrow("Unknown");
    const broken = project();
    broken.catalog.assets[1]!.id = "title";
    expect(() => parseTerminatorProject(broken)).toThrow();
    expect(() =>
      parseTerminatorProject({ ...project(), scores: [] }),
    ).toThrow();
  });
  it("embeds literal replacement tokens and script terminators without reintroducing source or breaking JavaScript", () => {
    const source = "<script>const original=1;</script>";
    const bundle =
      'const replacement="' + "$`" + " $&" + " $" + "'" + ' </script>";';
    const output = instrumentTerminator(source, { text: "<test>" }, bundle);
    expect(output.match(/const original/g)).toHaveLength(1);
    expect(output.match(/<\/script>/g)).toHaveLength(1);
    expect(output).toContain("const replacement=");
  });
  it("rejects unsupported or ambiguous source markers before touching generated output", () => {
    const source = `<script>function scoreEvent(){} const TRACKS={test:{bpm:120,phrases:[]}}; AUDIO.songId=null; function frame(now){} window.AUDIO = AUDIO; const STAGES = []; const CUT_SCENES = {};</script>`;
    expect(JSON.parse(extractTerminator(source))).toHaveProperty(
      "test.bpm",
      120,
    );
    expect(() => extractTerminator(source + "</script>")).toThrow(
      "expected one",
    );
    expect(() => extractTerminator("<html>unsupported</html>")).toThrow(
      "Unsupported",
    );
  });
});
