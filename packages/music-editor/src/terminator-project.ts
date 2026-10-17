import { assertScore, type Score } from "@onepage/project";
import { validPreviewCatalog, type PreviewCatalog } from "./preview-bridge";

export interface TerminatorProject {
  schemaVersion: 1;
  sourceSha256: string;
  catalog: PreviewCatalog;
  scores: Record<string, Score>;
}
export const TERMINATOR_CONTEXTS = [
  { id: "title", name: "Title", kind: "menu", cue: "title" },
  { id: "select", name: "Choose character", kind: "menu", cue: "title" },
  { id: "map", name: "Campaign map", kind: "menu", cue: "map" },
  { id: "shop", name: "Upgrade shop", kind: "menu", cue: "shop" },
  ...[
    "Galleria 1",
    "Galleria 2",
    "Galleria 3",
    "Storm drain",
    "Pescadero 1",
    "Pescadero 2",
    "Pescadero 3",
    "Steel mill",
  ].flatMap((name, i) => {
    const cue = [
      "sale",
      "sale",
      "after",
      "chase",
      "ward",
      "ward",
      "ward",
      "meltdown",
    ][i]!;
    return [
      {
        id: `stage-${i}-intro`,
        name: `${name} · briefing`,
        kind: "level",
        cue: i === 3 || i === 7 ? "boss_sting" : cue,
      },
      { id: `stage-${i}`, name, kind: "level", cue: `play_${cue}` },
    ];
  }),
  ...["galleriaIn", "drainIn", "drainOut", "millIn", "farewell"].map((id) => ({
    id: `cut-${id}`,
    name: (
      {
        galleriaIn: "Galleria prologue",
        drainIn: "Storm drain arrival",
        drainOut: "Storm drain escape",
        millIn: "Steel mill arrival",
        farewell: "Farewell",
      } as Record<string, string>
    )[id]!,
    kind: "cutscene",
    cue: id === "farewell" ? "ending" : `cut_${id}`,
  })),
  { id: "ending", name: "No fate · ending", kind: "cutscene", cue: "ending" },
  { id: "win", name: "Round won", kind: "menu", cue: "win" },
  { id: "death", name: "Terminated", kind: "cutscene", cue: "death" },
];

/** Original phrase timing, pitch and layer thresholds; timbre is a supported-synth approximation. */
export function importTerminatorTrack(
  id: string,
  track: {
    bpm: number;
    loop: boolean;
    loopFrom?: number;
    phrases: {
      beats: number;
      events: {
        at: number;
        voice: string;
        note: string | null;
        dur: number;
        vel: number;
        pan: number;
        heat: number;
      }[];
    }[];
  },
): Score {
  const beats = track.phrases.reduce((n, p) => n + p.beats, 0),
    lengthTicks = Math.round(beats * 480);
  const score: Score = {
    schemaVersion: 1,
    id: `terminator-${id}`,
    title: id.replaceAll("_", " "),
    ppq: 480,
    bpm: track.bpm,
    meter: [6, 4],
    scale: { root: 2, mode: "minor" },
    playback: track.loop ? "loop" : "one-shot",
    lengthTicks,
    loop: track.loop
      ? {
          startTick: Math.round(
            track.phrases
              .slice(0, track.loopFrom ?? 0)
              .reduce((n, p) => n + p.beats, 0) * 480,
          ),
          endTick: lengthTicks,
        }
      : null,
    tracks: [],
    patterns: [],
    clips: [],
    sections: [],
    patches: [],
  };
  const groups = new Map<
    string,
    {
      voice: string;
      heat: number;
      pan: number;
      notes: Score["patterns"][number]["notes"];
    }
  >();
  let offset = 0,
    counter = 0;
  for (const phrase of track.phrases) {
    score.sections.push({
      id: `phrase-${score.sections.length}`,
      name: `Phrase ${score.sections.length + 1}`,
      startTick: Math.round(offset * 480),
      lengthTicks: Math.round(phrase.beats * 480),
    });
    for (const e of phrase.events) {
      const key = `${e.voice}-${e.heat}-${e.pan}`;
      if (!groups.has(key))
        groups.set(key, {
          voice: e.voice,
          heat: e.heat,
          pan: e.pan,
          notes: [],
        });
      const match = e.note && /^([A-G])(#?)(\d)$/.exec(e.note);
      const pitch = match
        ? (Number(match[3]) + 1) * 12 +
          { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[match[1] as "C"] +
          (match[2] ? 1 : 0)
        : e.voice === "drum"
          ? 36
          : e.voice === "snare"
            ? 38
            : 46;
      const startTick = Math.round((offset + e.at) * 480);
      groups
        .get(key)!
        .notes.push({
          id: `note-${counter++}`,
          startTick,
          durationTicks: Math.max(
            1,
            Math.min(lengthTicks - startTick, Math.round(e.dur * 480)),
          ),
          pitch,
          velocity: Math.min(1, e.vel),
        });
    }
    offset += phrase.beats;
  }
  // Native arrangements use many stereo positions. Merge pan variants if necessary to retain the public 32-track budget.
  for (const [key, g] of groups) {
    const percussion = ["drum", "snare", "metal"].includes(g.voice),
      patchId = `voice-${g.voice}`;
    if (!score.patches.some((p) => p.id === patchId))
      score.patches.push({
        id: patchId,
        name: g.voice,
        waveform: percussion
          ? "noise"
          : g.voice === "bass"
            ? "triangle"
            : g.voice === "glass"
              ? "sine"
              : "sawtooth",
        attack: g.voice === "strings" ? 0.38 : 0.01,
        release: percussion ? 0.1 : 0.3,
        brightness: percussion ? 0.7 : 0.35,
        duty: 0.5,
      });
    let target = score.tracks.find((t) => t.id === `${g.voice}-${g.heat}`);
    if (!target) {
      target = {
        id: `${g.voice}-${g.heat}`,
        name: `${g.voice} · layer ${g.heat}`,
        role: percussion
          ? "drums"
          : g.voice === "bass"
            ? "bass"
            : g.voice === "strings"
              ? "harmony"
              : "melody",
        patchId,
        gain: 0.65,
        pan: g.pan,
        minEnergy: Math.max(1, Math.min(3, g.heat)),
      };
      score.tracks.push(target);
      score.patterns.push({
        id: target.id,
        name: target.name,
        lengthTicks,
        notes: [],
      });
      score.clips.push({
        id: target.id,
        trackId: target.id,
        patternId: target.id,
        startTick: 0,
        repeats: 1,
        transpose: 0,
      });
    }
    score.patterns.find((p) => p.id === target.id)!.notes.push(...g.notes);
  }
  assertScore(score);
  return score;
}
export function parseTerminatorProject(
  value: unknown,
  partialScores = false,
): TerminatorProject {
  const project = value as TerminatorProject;
  if (
    project?.schemaVersion !== 1 ||
    !/^[a-f0-9]{64}$/.test(project.sourceSha256) ||
    !validPreviewCatalog(project.catalog) ||
    project.catalog.projectId !== "terminator-liquid-metal" ||
    !project.scores ||
    typeof project.scores !== "object" ||
    Array.isArray(project.scores) ||
    Object.keys(project.scores).length > 64
  )
    throw new Error("Invalid Terminator project import");
  const musicIds = project.catalog.assets
    .filter((a) => a.kind === "music")
    .map((a) => a.id);
  if (
    !partialScores &&
    musicIds.some((id) => !Object.hasOwn(project.scores, id))
  )
    throw new Error("Missing imported music score");
  for (const [id, score] of Object.entries(project.scores)) {
    if (!musicIds.includes(id))
      throw new Error("Unknown music assignment asset");
    assertScore(score);
  }
  return structuredClone(project);
}
