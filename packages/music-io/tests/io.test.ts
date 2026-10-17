import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { writeMidi, type MidiEvent } from "midi-file";
import { compileScore } from "@onepage/music-core";
import { createStarter } from "@onepage/project";
import {
  exportSourcePack,
  importSourcePack,
  exportLibraryPack,
  importLibraryPack,
} from "../src/packs";
import { exportMidi, inspectMidi, convertMidi } from "../src/midi";
import { createPlayerHtml } from "../src/index";

function midi(events: MidiEvent[], ppq = 480, tracks: MidiEvent[][] = []) {
  return new Uint8Array(
    writeMidi({
      header: { format: 1, numTracks: tracks.length + 1, ticksPerBeat: ppq },
      tracks: [events, ...tracks],
    }),
  );
}
const end: MidiEvent = { deltaTime: 0, type: "endOfTrack", meta: true };
const notes = (duration = 480): MidiEvent[] => [
  { deltaTime: 0, type: "noteOn", channel: 0, noteNumber: 60, velocity: 100 },
  {
    deltaTime: duration,
    type: "noteOff",
    channel: 0,
    noteNumber: 60,
    velocity: 0,
  },
  end,
];
const tempo = (deltaTime = 0, microsecondsPerBeat = 500000): MidiEvent => ({
  deltaTime,
  type: "setTempo",
  microsecondsPerBeat,
  meta: true,
});

describe("portable source packs", () => {
  it("roundtrips score data with a SHA-256 payload manifest", () => {
    const score = createStarter();
    const bytes = exportSourcePack(score);
    expect(importSourcePack(bytes)).toEqual(score);
    const files = unzipSync(bytes);
    const manifest = JSON.parse(strFromU8(files["manifest.json"]));
    expect(manifest.payload.sha256).toBe(
      createHash("sha256").update(files["payload.json"]).digest("hex"),
    );
  });

  it("roundtrips a library and distinguishes its archive kind", () => {
    const backup = {
      schemaVersion: 1,
      drafts: [{ score: createStarter(), revision: 2, updatedAt: 1 }],
      versions: [],
    };
    const bytes = exportLibraryPack(backup);
    expect(importLibraryPack(bytes)).toEqual(backup);
    expect(() => importSourcePack(bytes)).toThrow("manifest");
    expect(() =>
      exportLibraryPack({
        ...backup,
        drafts: [...backup.drafts, ...backup.drafts],
      }),
    ).toThrow("Duplicate");
  });

  it("rejects corruption, unsupported schemas and checksum mismatches", () => {
    const files = unzipSync(exportSourcePack(createStarter()));
    const payload = JSON.parse(strFromU8(files["payload.json"]));
    payload.title = "Tampered";
    expect(() =>
      importSourcePack(
        zipSync({ ...files, "payload.json": strToU8(JSON.stringify(payload)) }),
      ),
    ).toThrow("hash");
    const manifest = JSON.parse(strFromU8(files["manifest.json"]));
    manifest.schemaVersion = 99;
    expect(() =>
      importSourcePack(
        zipSync({
          ...files,
          "manifest.json": strToU8(JSON.stringify(manifest)),
        }),
      ),
    ).toThrow("manifest");
    const truncated = exportSourcePack(createStarter()).slice(0, -5);
    expect(() => importSourcePack(truncated)).toThrow();
  });

  it("rejects unsafe paths, duplicate names, excessive entries and oversized decompression declarations", () => {
    expect(() =>
      importSourcePack(
        zipSync({
          "../evil.json": strToU8("{}"),
          "manifest.json": strToU8("{}"),
        }),
      ),
    ).toThrow("path");
    const bytes = zipSync({
      "payload.json": strToU8("{}"),
      "payloae.json": strToU8("{}"),
    });
    const oldName = strToU8("payloae.json"),
      newName = strToU8("payload.json");
    for (let i = 0; i <= bytes.length - oldName.length; i++)
      if (oldName.every((byte, n) => bytes[i + n] === byte))
        bytes.set(newName, i);
    expect(() => importSourcePack(bytes)).toThrow("duplicate");
    expect(() =>
      importSourcePack(
        zipSync({
          a: new Uint8Array(),
          b: new Uint8Array(),
          c: new Uint8Array(),
        }),
      ),
    ).toThrow("count");
    const huge = exportSourcePack(createStarter());
    const view = new DataView(huge.buffer);
    for (let i = 0; i < huge.length - 46; i++)
      if (view.getUint32(i, true) === 0x02014b50) {
        view.setUint32(i + 24, 100000000, true);
        break;
      }
    expect(() => importSourcePack(huge)).toThrow("limit");
  });

  it("bounds actual decompression when ZIP size declarations are forged", () => {
    const bomb = zipSync({
      "manifest.json": strToU8("{}"),
      "payload.json": new Uint8Array(2 * 1024 * 1024),
    });
    const view = new DataView(bomb.buffer);
    for (let i = 0; i < bomb.length - 46; i++) {
      if (view.getUint32(i, true) !== 0x02014b50) continue;
      const nameLength = view.getUint16(i + 28, true);
      if (
        strFromU8(bomb.subarray(i + 46, i + 46 + nameLength)) !== "payload.json"
      )
        continue;
      view.setUint32(i + 24, 8, true);
      view.setUint32(view.getUint32(i + 42, true) + 22, 8, true);
    }
    expect(() => importSourcePack(bomb)).toThrow("decompression limit");
  });
});

describe("explicit MIDI conversion", () => {
  it("preserves supported note timing, pitches and quantized velocities on export/import", () => {
    const original = createStarter("clockwork-steps");
    const review = inspectMidi(exportMidi(original));
    expect(review.blocking).toEqual([]);
    expect(review.tracks).toHaveLength(original.tracks.length);
    expect(() => convertMidi(review, { acceptLosses: false })).toThrow(
      "accept",
    );
    const imported = convertMidi(review, { acceptLosses: true });
    const trace = (score: typeof original) =>
      compileScore(score)
        .map((note) => ({
          start: note.startTick,
          length: note.durationTicks,
          pitch: note.pitch,
          velocity: Math.round(note.velocity * 127),
        }))
        .sort(
          (a, b) =>
            a.start - b.start || a.pitch - b.pitch || a.length - b.length,
        );
    expect(trace(imported)).toEqual(trace(original));
    expect(imported.lengthTicks).toBe(3120);
  });

  it.each([96, 192, 480, 960])(
    "converts representable %i PPQ files exactly",
    (ppq) => {
      const review = inspectMidi(midi(notes(ppq), ppq));
      expect(review.blocking).toEqual([]);
      expect(
        convertMidi(review, { acceptLosses: true }).patterns[0].notes[0]
          .durationTicks,
      ).toBe(480);
    },
  );

  it.each([
    [
      { deltaTime: 0, type: "pitchBend", channel: 0, value: 100 } as MidiEvent,
      "Pitch bend",
    ],
    [
      {
        deltaTime: 0,
        type: "controller",
        channel: 0,
        controllerType: 64,
        value: 127,
      } as MidiEvent,
      "Sustain",
    ],
    [
      {
        deltaTime: 0,
        type: "controller",
        channel: 0,
        controllerType: 7,
        value: 80,
      } as MidiEvent,
      "controller 7",
    ],
    [
      { deltaTime: 0, type: "sysEx", data: [1, 2, 3] } as MidiEvent,
      "exclusive",
    ],
  ])("declines unsupported expression %j", (event, expected) => {
    const review = inspectMidi(midi([event, ...notes()]));
    expect(review.blocking.join(" ")).toContain(expected);
    review.blocking = [];
    review.warnings = [];
    expect(() => convertMidi(review, { acceptLosses: true })).toThrow(
      "declined",
    );
  });

  it("declines tempo changes, meter changes, unrepresentable ticks and malformed files", () => {
    expect(
      inspectMidi(
        midi([tempo(), tempo(480, 600000), ...notes()]),
      ).blocking.join(" "),
    ).toContain("Tempo");
    expect(
      inspectMidi(
        midi([
          {
            deltaTime: 480,
            type: "timeSignature",
            meta: true,
            numerator: 3,
            denominator: 4,
            metronome: 24,
            thirtyseconds: 8,
          },
          ...notes(),
        ]),
      ).blocking.join(" "),
    ).toContain("Meter");
    expect(inspectMidi(midi(notes(1), 192)).blocking.join(" ")).toContain(
      "480 PPQ",
    );
    expect(inspectMidi(new Uint8Array([1, 2, 3])).blocking).not.toHaveLength(0);
    expect(inspectMidi(midi(notes()).slice(0, -2)).blocking).not.toHaveLength(
      0,
    );
  });

  it("declines unmatched/ambiguous notes and excess parts", () => {
    expect(inspectMidi(midi([notes()[0], end])).blocking.join(" ")).toContain(
      "matching release",
    );
    expect(
      inspectMidi(
        midi([notes()[0], notes()[0], ...notes().slice(1)]),
      ).blocking.join(" "),
    ).toContain("Overlapping");
    const tracks = Array.from({ length: 33 }, (_, channel) =>
      notes().map((event) =>
        "channel" in event ? { ...event, channel: channel % 16 } : event,
      ),
    );
    expect(inspectMidi(midi([end], 480, tracks)).blocking.join(" ")).toContain(
      "32-part",
    );
  });

  it("declines excessive simultaneous voices, including release tails", () => {
    const tracks = Array.from({ length: 3 }, (_, channel) => [
      ...Array.from(
        { length: 100 },
        (_, pitch): MidiEvent => ({
          deltaTime: 0,
          type: "noteOn",
          channel,
          noteNumber: pitch,
          velocity: 100,
        }),
      ),
      ...Array.from(
        { length: 100 },
        (_, pitch): MidiEvent => ({
          deltaTime: pitch === 0 ? 480 : 0,
          type: "noteOff",
          channel,
          noteNumber: pitch,
          velocity: 0,
        }),
      ),
      end,
    ]);
    expect(inspectMidi(midi([end], 480, tracks)).blocking.join(" ")).toContain(
      "256 simultaneous",
    );
  });

  it("declines exporting ambiguous overlapping repetitions of one pitch", () => {
    const score = createStarter();
    const original = score.patterns[0].notes[0];
    score.patterns[0].notes.push({
      ...original,
      id: "overlapping-copy",
      startTick: original.startTick + 1,
    });
    expect(() => exportMidi(score)).toThrow("overlapping repetitions");
  });
});

describe("standalone shared player", () => {
  it("embeds inert escaped data and the shared engine with no external scripts", async () => {
    const score = createStarter();
    score.title = "</script><img src=x onerror=alert(1)> & title";
    const html = await createPlayerHtml(score);
    expect(html).not.toContain(score.title);
    const data = html.match(
      /<script id="song-data" type="application\/json">(.*?)<\/script>/s,
    )![1];
    expect(JSON.parse(data)).toEqual(score);
    expect(html).not.toMatch(/<script[^>]+src=/);
    expect(html).toContain("connect-src 'none'");
    expect(html).toContain("AudioContext");
    expect(html).not.toContain("fake-indexeddb");
  });
});
