import { Midi } from "@tonejs/midi";
import { parseMidi, writeMidi, type MidiEvent } from "midi-file";
import { assertScore, createBlankScore, type Score } from "@onepage/project";
import { compileScore } from "@onepage/music-core";

export interface MidiReview {
  tracks: { name: string; noteCount: number; role: string }[];
  warnings: string[];
  blocking: string[];
}
const reviews = new WeakMap<
  MidiReview,
  { score?: Score; warnings: string[]; blocking: string[] }
>();
const unique = (items: string[]) => [...new Set(items)];

function checkFile(bytes: Uint8Array): void {
  if (bytes.length < 14 || bytes.length > 2 * 1024 * 1024)
    throw new Error("MIDI is truncated or exceeds the 2 MiB limit");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0) !== 0x4d546864 || view.getUint32(4) !== 6)
    throw new Error("Invalid MIDI header");
  const count = view.getUint16(10);
  const format = view.getUint16(8);
  if (format > 2 || (format === 0 && count !== 1))
    throw new Error("Invalid MIDI format/track combination");
  if (count < 1 || count > 64)
    throw new Error("MIDI track count exceeds the 64-track input limit");
  let offset = 14,
    eventCount = 0;
  for (let i = 0; i < count; i++) {
    if (offset + 8 > bytes.length || view.getUint32(offset) !== 0x4d54726b)
      throw new Error("Invalid or truncated MIDI track");
    const trackEnd = offset + 8 + view.getUint32(offset + 4);
    if (trackEnd > bytes.length) throw new Error("Truncated MIDI track");
    let cursor = offset + 8,
      running = 0,
      ended = false;
    const variable = () => {
      let value = 0;
      for (let n = 0; n < 4; n++) {
        if (cursor >= trackEnd)
          throw new Error("Truncated MIDI variable-length integer");
        const byte = bytes[cursor++];
        value = value * 128 + (byte & 127);
        if (!(byte & 128)) return value;
      }
      throw new Error("MIDI variable-length integer exceeds four bytes");
    };
    while (cursor < trackEnd) {
      if (++eventCount > 200000)
        throw new Error("MIDI exceeds the 200,000-event input limit");
      variable();
      if (cursor >= trackEnd) throw new Error("Truncated MIDI event");
      let status = bytes[cursor];
      if (status < 128) {
        if (!running) throw new Error("Invalid MIDI running status");
        status = running;
      } else cursor++;
      if (status === 255 || status === 240 || status === 247) {
        running = 0;
        const metaType = status === 255 ? bytes[cursor++] : undefined;
        if (metaType !== undefined && metaType >= 128)
          throw new Error("Invalid MIDI meta-event type");
        const length = variable();
        if (length > 65536 || cursor + length > trackEnd)
          throw new Error(
            "MIDI metadata is truncated or exceeds the 64 KiB event limit",
          );
        cursor += length;
        if (metaType === 47) {
          if (length !== 0 || cursor !== trackEnd)
            throw new Error("Invalid or nonfinal MIDI end-of-track event");
          ended = true;
        }
      } else if (status >= 128 && status < 240) {
        running = status;
        const length = status >> 4 === 12 || status >> 4 === 13 ? 1 : 2;
        if (cursor + length > trackEnd)
          throw new Error("Truncated MIDI channel event");
        for (let n = 0; n < length; n++)
          if (bytes[cursor++] >= 128)
            throw new Error("Invalid MIDI channel data byte");
      } else throw new Error("Unsupported MIDI system status");
    }
    if (!ended) throw new Error("MIDI track has no final end-of-track event");
    offset = trackEnd;
  }
  if (offset !== bytes.length)
    throw new Error("Unexpected data after MIDI tracks");
}

/** Preflights raw SMF events before the ergonomic parser can omit unsupported information. */
export function inspectMidi(bytes: Uint8Array): MidiReview {
  const result: MidiReview = { tracks: [], warnings: [], blocking: [] };
  let score: Score | undefined;
  try {
    checkFile(bytes);
    const raw = parseMidi(bytes);
    const ppq = raw.header.ticksPerBeat;
    if (raw.header.format === 2)
      result.blocking.push(
        "Independent format-2 sequences are unsupported; export a synchronous format-0 or format-1 file.",
      );
    if (!ppq || raw.header.framesPerSecond)
      result.blocking.push(
        "SMPTE timing is unsupported; use musical PPQ timing.",
      );
    const tempos = new Set<number>(),
      meters = new Set<string>();
    let count = 0,
      lastTick = 0;
    for (const track of raw.tracks) {
      let tick = 0;
      const active = new Set<string>();
      const channels = new Set<number>();
      if (!track.length || track[track.length - 1].type !== "endOfTrack")
        result.blocking.push("A MIDI track has no final end-of-track event.");
      for (const event of track) {
        if (++count > 200000)
          throw new Error("MIDI exceeds the 200,000-event input limit");
        if (!Number.isSafeInteger(event.deltaTime) || event.deltaTime < 0)
          throw new Error("Invalid MIDI delta time");
        tick += event.deltaTime;
        lastTick = Math.max(lastTick, tick);
        if (ppq && !Number.isInteger((tick * 480) / ppq))
          result.blocking.push(
            "Some event positions cannot be represented exactly at 480 PPQ; quantize explicitly in the source tool.",
          );
        if ("channel" in event) channels.add(event.channel);
        switch (event.type) {
          case "noteOn":
          case "noteOff": {
            const key = `${event.channel}:${event.noteNumber}`;
            if (
              event.noteNumber < 0 ||
              event.noteNumber > 127 ||
              event.velocity < 0 ||
              event.velocity > 127
            )
              throw new Error("Invalid MIDI note data");
            if (event.type === "noteOn" && event.velocity > 0) {
              if (active.has(key))
                result.blocking.push(
                  "Overlapping repetitions of the same pitch/channel are ambiguous; separate or shorten them before import.",
                );
              active.add(key);
            } else if (!active.delete(key))
              result.blocking.push(
                "A note release has no matching note attack.",
              );
            break;
          }
          case "setTempo":
            tempos.add(event.microsecondsPerBeat);
            if (tick !== 0)
              result.blocking.push(
                "Tempo events after the start are unsupported; this cue uses one constant tempo.",
              );
            break;
          case "timeSignature":
            meters.add(`${event.numerator}/${event.denominator}`);
            if (tick !== 0)
              result.blocking.push(
                "Meter events after the start are unsupported; this cue uses one constant meter.",
              );
            if (
              event.numerator < 1 ||
              event.numerator > 32 ||
              ![1, 2, 4, 8, 16, 32].includes(event.denominator)
            )
              result.blocking.push(
                "This meter is outside the supported score range.",
              );
            break;
          case "controller":
            result.blocking.push(
              event.controllerType === 64
                ? "Sustain pedal is unsupported; bake pedal-held durations into notes before import."
                : `MIDI controller ${event.controllerType} is unsupported; bake or remove this automation before import.`,
            );
            break;
          case "pitchBend":
            result.blocking.push(
              "Pitch bend is unsupported; remove or render bends before import.",
            );
            break;
          case "noteAftertouch":
          case "channelAftertouch":
            result.blocking.push(
              "Aftertouch is unsupported; remove or render its expression before import.",
            );
            break;
          case "sysEx":
          case "endSysEx":
            result.blocking.push("System-exclusive messages are unsupported.");
            break;
          case "programChange":
            result.warnings.push(
              "MIDI programs are approximated by generic chip-inspired patches; original instrument timbre is not preserved.",
            );
            break;
          case "trackName":
          case "instrumentName":
          case "endOfTrack":
            break;
          case "keySignature":
            result.warnings.push(
              "Key-signature metadata is omitted; imported notes remain unchanged and scale guidance defaults to chromatic.",
            );
            break;
          case "text":
          case "copyrightNotice":
          case "lyrics":
          case "marker":
          case "cuePoint":
            result.warnings.push(
              "Text, lyrics, copyright and marker metadata are omitted; retain the original MIDI file and its attribution separately.",
            );
            break;
          default:
            result.blocking.push(`Unsupported MIDI event: ${event.type}.`);
        }
      }
      if (active.size)
        result.blocking.push("Some notes have no matching release.");
      if (channels.size > 1)
        result.warnings.push(
          "Multiple channels in one MIDI track are split into separate parts.",
        );
    }
    if (tempos.size > 1)
      result.blocking.push(
        "Multiple tempos are unsupported; split or flatten the cue in the source tool.",
      );
    if (meters.size > 1)
      result.blocking.push(
        "Multiple meters are unsupported; split the cue in the source tool.",
      );
    if (result.blocking.length)
      throw new Error("Raw MIDI preflight declined conversion");
    const midi = new Midi(bytes);
    const tracks = midi.tracks.filter((track) => track.notes.length);
    if (!tracks.length)
      result.blocking.push("MIDI contains no supported notes.");
    if (tracks.length > 32)
      result.blocking.push("MIDI exceeds the 32-part score limit.");
    const bpm = midi.header.tempos[0]?.bpm ?? 120;
    if (bpm < 20 || bpm > 400 || !Number.isFinite(bpm))
      result.blocking.push("Tempo must be between 20 and 400 BPM.");
    result.warnings.push(
      "Imported MIDI uses generic chip-inspired sounds. Mixer settings, instrument timbre, pattern links, sections, energy layers and loop intent are not recovered.",
    );
    const lengthTicks = Math.max(1, (lastTick * 480) / ppq!);
    if (lengthTicks > 10000000)
      result.blocking.push("MIDI exceeds the score duration limit.");
    score = createBlankScore(midi.name.slice(0, 200) || "Imported MIDI");
    score.id = crypto.randomUUID();
    score.bpm = bpm;
    score.playback = "one-shot";
    score.loop = null;
    score.lengthTicks = lengthTicks;
    const signature = midi.header.timeSignatures[0]?.timeSignature ?? [4, 4];
    score.meter = [signature[0], signature[1] as Score["meter"][1]];
    score.scale = { root: 0, mode: "chromatic" };
    score.tracks = [];
    score.patterns = [];
    score.clips = [];
    score.patches = [];
    const edges: { tick: number; delta: number }[] = [];
    for (const [index, track] of tracks.entries()) {
      const id = `part-${index}`,
        name = track.name.slice(0, 200) || `Part ${index + 1}`;
      const role =
        track.channel === 9
          ? "drums"
          : track.instrument.family === "bass"
            ? "bass"
            : "melody";
      result.tracks.push({ name, noteCount: track.notes.length, role });
      if (track.notes.length > 10000)
        result.blocking.push(
          "A MIDI part exceeds the 10,000-note pattern limit.",
        );
      if (role === "drums")
        result.warnings.push(
          "Channel-10 percussion keeps MIDI pitches but uses a generic noise patch; original kit voices are approximated.",
        );
      score.tracks.push({
        id,
        name,
        role,
        patchId: id,
        gain: role === "drums" ? 0.25 : 0.6,
        pan: 0,
        minEnergy: 1,
      });
      score.patches.push({
        id,
        name:
          role === "drums"
            ? "Generic percussion"
            : role === "bass"
              ? "Generic bass"
              : "Generic pulse",
        waveform:
          role === "drums" ? "noise" : role === "bass" ? "triangle" : "pulse",
        attack: 0.005,
        release: 0.08,
        brightness: 0.55,
        duty: 0.5,
      });
      const notes = track.notes.map((note, n) => {
        const startTick = (note.ticks * 480) / ppq!,
          durationTicks = (note.durationTicks * 480) / ppq!;
        if (
          !Number.isInteger(startTick) ||
          !Number.isInteger(durationTicks) ||
          durationTicks < 1
        )
          result.blocking.push(
            "Some note durations cannot be represented exactly at 480 PPQ.",
          );
        edges.push(
          { tick: startTick, delta: 1 },
          {
            tick: startTick + durationTicks + (0.08 * bpm * 480) / 60,
            delta: -1,
          },
        );
        return {
          id: `${id}-note-${n}`,
          startTick,
          durationTicks,
          pitch: note.midi,
          velocity: note.velocity,
        };
      });
      score.patterns.push({ id, name, lengthTicks, notes });
      score.clips.push({
        id,
        trackId: id,
        patternId: id,
        startTick: 0,
        repeats: 1,
        transpose: 0,
      });
    }
    let voices = 0;
    for (const edge of edges.sort(
      (a, b) => a.tick - b.tick || a.delta - b.delta,
    ))
      if ((voices += edge.delta) > 256) {
        result.blocking.push(
          "MIDI exceeds the shared synth limit of 256 simultaneous voices including release tails.",
        );
        break;
      }
    if (!result.blocking.length) assertScore(score);
  } catch (error) {
    if (!result.blocking.length)
      result.blocking.push(
        error instanceof Error ? error.message : "Malformed MIDI",
      );
    score = undefined;
  }
  result.warnings = unique(result.warnings);
  result.blocking = unique(result.blocking);
  reviews.set(result, {
    score: result.blocking.length ? undefined : score,
    warnings: [...result.warnings],
    blocking: [...result.blocking],
  });
  return result;
}

export function convertMidi(
  review: MidiReview,
  options: { acceptLosses: boolean },
): Score {
  const prepared = reviews.get(review);
  if (!prepared) throw new Error("Inspect this MIDI file before converting it");
  if (prepared.blocking.length || !prepared.score)
    throw new Error(`MIDI conversion declined: ${prepared.blocking.join(" ")}`);
  if (prepared.warnings.length && !options.acceptLosses)
    throw new Error("Review and accept the MIDI conversion losses first");
  return structuredClone(prepared.score);
}

/** Exports expanded notes at 480 PPQ. MIDI does not preserve synth, mixer, patterns or game metadata. */
export function exportMidi(score: Score): Uint8Array {
  assertScore(score);
  if (score.tracks.filter((track) => track.role !== "drums").length > 15)
    throw new Error(
      "MIDI export supports at most 15 melodic parts plus percussion; export separate songs or merge parts explicitly.",
    );
  const conductor: MidiEvent[] = [
    { deltaTime: 0, meta: true, type: "trackName", text: score.title },
    {
      deltaTime: 0,
      meta: true,
      type: "setTempo",
      microsecondsPerBeat: Math.round(60000000 / score.bpm),
    },
    {
      deltaTime: 0,
      meta: true,
      type: "timeSignature",
      numerator: score.meter[0],
      denominator: score.meter[1],
      metronome: 24,
      thirtyseconds: 8,
    },
    { deltaTime: score.lengthTicks, meta: true, type: "endOfTrack" },
  ];
  const expanded = compileScore(score);
  const tracks: MidiEvent[][] = [conductor];
  let melodicChannel = 0;
  const channels = new Map<string, number>();
  for (const track of score.tracks) {
    if (melodicChannel === 9) melodicChannel++;
    channels.set(track.id, track.role === "drums" ? 9 : melodicChannel++);
  }
  const noteEnds = new Map<string, number>();
  for (const note of expanded) {
    if (note.velocity <= 0) continue;
    const key = `${channels.get(note.trackId)}:${note.pitch}`;
    if ((noteEnds.get(key) ?? -1) > note.startTick)
      throw new Error(
        "MIDI cannot preserve overlapping repetitions of the same pitch on one channel; shorten or separate those notes explicitly.",
      );
    noteEnds.set(key, note.startTick + note.durationTicks);
  }
  for (const track of score.tracks) {
    const channel = channels.get(track.id)!;
    const events: { tick: number; event: MidiEvent }[] = [
      {
        tick: 0,
        event: {
          deltaTime: 0,
          meta: true,
          type: "trackName",
          text: track.name,
        },
      },
    ];
    for (const note of expanded.filter((note) => note.trackId === track.id)) {
      if (note.velocity <= 0) continue;
      events.push({
        tick: note.startTick,
        event: {
          deltaTime: 0,
          type: "noteOn",
          channel,
          noteNumber: note.pitch,
          velocity: Math.max(1, Math.round(note.velocity * 127)),
        },
      });
      events.push({
        tick: note.startTick + note.durationTicks,
        event: {
          deltaTime: 0,
          type: "noteOff",
          channel,
          noteNumber: note.pitch,
          velocity: 0,
        },
      });
    }
    events.sort(
      (a, b) =>
        a.tick - b.tick ||
        (a.event.type === "noteOff" ? -1 : 0) -
          (b.event.type === "noteOff" ? -1 : 0),
    );
    events.push({
      tick: score.lengthTicks,
      event: { deltaTime: 0, meta: true, type: "endOfTrack" },
    });
    let previous = 0;
    tracks.push(
      events.map(({ tick, event }) => {
        const deltaTime = tick - previous;
        previous = tick;
        return { ...event, deltaTime };
      }),
    );
  }
  return new Uint8Array(
    writeMidi({
      header: { format: 1, numTracks: tracks.length, ticksPerBeat: 480 },
      tracks,
    }),
  );
}
