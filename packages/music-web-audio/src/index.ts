import { compileScore, ticksToSeconds } from "@onepage/music-core";

import type { Patch, Score } from "@onepage/project";
export type { Patch } from "@onepage/project";
export interface PlaybackOptions {
  startTick?: number;
  endTick?: number;
  loop?: boolean;
  energy?: number;
  mutedTrackIds?: string[];
  soloTrackId?: string | null;
}
export interface RenderOptions extends Omit<PlaybackOptions, "loop"> {
  loops?: number;
  tailSeconds?: number;
  sampleRate?: number;
}
const MAX_VOICES = 256;
const MAX_EVENTS = 100000;
const MAX_FRAMES = 32_000_000;
const LOOKAHEAD = 0.15;
const noiseBuffers = new WeakMap<BaseAudioContext, Map<number, AudioBuffer>>();
const finite = (v: number, fallback: number) =>
  Number.isFinite(v) ? v : fallback;
const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));
interface Voice {
  trackId?: string;
  stop: (at?: number) => void;
  end: number;
}

// Identical synthesis graph for live preview, game playback and offline export.
function voice(
  ctx: BaseAudioContext,
  destination: AudioNode,
  patch: Patch,
  pitch: number,
  velocity: number,
  start: number,
  duration: number,
  gain = 1,
  pan = 0,
): Voice {
  const attack = clamp(finite(patch.attack, 0.005), 0.002, 5);
  const release = clamp(finite(patch.release, 0.06), 0.005, 10);
  const end = start + duration + release;
  const envelope = ctx.createGain();
  const panner = ctx.createStereoPanner();
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value =
    200 + clamp(finite(patch.brightness, 1), 0, 1) * 18000;
  panner.pan.value = clamp(finite(pan, 0), -1, 1);
  envelope.gain.setValueAtTime(0, start);
  const level =
    clamp(finite(velocity, 0.7), 0, 1) * clamp(finite(gain, 1), 0, 2) * 0.18;
  envelope.gain.linearRampToValueAtTime(
    level,
    start + Math.min(attack, duration / 2),
  );
  envelope.gain.setValueAtTime(level, start + duration);
  envelope.gain.linearRampToValueAtTime(0, end);
  let source: AudioScheduledSourceNode;
  if (patch.waveform === "noise") {
    // MIDI kit lanes share a patch but carry distinct deterministic percussion.
    const key = [36, 38, 42, 46].includes(pitch) ? pitch : 0;
    let buffers = noiseBuffers.get(ctx);
    if (!buffers) {
      buffers = new Map();
      noiseBuffers.set(ctx, buffers);
    }
    let buffer = buffers.get(key);
    if (!buffer) {
      buffer = ctx.createBuffer(
        1,
        Math.ceil(ctx.sampleRate * 0.6),
        ctx.sampleRate,
      );
      const samples = buffer.getChannelData(0);
      let seed = 0x12345678,
        previous = 0,
        phase = 0;
      for (let i = 0; i < samples.length; i++) {
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        const random = (seed >>> 0) / 2147483648 - 1,
          t = i / ctx.sampleRate;
        if (key === 36) {
          phase +=
            (2 * Math.PI * (44 + 110 * Math.exp(-t * 35))) / ctx.sampleRate;
          samples[i] = Math.sin(phase) * Math.exp(-t * 20);
        } else if (key === 38)
          samples[i] =
            (0.8 * random + 0.2 * Math.sin(2 * Math.PI * 180 * t)) *
            Math.exp(-t * 24);
        else if (key === 42 || key === 46)
          samples[i] =
            (random - previous) * 0.5 * Math.exp(-t * (key === 42 ? 85 : 14));
        else samples[i] = random;
        previous = random;
      }
      buffers.set(key, buffer);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = key === 0;
    source = noise;
  } else {
    const osc = ctx.createOscillator();
    osc.frequency.value = 440 * 2 ** ((clamp(pitch, 0, 127) - 69) / 12);
    if (patch.waveform === "pulse") {
      const real = new Float32Array(33),
        imag = new Float32Array(33);
      const duty = clamp(finite(patch.duty, 0.5), 0.05, 0.95);
      for (let n = 1; n < 33; n++) {
        real[n] = (2 * Math.sin(2 * Math.PI * n * duty)) / (Math.PI * n);
        imag[n] = (2 * (1 - Math.cos(2 * Math.PI * n * duty))) / (Math.PI * n);
      }
      osc.setPeriodicWave(ctx.createPeriodicWave(real, imag));
    } else osc.type = patch.waveform;
    source = osc;
  }
  source.connect(filter);
  filter.connect(envelope);
  envelope.connect(panner);
  panner.connect(destination);
  let ended = false;
  source.onended = () => {
    ended = true;
    source.disconnect();
    filter.disconnect();
    envelope.disconnect();
    panner.disconnect();
  };
  source.start(start);
  source.stop(end);
  return {
    end,
    stop: (at = ctx.currentTime) => {
      if (ended) return;
      const t = Math.max(ctx.currentTime, at);
      envelope.gain.cancelScheduledValues(t);
      envelope.gain.setValueAtTime(0, t);
      try {
        source.stop(t);
      } catch {
        /* Already ended. */
      }
    },
  };
}

function prepare(score: Score, options: PlaybackOptions) {
  const start = options.startTick ?? 0,
    end = options.endTick ?? score.lengthTicks;
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end <= start ||
    end > score.lengthTicks
  )
    throw new Error("Invalid playback range");
  const events = compileScore(score, {
    startTick: start,
    endTick: end,
    energy: options.energy,
  }).filter(
    (e) =>
      !options.mutedTrackIds?.includes(e.trackId) &&
      (!options.soloTrackId || options.soloTrackId === e.trackId),
  );
  if (events.length > MAX_EVENTS) throw new Error("Score has too many events");
  return { start, end, events, length: ticksToSeconds(end - start, score.bpm) };
}

export class AudioEngine {
  private context: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private voices = new Set<Voice>();
  private generation = 0;
  private playing = false;
  private origin = 0;
  private rangeStart = 0;
  private rangeEnd = 0;
  private bpm = 120;
  private looping = false;
  private energy = 3;
  private trackEnergy = new Map<string, number>();
  private enqueue: ((score: Score) => void) | null = null;
  private queued = false;
  private nextTransports: {
    origin: number;
    start: number;
    end: number;
    bpm: number;
  }[] = [];
  get isPlaying() {
    return this.playing;
  }
  get currentTime() {
    return this.context?.currentTime ?? 0;
  }
  get state() {
    return this.context?.state ?? "closed";
  }
  get hasQueuedScore() {
    this.syncTransport();
    return this.queued || this.nextTransports.length > 0;
  }
  /** Replace a looping score at the next unscheduled loop boundary. Last edit wins. */
  queueScore(score: Score) {
    if (this.playing && this.looping) this.enqueue?.(score);
  }
  private syncTransport() {
    while (
      this.nextTransports.length &&
      this.currentTime >= this.nextTransports[0]!.origin
    ) {
      const next = this.nextTransports.shift()!;
      this.origin = next.origin;
      this.rangeStart = next.start;
      this.rangeEnd = next.end;
      this.bpm = next.bpm;
    }
  }
  async enable() {
    if (!this.context || this.context.state === "closed") {
      this.context = new AudioContext();
      this.context.onstatechange = () => {
        if (this.context?.state !== "running") this.stop();
      };
    }
    const ctx = this.context;
    await ctx.resume();
    if (ctx !== this.context) return;
    if (ctx.state !== "running") throw new Error("Sound could not be enabled");
  }
  async play(score: Score, options: PlaybackOptions = {}) {
    this.stop();
    const token = this.generation;
    const looping = options.loop ?? score.playback === "loop";
    let plan = prepare(score, {
      ...options,
      energy: 3,
      startTick:
        options.startTick ?? (looping ? score.loop?.startTick : undefined),
      endTick: options.endTick ?? (looping ? score.loop?.endTick : undefined),
    });
    this.setEnergy(options.energy ?? 3);
    this.trackEnergy = new Map(score.tracks.map((t) => [t.id, t.minEnergy]));
    await this.enable();
    if (token !== this.generation) return;
    const ctx = this.context!;
    this.rangeStart = plan.start;
    this.rangeEnd = plan.end;
    this.bpm = score.bpm;
    this.looping = looping;
    this.origin = ctx.currentTime + 0.03;
    this.playing = true;
    let scheduledScore = score,
      scheduleOrigin = this.origin;
    let pending: {
      score: Score;
      plan: ReturnType<typeof prepare>;
      when: number;
    } | null = null;
    this.enqueue = (next) => {
      // Snapshot before queuing: callers can continue editing their own score.
      const snapshot = structuredClone(next);
      const nextPlan = prepare(snapshot, {
        ...options,
        energy: 3,
        startTick: options.startTick ?? snapshot.loop?.startTick,
        endTick: options.endTick ?? snapshot.loop?.endTick,
      });
      const earliest = ctx.currentTime + LOOKAHEAD + 0.005;
      const boundary =
        scheduleOrigin +
        Math.max(1, Math.ceil((earliest - scheduleOrigin) / plan.length)) *
          plan.length;
      pending = {
        score: snapshot,
        plan: nextPlan,
        when: pending?.when ?? boundary,
      };
      this.queued = true;
    };
    let cycle = 0,
      index = 0;
    const pump = () => {
      if (!this.playing || token !== this.generation) return;
      this.syncTransport();
      for (const v of this.voices)
        if (v.end <= ctx.currentTime) this.voices.delete(v);
      const horizon = ctx.currentTime + LOOKAHEAD;
      let scheduled = 0;
      while (scheduled++ < MAX_EVENTS) {
        const nextEvent = plan.events[index];
        const nextWhen = nextEvent
          ? scheduleOrigin +
            cycle * plan.length +
            ticksToSeconds(
              Math.max(plan.start, nextEvent.startTick) - plan.start,
              scheduledScore.bpm,
            )
          : scheduleOrigin + (cycle + 1) * plan.length;
        if (
          pending &&
          pending.when <= horizon &&
          (!plan.events.length || nextWhen >= pending.when)
        ) {
          scheduleOrigin = pending.when;
          scheduledScore = pending.score;
          plan = pending.plan;
          this.nextTransports.push({
            origin: scheduleOrigin,
            start: plan.start,
            end: plan.end,
            bpm: scheduledScore.bpm,
          });
          this.trackEnergy = new Map(
            scheduledScore.tracks.map((t) => [t.id, t.minEnergy]),
          );
          pending = null;
          this.queued = false;
          cycle = 0;
          index = 0;
          this.syncTransport();
        }
        if (index >= plan.events.length) {
          if (!this.looping || !plan.events.length) break;
          cycle++;
          index = 0;
          if (scheduleOrigin + cycle * plan.length > horizon) break;
        }
        const event = plan.events[index];
        const when =
          scheduleOrigin +
          cycle * plan.length +
          ticksToSeconds(
            Math.max(plan.start, event.startTick) - plan.start,
            scheduledScore.bpm,
          );
        if (when > horizon) break;
        index++;
        // Skip elapsed notes after throttling; never burst the missed backlog.
        if (when < ctx.currentTime - 0.02) {
          if (
            this.looping &&
            cycle * plan.length < ctx.currentTime - scheduleOrigin - plan.length
          ) {
            cycle = Math.floor(
              (ctx.currentTime - scheduleOrigin) / plan.length,
            );
            index = 0;
          }
          continue;
        }
        if ((this.trackEnergy.get(event.trackId) ?? 1) > this.energy) continue;
        const patch = scheduledScore.patches.find(
          (p) => p.id === event.patchId,
        );
        if (!patch) continue;
        if (this.voices.size >= MAX_VOICES) {
          this.stop();
          return;
        }
        const duration = ticksToSeconds(
          Math.min(plan.end, event.startTick + event.durationTicks) -
            Math.max(plan.start, event.startTick),
          scheduledScore.bpm,
        );
        if (duration > 0) {
          const v = voice(
            ctx,
            ctx.destination,
            patch,
            event.pitch,
            event.velocity,
            Math.max(ctx.currentTime, when),
            duration,
            event.gain,
            event.pan,
          );
          v.trackId = event.trackId;
          this.voices.add(v);
        }
      }
      if (
        !this.looping &&
        ctx.currentTime >=
          scheduleOrigin +
            plan.length +
            Math.max(0, ...scheduledScore.patches.map((p) => p.release))
      )
        this.stop();
    };
    pump();
    if (this.playing) this.timer = setInterval(pump, 25);
  }
  /** Changes layer eligibility while preserving the audio clock and fixed BPM. */
  setEnergy(energy: number) {
    if (!Number.isInteger(energy) || energy < 1 || energy > 3)
      throw new Error("Energy must be 1, 2 or 3");
    this.energy = energy;
    for (const v of this.voices)
      if (v.trackId && (this.trackEnergy.get(v.trackId) ?? 1) > energy) {
        v.stop();
        this.voices.delete(v);
      }
  }
  getPositionTick() {
    this.syncTransport();
    if (!this.playing) return this.rangeStart;
    let ticks =
      (Math.max(0, this.currentTime - this.origin) * this.bpm * 480) / 60;
    const length = this.rangeEnd - this.rangeStart;
    ticks = this.looping ? ticks % length : Math.min(length, ticks);
    return this.rangeStart + ticks;
  }
  /** Audio-clock delay to a score tick in the current pass; late notes start now. */
  getDelayToTick(tick: number) {
    this.syncTransport();
    if (
      !this.playing ||
      !Number.isFinite(tick) ||
      tick < this.rangeStart ||
      tick >= this.rangeEnd
    )
      return 0;
    const elapsed = this.currentTime - this.origin;
    const length = ticksToSeconds(this.rangeEnd - this.rangeStart, this.bpm);
    const offset = ticksToSeconds(tick - this.rangeStart, this.bpm);
    const cycle = this.looping ? Math.max(0, Math.floor(elapsed / length)) : 0;
    const when = cycle * length + offset;
    return Math.max(0, when - elapsed);
  }
  previewNote(
    patch: Patch,
    pitch: number,
    velocity = 0.7,
    durationSeconds = 0.3,
    gain = 1,
    pan = 0,
    delaySeconds = 0,
  ) {
    if (!this.context || this.context.state !== "running") return () => {};
    for (const v of this.voices)
      if (v.end <= this.context.currentTime) this.voices.delete(v);
    if (this.voices.size >= MAX_VOICES) return () => {};
    const v = voice(
      this.context,
      this.context.destination,
      patch,
      pitch,
      velocity,
      this.context.currentTime + clamp(finite(delaySeconds, 0), 0, 10),
      clamp(finite(durationSeconds, 0.3), 1 / this.context.sampleRate, 10),
      gain,
      pan,
    );
    this.voices.add(v);
    return () => {
      v.stop();
      this.voices.delete(v);
    };
  }
  stop() {
    this.generation++;
    this.playing = false;
    this.enqueue = null;
    this.queued = false;
    this.nextTransports = [];
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const v of this.voices) v.stop();
    this.voices.clear();
  }
  async dispose() {
    this.stop();
    const ctx = this.context;
    this.context = null;
    if (ctx && ctx.state !== "closed") await ctx.close();
  }
}

export async function renderScore(
  score: Score,
  options: RenderOptions = {},
): Promise<AudioBuffer> {
  const plan = prepare(score, options);
  const loops = options.loops ?? 1,
    sampleRate = options.sampleRate ?? 48000,
    tail = options.tailSeconds ?? 0.2;
  if (
    !Number.isInteger(loops) ||
    loops < 1 ||
    loops > 128 ||
    ![22050, 44100, 48000, 96000].includes(sampleRate) ||
    !Number.isFinite(tail) ||
    tail < 0 ||
    tail > 10
  )
    throw new Error("Invalid render options");
  const duration = plan.length * loops + tail,
    frames = Math.ceil(duration * sampleRate);
  if (
    !Number.isFinite(frames) ||
    frames < 1 ||
    duration > 600 ||
    frames > MAX_FRAMES ||
    plan.events.length * loops > MAX_EVENTS
  )
    throw new Error("Render exceeds supported size");
  const ctx = new OfflineAudioContext(2, frames, sampleRate);
  const ends: number[] = [];
  for (let cycle = 0; cycle < loops; cycle++)
    for (const event of plan.events) {
      const patch = score.patches.find((p) => p.id === event.patchId);
      if (!patch) continue;
      const at =
        cycle * plan.length +
        ticksToSeconds(
          Math.max(plan.start, event.startTick) - plan.start,
          score.bpm,
        );
      const length = ticksToSeconds(
        Math.min(plan.end, event.startTick + event.durationTicks) -
          Math.max(plan.start, event.startTick),
        score.bpm,
      );
      if (length <= 0) continue;
      while (ends.length && ends[0] <= at) ends.shift();
      if (ends.length >= MAX_VOICES)
        throw new Error("Render exceeds voice limit");
      const v = voice(
        ctx,
        ctx.destination,
        patch,
        event.pitch,
        event.velocity,
        at,
        length,
        event.gain,
        event.pan,
      );
      ends.push(v.end);
      ends.sort((a, b) => a - b);
    }
  return ctx.startRendering();
}

export function encodeWav(buffer: AudioBuffer): Uint8Array {
  const channels = buffer.numberOfChannels,
    frames = buffer.length;
  if (channels < 1 || channels > 2 || frames > MAX_FRAMES)
    throw new Error("Unsupported WAV dimensions");
  const bytes = frames * channels * 2,
    result = new Uint8Array(44 + bytes),
    view = new DataView(result.buffer);
  const text = (at: number, value: string) => {
    for (let i = 0; i < value.length; i++) result[at + i] = value.charCodeAt(i);
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + bytes, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, bytes, true);
  const data = Array.from({ length: channels }, (_, c) =>
    buffer.getChannelData(c),
  );
  for (let i = 0; i < frames; i++)
    for (let c = 0; c < channels; c++) {
      const s = clamp(finite(data[c][i], 0), -1, 1);
      view.setInt16(
        44 + (i * channels + c) * 2,
        Math.round(s * (s < 0 ? 32768 : 32767)),
        true,
      );
    }
  return result;
}
