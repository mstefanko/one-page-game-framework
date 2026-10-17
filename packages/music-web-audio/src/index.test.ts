import { afterEach, describe, expect, it, vi } from "vitest";
import { createBlankScore } from "@onepage/project";
import { AudioEngine, encodeWav, renderScore } from "./index";

class Parameter {
  value = 0;
  setValueAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
  cancelScheduledValues = vi.fn();
}
class Node {
  buffer: AudioBuffer | null = null;
  loop = false;
  gain = new Parameter();
  pan = new Parameter();
  frequency = new Parameter();
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
  setPeriodicWave = vi.fn();
  onended: (() => void) | null = null;
}
class Context {
  static instances: Context[] = [];
  currentTime = 0;
  sampleRate = 48000;
  state = "suspended";
  destination = new Node();
  onstatechange: (() => void) | null = null;
  sources: Node[] = [];
  constructor() {
    Context.instances.push(this);
  }
  resume = vi.fn(async () => {
    this.state = "running";
    this.onstatechange?.();
  });
  close = vi.fn(async () => {
    this.state = "closed";
  });
  createBuffer(_channels: number, length: number, sampleRate: number) {
    const samples = new Float32Array(length);
    return {
      length,
      sampleRate,
      getChannelData: () => samples,
    } as unknown as AudioBuffer;
  }
  createBufferSource() {
    const n = new Node();
    this.sources.push(n);
    return n;
  }
  createGain() {
    return new Node();
  }
  createStereoPanner() {
    return new Node();
  }
  createBiquadFilter() {
    return new Node();
  }
  createPeriodicWave() {
    return {};
  }
  createOscillator() {
    const n = new Node();
    this.sources.push(n);
    return n;
  }
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  Context.instances = [];
});
describe("shared audio lifecycle", () => {
  it("constructs without touching browser audio globals", () => {
    const engine = new AudioEngine();
    expect(engine.isPlaying).toBe(false);
    expect(engine.currentTime).toBe(0);
  });
  it("cancels scheduled voices on stop and closes on dispose", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("AudioContext", Context);
    const score = createBlankScore();
    score.patterns[0].notes.push({
      id: "n",
      startTick: 0,
      durationTicks: 480,
      pitch: 60,
      velocity: 0.8,
    });
    const engine = new AudioEngine();
    await engine.play(score);
    const ctx = Context.instances[0];
    expect(ctx.sources).toHaveLength(1);
    expect(engine.isPlaying).toBe(true);
    ctx.currentTime = 0.53;
    expect(engine.getPositionTick()).toBeCloseTo(480);
    engine.stop();
    expect(ctx.sources[0].stop).toHaveBeenLastCalledWith(0.53);
    expect(engine.isPlaying).toBe(false);
    await engine.dispose();
    expect(ctx.close).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("schedules by audio time and skips elapsed notes after a stalled main thread", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("AudioContext", Context);
    const score = createBlankScore();
    score.playback = "one-shot";
    score.loop = null;
    score.patterns[0].notes = [0, 480, 960].map((startTick, i) => ({
      id: String(i),
      startTick,
      durationTicks: 120,
      pitch: 60,
      velocity: 0.8,
    }));
    const engine = new AudioEngine();
    await engine.play(score);
    const ctx = Context.instances[0];
    expect(ctx.sources).toHaveLength(1);
    expect(ctx.sources[0].start).toHaveBeenCalledWith(0.03);
    ctx.currentTime = 1;
    vi.advanceTimersByTime(25);
    expect(ctx.sources).toHaveLength(2);
    expect(ctx.sources[1].start).toHaveBeenCalledWith(1.03);
    await engine.dispose();
  });
  it("gives percussion lanes distinct deterministic buffers, cached per lane", async () => {
    vi.stubGlobal("AudioContext", Context);
    const engine = new AudioEngine();
    await engine.enable();
    const patch = {
      ...createBlankScore().patches[0]!,
      waveform: "noise" as const,
    };
    for (const pitch of [36, 38, 42, 46, 36]) engine.previewNote(patch, pitch);
    const sources = Context.instances[0].sources;
    expect(new Set(sources.slice(0, 4).map((s) => s.buffer))).toHaveProperty(
      "size",
      4,
    );
    expect(sources[0].buffer).toBe(sources[4].buffer);
    expect(sources[0].buffer!.getChannelData(0)[100]).not.toBe(
      sources[1].buffer!.getChannelData(0)[100],
    );
    expect(sources.every((s) => !s.loop)).toBe(true);
    await engine.dispose();
  });
  it("aligns phrase previews to the audio clock, including preroll, and cancels future voices", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("AudioContext", Context);
    const score = createBlankScore();
    const engine = new AudioEngine();
    await engine.play(score, { loop: true });
    const ctx = Context.instances[0];
    expect(engine.getDelayToTick(0)).toBeCloseTo(0.03);
    expect(engine.getDelayToTick(480)).toBeCloseTo(0.53);
    ctx.currentTime = 0.28;
    engine.previewNote(
      score.patches[0]!,
      60,
      0.8,
      0.1,
      1,
      0,
      engine.getDelayToTick(480),
    );
    const scheduled = ctx.sources.at(-1)!;
    expect(scheduled.start).toHaveBeenCalledWith(0.53);
    expect(engine.getDelayToTick(0)).toBe(0);
    engine.stop();
    expect(scheduled.stop).toHaveBeenLastCalledWith(0.28);
    expect(engine.getDelayToTick(480)).toBe(0);
    await engine.dispose();
  });
  it("keeps phrase scheduling aligned in a nonzero loop after it wraps", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("AudioContext", Context);
    const engine = new AudioEngine();
    await engine.play(createBlankScore(), {
      startTick: 480,
      endTick: 1440,
      loop: true,
    });
    const ctx = Context.instances[0];
    ctx.currentTime = 1.28;
    expect(engine.getPositionTick()).toBeCloseTo(720);
    expect(engine.getDelayToTick(960)).toBeCloseTo(0.25);
    expect(engine.getDelayToTick(480)).toBe(0);
    await engine.dispose();
  });
  it("applies only the latest live edit at a loop boundary without restarting the clock", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("AudioContext", Context);
    const score = createBlankScore();
    score.loop = { startTick: 480, endTick: 1440 };
    score.patterns[0]!.notes = [
      { id: "n", startTick: 480, durationTicks: 120, pitch: 60, velocity: 0.8 },
    ];
    const engine = new AudioEngine();
    await engine.play(score, { loop: true });
    const ctx = Context.instances[0];
    ctx.currentTime = 0.28;
    const edit = structuredClone(score);
    edit.patterns[0]!.notes[0]!.pitch = 64;
    engine.queueScore(edit);
    edit.patterns[0]!.notes[0]!.pitch = 67;
    engine.queueScore(edit);
    edit.patterns[0]!.notes[0]!.pitch = 90;
    expect(engine.hasQueuedScore).toBe(true);
    expect(engine.getPositionTick()).toBeCloseTo(720);
    ctx.currentTime = 0.9;
    vi.advanceTimersByTime(25);
    expect(ctx.sources).toHaveLength(2);
    expect(ctx.sources[1]!.frequency.value).toBeCloseTo(
      440 * 2 ** ((67 - 69) / 12),
    );
    expect(ctx.sources[1]!.start).toHaveBeenCalledWith(1.03);
    // Scheduling ahead must not move the visible playhead ahead of real audio.
    expect(engine.getPositionTick()).toBeCloseTo(1315.2);
    expect(engine.hasQueuedScore).toBe(true);
    ctx.currentTime = 1.28;
    expect(engine.getPositionTick()).toBeCloseTo(720);
    expect(engine.hasQueuedScore).toBe(false);
    expect(engine.isPlaying).toBe(true);
    await engine.dispose();
  });
  it("updates a silent loop, adopts new tempo/range, and cancels queued changes on stop", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("AudioContext", Context);
    const score = createBlankScore();
    score.loop = { startTick: 0, endTick: 960 };
    const engine = new AudioEngine();
    await engine.play(score, { loop: true });
    const ctx = Context.instances[0];
    ctx.currentTime = 0.28;
    const next = structuredClone(score);
    next.bpm = 60;
    next.loop = { startTick: 480, endTick: 1440 };
    next.patterns[0]!.notes = [
      { id: "n", startTick: 480, durationTicks: 120, pitch: 60, velocity: 0.8 },
    ];
    engine.queueScore(next);
    ctx.currentTime = 0.9;
    vi.advanceTimersByTime(25);
    expect(ctx.sources).toHaveLength(1);
    expect(ctx.sources[0]!.start).toHaveBeenCalledWith(1.03);
    expect(engine.getPositionTick()).toBeCloseTo(835.2);
    ctx.currentTime = 1.53;
    expect(engine.getPositionTick()).toBeCloseTo(720);
    engine.queueScore(score);
    engine.stop();
    expect(engine.hasQueuedScore).toBe(false);
    ctx.currentTime = 5;
    vi.advanceTimersByTime(1000);
    expect(ctx.sources).toHaveLength(1);
    await engine.dispose();
  });
  it("retains each audible transport transition when several short loops fit in lookahead", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("AudioContext", Context);
    const score = createBlankScore();
    score.bpm = 400;
    score.loop = { startTick: 0, endTick: 96 };
    const engine = new AudioEngine();
    await engine.play(score, { loop: true });
    const ctx = Context.instances[0];
    engine.queueScore({ ...score, loop: { startTick: 480, endTick: 576 } });
    ctx.currentTime = 0.04;
    vi.advanceTimersByTime(25);
    engine.queueScore({ ...score, loop: { startTick: 960, endTick: 1056 } });
    ctx.currentTime = 0.07;
    vi.advanceTimersByTime(25);
    ctx.currentTime = 0.19;
    expect(engine.getPositionTick()).toBeCloseTo(512);
    expect(engine.hasQueuedScore).toBe(true);
    ctx.currentTime = 0.22;
    expect(engine.getPositionTick()).toBeCloseTo(992);
    expect(engine.hasQueuedScore).toBe(false);
    await engine.dispose();
  });
  it("changes energy without resetting transport and cancels ineligible scheduled layers", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("AudioContext", Context);
    const score = createBlankScore();
    score.tracks[0]!.minEnergy = 3;
    score.patterns[0]!.notes = [
      { id: "n", startTick: 0, durationTicks: 960, pitch: 60, velocity: 0.8 },
    ];
    const engine = new AudioEngine();
    await engine.play(score, { energy: 3 });
    const ctx = Context.instances[0];
    ctx.currentTime = 0.53;
    engine.setEnergy(1);
    expect(engine.isPlaying).toBe(true);
    expect(engine.getPositionTick()).toBeCloseTo(480);
    expect(ctx.sources[0].stop).toHaveBeenLastCalledWith(0.53);
    expect(() => engine.setEnergy(4)).toThrow();
    await engine.dispose();
  });
  it("does not leave a scheduler timer when the initial event burst exceeds voice limit", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("AudioContext", Context);
    const score = createBlankScore();
    score.patterns[0]!.notes = Array.from({ length: 257 }, (_, i) => ({
      id: String(i),
      startTick: 0,
      durationTicks: 480,
      pitch: 60,
      velocity: 0.1,
    }));
    const engine = new AudioEngine();
    await engine.play(score);
    expect(engine.isPlaying).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    await engine.dispose();
  });
  it("stops on browser interruption", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("AudioContext", Context);
    const engine = new AudioEngine();
    await engine.play(createBlankScore());
    Context.instances[0].state = "interrupted";
    Context.instances[0].onstatechange?.();
    expect(engine.isPlaying).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("stop during async enable prevents a stale playback from starting", async () => {
    vi.stubGlobal("AudioContext", Context);
    const engine = new AudioEngine();
    const pending = engine.play(createBlankScore());
    engine.stop();
    await pending;
    expect(engine.isPlaying).toBe(false);
    await engine.dispose();
  });
  it("rejects oversized offline allocations before creating a context", async () => {
    const score = createBlankScore();
    score.lengthTicks = 9600;
    await expect(renderScore(score, { loops: 128 })).rejects.toThrow(
      "Render exceeds",
    );
  });
});
it("writes interleaved PCM16 WAV with clipping and nonfinite sample sanitization", () => {
  const wav = encodeWav({
    numberOfChannels: 2,
    length: 2,
    sampleRate: 48000,
    getChannelData: (c: number) => new Float32Array(c ? [NaN, 0.5] : [-2, 2]),
  } as AudioBuffer);
  const view = new DataView(wav.buffer);
  expect(new TextDecoder().decode(wav.slice(0, 4))).toBe("RIFF");
  expect(view.getUint32(40, true)).toBe(8);
  expect([44, 46, 48, 50].map((n) => view.getInt16(n, true))).toEqual([
    -32768, 0, 32767, 16384,
  ]);
});
