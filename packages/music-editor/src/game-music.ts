import { createBlankScore, type Score } from "@onepage/project";

export type GameMusicSource = "original" | "saved" | "working";
export interface GameMusicControl {
  activateWorking(): Promise<void>;
  readonly working: boolean;
  readonly running: boolean;
}
export interface GameComposeProps {
  score: Score;
  onEditScore(score: Score): Promise<Score | null>;
  musicControl: { current: GameMusicControl | null };
}
/** A blank editable loop with the cue's musical dimensions, never its notes. */
export function createGameDraft(source: Score, cue: string): Score {
  const blank = createBlankScore(`New music · ${cue}`);
  blank.bpm = source.bpm;
  blank.meter = [...source.meter];
  blank.scale = structuredClone(source.scale);
  blank.lengthTicks = source.loop
    ? source.loop.endTick - source.loop.startTick
    : source.lengthTicks;
  blank.loop = { startTick: 0, endTick: blank.lengthTicks };
  blank.patterns[0]!.lengthTicks = blank.lengthTicks;
  return blank;
}
