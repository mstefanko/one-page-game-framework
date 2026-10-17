import { assertScore, PPQ, type Score } from "@onepage/project";
export {
  createArcadePhrase,
  type ArcadeAction,
  type ArcadePhrase,
  type ArcadePhraseOptions,
} from "./arcade";
export interface CompiledNote {
  id: string;
  trackId: string;
  patchId: string;
  startTick: number;
  durationTicks: number;
  pitch: number;
  velocity: number;
  gain: number;
  pan: number;
}
function finiteNonnegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0)
    throw new RangeError(`${name} must be finite and nonnegative`);
}
export function ticksToSeconds(ticks: number, bpm: number): number {
  finiteNonnegative(ticks, "ticks");
  if (!Number.isFinite(bpm) || bpm <= 0)
    throw new RangeError("bpm must be positive");
  return (ticks * 60) / (PPQ * bpm);
}
/** Tick conversion preserves fractional positions; quantization is an explicit editor operation. */
export function secondsToTicks(seconds: number, bpm: number): number {
  finiteNonnegative(seconds, "seconds");
  if (!Number.isFinite(bpm) || bpm <= 0)
    throw new RangeError("bpm must be positive");
  return (seconds * PPQ * bpm) / 60;
}
/** Window is half-open. Overlapping notes are trimmed at both edges, retaining absolute score time. */
export function compileScore(
  score: Score,
  options: { startTick?: number; endTick?: number; energy?: number } = {},
): CompiledNote[] {
  assertScore(score);
  const start = options.startTick ?? 0,
    end = options.endTick ?? score.lengthTicks,
    energy = options.energy ?? 3;
  finiteNonnegative(start, "startTick");
  finiteNonnegative(end, "endTick");
  if (
    end < start ||
    end > score.lengthTicks ||
    !Number.isFinite(energy) ||
    energy < 1 ||
    energy > 3
  )
    throw new RangeError("Invalid compilation window or energy");
  const tracks = new Map(score.tracks.map((t) => [t.id, t]));
  const patterns = new Map(score.patterns.map((p) => [p.id, p]));
  const result: CompiledNote[] = [];
  for (const clip of score.clips) {
    const track = tracks.get(clip.trackId)!,
      pattern = patterns.get(clip.patternId)!;
    if (track.minEnergy > energy) continue;
    for (let repeat = 0; repeat < clip.repeats; repeat++)
      for (const note of pattern.notes) {
        const rawStart =
          clip.startTick + repeat * pattern.lengthTicks + note.startTick;
        const on = Math.max(start, rawStart),
          off = Math.min(end, rawStart + note.durationTicks);
        if (off <= on) continue;
        result.push({
          id: `${clip.id}:${repeat}:${note.id}`,
          trackId: track.id,
          patchId: track.patchId,
          startTick: on,
          durationTicks: off - on,
          pitch: note.pitch + clip.transpose,
          velocity: note.velocity,
          gain: track.gain,
          pan: track.pan,
        });
      }
  }
  return result.sort(
    (a, b) =>
      a.startTick - b.startTick ||
      a.trackId.localeCompare(b.trackId) ||
      a.pitch - b.pitch ||
      a.id.localeCompare(b.id),
  );
}
