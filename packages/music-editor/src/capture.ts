import type { Note } from "@onepage/project";
export function captureNote(input: {
  positionTick: number;
  loopStartTick: number;
  loopEndTick: number;
  pitch: number;
  velocity: number;
  durationTicks: number;
  id?: string;
}): Note {
  const { loopStartTick: start, loopEndTick: end } = input;
  if (
    ![
      input.positionTick,
      start,
      end,
      input.pitch,
      input.velocity,
      input.durationTicks,
    ].every(Number.isFinite) ||
    end <= start ||
    start < 0
  )
    throw new Error("Invalid take position");
  const length = end - start,
    position = (((input.positionTick - start) % length) + length) % length;
  const tick = Math.min(Math.ceil(length) - 1, Math.floor(position));
  return {
    id: input.id ?? crypto.randomUUID(),
    startTick: tick,
    durationTicks: Math.max(
      1,
      Math.min(Math.round(input.durationTicks), Math.ceil(length) - tick),
    ),
    pitch: Math.max(0, Math.min(127, Math.round(input.pitch))),
    velocity: Math.max(0, Math.min(1, input.velocity)),
  };
}
export function getPitchForRole(
  role: string,
  y: number,
  scale: { root: number; mode: string },
): number {
  const unit = Math.max(0, Math.min(0.999999, Number.isFinite(y) ? y : 0.5));
  if (role === "drums") return [46, 42, 38, 36][Math.floor(unit * 4)]!;
  const degrees =
    scale.mode === "minor"
      ? [0, 2, 3, 5, 7, 8, 10]
      : scale.mode === "chromatic"
        ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
        : [0, 2, 4, 5, 7, 9, 11];
  const band = Math.floor((1 - unit) * degrees.length * 2),
    octave = Math.floor(band / degrees.length);
  return (
    (role === "bass" ? 36 : role === "harmony" ? 48 : 60) +
    scale.root +
    octave * 12 +
    degrees[band % degrees.length]!
  );
}
