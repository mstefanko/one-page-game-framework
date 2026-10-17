import { useEffect, useRef, useState } from "react";
import { PPQ, type Score, type Note, type Patch } from "@onepage/project";
import {
  arcadeBarTicks,
  createArcadeBacking,
  createArcadeExperimentPhrase,
  ticksToSeconds,
  type ArcadeExperiment,
  type ArcadeIntent,
  type ArcadeBacking,
} from "@onepage/music-core";
import type { AudioEngine } from "@onepage/music-web-audio";
import "./game-audio.css";
import "./arcade.css";

export interface ArcadeLane {
  role: Score["tracks"][number]["role"];
  patch: Patch;
  notes: Note[];
}
export interface ArcadeTake {
  /** Retain the review window when navigating away and back. */
  windowBars?: string;
  notes: Note[];
  patch: Patch | null;
  lanes: ArcadeLane[];
}
const weapons = [
  {
    id: "blade",
    name: "Pulse blade",
    vibe: "Bright · crisp chiptune",
    waveform: "pulse",
    attack: 0.006,
    release: 0.07,
    brightness: 0.74,
    duty: 0.25,
  },
  {
    id: "staff",
    name: "Moon staff",
    vibe: "Soft · rounded bells",
    waveform: "sine",
    attack: 0.015,
    release: 0.23,
    brightness: 0.45,
    duty: 0.5,
  },
  {
    id: "bow",
    name: "Ember bow",
    vibe: "Gritty · urgent lead",
    waveform: "sawtooth",
    attack: 0.012,
    release: 0.09,
    brightness: 0.56,
    duty: 0.5,
  },
  {
    id: "glaive",
    name: "Reed glaive",
    vibe: "Warm · hollow woodwind",
    waveform: "triangle",
    attack: 0.025,
    release: 0.14,
    brightness: 0.55,
    duty: 0.5,
  },
] as const;
const modes: {
  id: ArcadeExperiment;
  name: string;
  description: string;
  actions: [string, string, string, string];
}[] = [
  {
    id: "phrase-rider",
    name: "Phrase Rider",
    description:
      "Ride a repeating song motif. Queue an answer, lift or resolution for the next bar.",
    actions: ["Motif", "Rise", "Answer", "Resolve"],
  },
  {
    id: "groove-fighter",
    name: "Groove Fighter",
    description:
      "Keep a drum pocket moving. Change the groove or throw a fill into the next bar.",
    actions: ["Groove", "Variation", "Fill", "Drop"],
  },
  {
    id: "ribbon-lead",
    name: "Ribbon Lead",
    description:
      "Hold a move or drag the sky ribbon. Height guides pitch; movement stays smooth and in scale.",
    actions: ["Sing", "Lift", "Fall", "Hold tone"],
  },
];
const actions = ["strike", "leap", "dash", "guard"] as const;
const keys: Record<string, { action: ArcadeIntent; direction?: number }> = {
  j: { action: "strike" },
  "1": { action: "strike" },
  k: { action: "leap" },
  w: { action: "leap" },
  ArrowUp: { action: "leap" },
  "2": { action: "leap" },
  l: { action: "dash" },
  d: { action: "dash", direction: 1 },
  ArrowRight: { action: "dash", direction: 1 },
  "3": { action: "dash", direction: 1 },
  a: { action: "dash", direction: -1 },
  ArrowLeft: { action: "dash", direction: -1 },
  i: { action: "guard" },
  s: { action: "guard" },
  ArrowDown: { action: "guard" },
  "4": { action: "guard" },
  r: { action: "rest" },
  "0": { action: "rest" },
};
type Capture = "jam" | "armed" | "recording" | "review";
interface PendingNote {
  note: Note;
  at: number;
}
const MAX_NOTES = 2048;
const emptyTake = (): ArcadeTake => ({ notes: [], patch: null, lanes: [] });
export function Arcade({
  score,
  trackId,
  clipId,
  take,
  onTakeChange,
  onKeep,
  engine,
}: {
  score: Score;
  trackId: string;
  clipId?: string;
  take: ArcadeTake;
  onTakeChange: (take: ArcadeTake) => void;
  onKeep: (notes: Note[], patch?: Patch, lanes?: ArcadeLane[]) => void;
  engine: AudioEngine;
}) {
  const track = score.tracks.find((t) => t.id === trackId) ?? score.tracks[0]!;
  const clip =
    score.clips.find((c) => c.id === clipId && c.trackId === trackId) ??
    score.clips.find((c) => c.trackId === trackId);
  const pattern = score.patterns.find((p) => p.id === clip?.patternId);
  const clipStart = clip?.startTick ?? 0;
  const clipEnd = Math.min(
    score.lengthTicks,
    clipStart + (pattern?.lengthTicks ?? score.lengthTicks),
  );
  const intersectsLoop =
    score.loop &&
    score.loop.endTick > clipStart &&
    score.loop.startTick < clipEnd;
  const start = intersectsLoop
    ? Math.max(clipStart, score.loop!.startTick)
    : clipStart;
  const regionEnd = intersectsLoop
    ? Math.min(clipEnd, score.loop!.endTick)
    : clipEnd;
  const [windowBars, setWindowBars] = useState(take.windowBars ?? "2");
  const end =
    windowBars === "phrase"
      ? regionEnd
      : Math.min(regionEnd, start + Number(windowBars) * arcadeBarTicks(score));
  const length = end - start;
  const stage = useRef<HTMLDivElement>(null);
  const takeRef = useRef(take);
  takeRef.current = take;
  const generation = useRef(0),
    active = useRef(false),
    held = useRef(new Set<string>());
  const session = useRef({
    origin: 0,
    nextPhrase: 0,
    nextClick: 0,
    pending: [] as PendingNote[],
    recordCycle: null as number | null,
    ribbonUntil: 0,
    sequence: 0,
    lastPitch: undefined as number | undefined,
  });
  const scheduledCapture = useRef<{ note: Note; patch: Patch; when: number }[]>(
    [],
  );
  const voices = useRef<{ stop: () => void; end: number }[]>([]);
  const pumpRef = useRef<() => void>(() => {});
  const finishRef = useRef<() => void>(() => {});
  const lastMove = useRef({ at: -Infinity, x: 0, motionAt: 0 });
  const [followMovement, setFollowMovement] = useState(true);
  const [mode, setMode] = useState<ArcadeExperiment>("phrase-rider");
  const [backing, setBacking] = useState<ArcadeBacking>("without-role");
  const [running, setRunning] = useState(false),
    [starting, setStarting] = useState(false),
    [replaying, setReplaying] = useState(false);
  const [capture, setCapture] = useState<Capture>(
    take.notes.length ? "review" : "jam",
  );
  const captureRef = useRef(capture);
  captureRef.current = capture;
  const [weaponId, setWeaponId] = useState(
    () =>
      weapons.find((w) => w.name === take.lanes.at(-1)?.patch.name)?.id ??
      "blade",
  );
  const [intensity, setIntensity] = useState<1 | 2 | 3>(1);
  const [intent, setIntent] = useState<ArcadeIntent>("strike"),
    [soundingIntent, setSoundingIntent] = useState<ArcadeIntent>("rest");
  const intentRef = useRef(intent);
  intentRef.current = intent;
  const [beat, setBeat] = useState(0),
    [progress, setProgress] = useState(0),
    [countdown, setCountdown] = useState(0);
  const [ribbon, setRibbon] = useState(0.5),
    [direction, setDirection] = useState(0);
  const [pose, setPose] = useState<ArcadeIntent | "idle">("idle"),
    [x, setX] = useState(36),
    [facing, setFacing] = useState(1),
    [motion, setMotion] = useState(0);
  const [message, setMessage] = useState(
    "Choose a way to play, then start a jam. Record next loop captures exactly one pass.",
  );
  const currentMode = modes.find((m) => m.id === mode)!;
  const role: ArcadeLane["role"] =
    mode === "groove-fighter"
      ? "drums"
      : track.role === "drums"
        ? "melody"
        : track.role;
  const weapon = weapons.find((w) => w.id === weaponId)!;
  const sound: Patch = {
    ...weapon,
    id: `arcade-${weapon.id}-${role === "drums" ? "kit" : "tone"}`,
    waveform: role === "drums" ? "noise" : weapon.waveform,
  };
  // Patch has a strict persisted schema, so do not include presentation-only weapon fields.
  const selectedSound: Patch = {
    id: sound.id,
    name: sound.name,
    waveform: sound.waveform,
    attack: sound.attack,
    release: sound.release,
    brightness: sound.brightness,
    duty: sound.duty,
  };
  const soundRef = useRef(selectedSound);
  soundRef.current = selectedSound;
  function setCaptureState(next: Capture) {
    captureRef.current = next;
    setCapture(next);
  }
  function stop() {
    finishCapturedSound();
    generation.current++;
    active.current = false;
    held.current.clear();
    session.current.pending = [];
    session.current.recordCycle = null;
    engine.stop();
    voices.current = [];
    setRunning(false);
    setStarting(false);
    setReplaying(false);
    setPose("idle");
    setSoundingIntent("rest");
    setCaptureState(takeRef.current.notes.length ? "review" : "jam");
  }
  function silence() {
    intentRef.current = "rest";
    setIntent("rest");
    session.current.pending = [];
    finishCapturedSound();
    for (const voice of voices.current) voice.stop();
    voices.current = [];
    setSoundingIntent("rest");
    setPose("guard");
    setMessage(
      "Rest. Your backing keeps moving; choose a move for the next boundary.",
    );
  }
  useEffect(() => {
    const blur = () => stop();
    const hidden = () => {
      if (document.hidden) stop();
    };
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      finishRef.current();
      generation.current++;
      active.current = false;
      held.current.clear();
      engine.stop();
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [engine]);
  useEffect(() => {
    stop();
    session.current.lastPitch = undefined;
  }, [trackId, clipId, score.id, score.bpm, start, end, mode, backing]);
  useEffect(() => {
    if (!running && !replaying) return;
    const timer = setInterval(() => {
      if (!engine.isPlaying) {
        stop();
        return;
      }
      if (active.current) pumpRef.current();
    }, 20);
    return () => clearInterval(timer);
  }, [running, replaying, engine]);
  function captureNote(note: Note, patch: Patch) {
    if (takeRef.current.notes.length >= MAX_NOTES) {
      setMessage("Take limit reached. Review or discard this pass.");
      return;
    }
    const lanes = takeRef.current.lanes.map((l) => ({
      ...l,
      notes: [...l.notes],
    }));
    const lane = lanes.find((l) => l.patch.id === patch.id && l.role === role);
    if (lane) lane.notes.push(note);
    else lanes.push({ patch: { ...patch }, role, notes: [note] });
    const next = {
      windowBars,
      notes: [...takeRef.current.notes, note],
      patch: lanes.length === 1 ? { ...patch } : null,
      lanes,
    };
    takeRef.current = next;
    onTakeChange(next);
  }
  function flushCapture() {
    const ready = scheduledCapture.current.filter(
      (event) => event.when <= engine.currentTime + 0.001,
    );
    scheduledCapture.current = scheduledCapture.current.filter(
      (event) => event.when > engine.currentTime + 0.001,
    );
    if (ready.length && captureRef.current === "armed") {
      takeRef.current = emptyTake();
      onTakeChange(takeRef.current);
      setCaptureState("recording");
    }
    for (const event of ready) captureNote(event.note, event.patch);
  }
  function finishCapturedSound() {
    if (!active.current) return;
    flushCapture();
    scheduledCapture.current = [];
    const s = session.current;
    if (s.recordCycle === null) return;
    const tick = Math.max(
      0,
      ((engine.currentTime - s.origin) * score.bpm * PPQ) / 60 -
        s.recordCycle * length,
    );
    const cutoff =
      Math.max(0, Math.min(length, Math.floor(tick))) + start - clipStart;
    const trim = (notes: Note[]) =>
      notes
        .filter((n) => n.startTick < cutoff)
        .map((n) => ({
          ...n,
          durationTicks: Math.max(
            1,
            Math.min(n.durationTicks, cutoff - n.startTick),
          ),
        }));
    const lanes = takeRef.current.lanes
      .map((l) => ({ ...l, notes: trim(l.notes) }))
      .filter((l) => l.notes.length);
    const notes = trim(takeRef.current.notes);
    if (
      notes.length === takeRef.current.notes.length &&
      notes.every(
        (n, i) => n.durationTicks === takeRef.current.notes[i]!.durationTicks,
      )
    )
      return;
    const next = {
      ...takeRef.current,
      notes,
      lanes,
      patch: lanes.length === 1 ? lanes[0]!.patch : null,
    };
    takeRef.current = next;
    onTakeChange(next);
  }
  finishRef.current = finishCapturedSound;
  function pump() {
    flushCapture();
    const s = session.current;
    const now = Math.max(
      0,
      ((engine.currentTime - s.origin) * score.bpm * PPQ) / 60,
    );
    const horizon = Math.min(
      now + (score.bpm * PPQ * 0.07) / 60,
      s.recordCycle === null ? Infinity : (s.recordCycle + 1) * length - 0.001,
    );
    const cycle = Math.floor(now / length),
      local = now % length;
    if (
      direction &&
      held.current.size &&
      now - lastMove.current.motionAt >= PPQ / 4
    ) {
      lastMove.current.motionAt = now;
      setX((v) => Math.max(15, Math.min(82, v + direction * 2)));
    }
    setBeat(Math.floor(local / ((PPQ * 4) / score.meter[1])) % score.meter[0]);
    setProgress(local / length);
    if (s.recordCycle !== null) {
      if (cycle > s.recordCycle) {
        stop();
        setMessage(
          takeRef.current.notes.length
            ? "One loop captured. Replay it, keep the editable notes, or discard and try again."
            : "Silent pass captured. Choose a move and record another loop.",
        );
        return;
      }
      if (cycle === s.recordCycle && captureRef.current === "armed") {
        takeRef.current = emptyTake();
        onTakeChange(takeRef.current);
        setCaptureState("recording");
      }
      setCountdown(
        Math.max(0, Math.ceil((s.recordCycle * length - now) / PPQ)),
      );
    }
    const phraseLength =
      mode === "ribbon-lead" ? PPQ / 4 : arcadeBarTicks(score);
    // Skip elapsed work after a throttled tab; never burst a backlog of notes.
    if (s.nextPhrase < now - phraseLength) {
      s.nextPhrase =
        cycle * length + Math.ceil(local / phraseLength) * phraseLength;
      s.pending = [];
    }
    let work = 0;
    while (s.nextPhrase <= horizon && work++ < 4) {
      const at = s.nextPhrase,
        pass = Math.floor(at / length),
        offset = at % length;
      const selected =
        mode === "phrase-rider" && intentRef.current === "dash"
          ? "reply"
          : intentRef.current;
      const actual =
        mode === "ribbon-lead" && !held.current.size && at >= s.ribbonUntil
          ? "rest"
          : selected;
      const phrase = createArcadeExperimentPhrase({
        score: {
          ...createArcadeBacking(score, role, backing),
          tracks: createArcadeBacking(score, role, backing).tracks.map((t) =>
            t.id === track.id ? { ...t, role } : t,
          ),
        },
        trackId: track.id,
        mode,
        intent: actual,
        startTick: start + offset,
        loopStartTick: start,
        loopEndTick: end,
        intensity,
        sequence: s.sequence++,
        previousPitch: s.lastPitch,
        direction,
        ribbon,
        ribbonStepTicks: mode === "ribbon-lead" ? PPQ / 4 : undefined,
      });
      s.lastPitch = phrase.lastPitch;
      s.pending.push(
        ...phrase.notes.map((note) => ({
          note,
          at: pass * length + note.startTick,
        })),
      );
      s.pending.sort((a, b) => a.at - b.at);
      s.nextPhrase = at + Math.min(phraseLength, length - offset);
      setSoundingIntent(selected === "rest" ? "rest" : actual);
      if (mode === "groove-fighter" && actual === "dash") {
        intentRef.current = "strike";
        setIntent("strike");
      }
      if (actual !== "rest")
        setMessage(
          `${phrase.description}. ${captureRef.current === "recording" ? "Recording this loop." : "Jam · no notes captured."}`,
        );
    }
    if (backing === "metronome" || captureRef.current === "armed") {
      if (s.nextClick < now - PPQ) s.nextClick = Math.ceil(now / PPQ) * PPQ;
      while (s.nextClick <= horizon) {
        const delay = Math.max(
          0,
          ticksToSeconds(Math.max(0, s.nextClick - now), score.bpm),
        );
        engine.previewNote(
          {
            id: "arcade-click",
            name: "Count in",
            waveform: "sine",
            attack: 0.001,
            release: 0.015,
            brightness: 0.7,
            duty: 0.5,
          },
          s.nextClick % arcadeBarTicks(score) === 0 ? 76 : 68,
          0.55,
          0.025,
          0.45,
          0,
          delay,
        );
        s.nextClick += PPQ;
      }
    } else s.nextClick = Math.ceil(now / PPQ) * PPQ;
    voices.current = voices.current.filter((v) => v.end > engine.currentTime);
    while (s.pending.length && s.pending[0]!.at <= horizon) {
      const event = s.pending.shift()!;
      if (event.at < now - PPQ / 4) continue;
      const delay =
        Math.max(0, ticksToSeconds(Math.max(0, event.at - now), score.bpm)) +
        Math.max(0, s.origin - engine.currentTime);
      const patch = soundRef.current;
      const actualTick = Math.max(event.at, now);
      const audibleNote = {
        ...event.note,
        startTick: Math.min(length - 1, Math.round(actualTick % length)),
        durationTicks: Math.max(
          1,
          Math.min(
            event.note.durationTicks,
            Math.floor((10 * score.bpm * PPQ) / 60),
            Math.floor(length - (actualTick % length)),
          ),
        ),
      };
      const stopVoice = engine.previewNote(
        patch,
        event.note.pitch,
        event.note.velocity,
        ticksToSeconds(audibleNote.durationTicks, score.bpm),
        track.gain,
        track.pan,
        delay,
      );
      voices.current.push({
        stop: stopVoice,
        end:
          engine.currentTime +
          delay +
          ticksToSeconds(audibleNote.durationTicks, score.bpm) +
          patch.release,
      });
      if (
        s.recordCycle !== null &&
        Math.floor(event.at / length) === s.recordCycle
      ) {
        scheduledCapture.current.push({
          note: {
            ...audibleNote,
            startTick: audibleNote.startTick + start - clipStart,
            id: `${event.note.id}:${s.recordCycle}`,
          },
          patch: { ...patch },
          when: engine.currentTime + delay,
        });
      }
    }
  }
  pumpRef.current = pump;
  async function play(record = false) {
    const token = ++generation.current;
    active.current = false;
    held.current.clear();
    setStarting(true);
    try {
      await engine.play(createArcadeBacking(score, role, backing), {
        startTick: start,
        endTick: end,
        loop: true,
        energy: 3,
      });
      if (token !== generation.current) return;
      const origin = engine.currentTime + engine.getDelayToTick(start);
      scheduledCapture.current = [];
      session.current = {
        origin,
        nextPhrase: 0,
        nextClick: 0,
        pending: [],
        recordCycle: record ? 1 : null,
        ribbonUntil: 0,
        sequence: 0,
        lastPitch: undefined,
      };
      active.current = true;
      setRunning(true);
      setStarting(false);
      setCaptureState(record ? "armed" : "jam");
      setMessage(
        record
          ? "Count in: record starts at the next loop. Choose your opening move now."
          : "Jam started. Moves choose a continuous idea; recording is separate.",
      );
      stage.current?.focus();
      pumpRef.current();
    } catch (err) {
      if (token === generation.current) {
        setStarting(false);
        setMessage(String(err));
      }
    }
  }
  function record() {
    if (!running) {
      void play(true);
      return;
    }
    const now = Math.max(
      0,
      ((engine.currentTime - session.current.origin) * score.bpm * PPQ) / 60,
    );
    session.current.recordCycle = Math.floor(now / length) + 1;
    setCaptureState("armed");
    setMessage(
      "Record armed for the next loop. One pass, then automatic review.",
    );
    stage.current?.focus();
  }
  async function replay() {
    stop();
    const token = ++generation.current;
    setStarting(true);
    const lanes = takeRef.current.lanes.length
      ? takeRef.current.lanes
      : takeRef.current.patch
        ? [{ role, patch: takeRef.current.patch, notes: takeRef.current.notes }]
        : [];
    let base = createArcadeBacking(score, role, backing);
    if (backing === "without-role" || backing === "foundation") {
      const recordedRoles = new Set(lanes.map((l) => l.role));
      base = {
        ...base,
        tracks: base.tracks.map((t) => ({
          ...t,
          gain: recordedRoles.has(t.role) ? 0 : t.gain,
        })),
      };
    }
    const playback: Score = {
      ...base,
      patches: [...base.patches],
      tracks: [...base.tracks],
      patterns: [...base.patterns],
      clips: [...base.clips],
    };
    lanes.forEach((lane, i) => {
      const id = `arcade-review-${i}`,
        patchId = `${id}-patch`;
      playback.patches.push({ ...lane.patch, id: patchId });
      playback.tracks.push({
        ...track,
        id,
        name: lane.patch.name,
        patchId,
        role: lane.role,
        gain: track.gain,
      });
      playback.patterns.push({
        id,
        name: "Arcade take",
        lengthTicks: length,
        notes: lane.notes
          .filter(
            (n) =>
              n.startTick >= start - clipStart && n.startTick < end - clipStart,
          )
          .map((n) => ({
            ...n,
            startTick: n.startTick - (start - clipStart),
            durationTicks: Math.min(
              n.durationTicks,
              end - clipStart - n.startTick,
            ),
          })),
      });
      playback.clips.push({
        id,
        trackId: id,
        patternId: id,
        startTick: start,
        repeats: 1,
        transpose: 0,
      });
    });
    try {
      await engine.play(playback, {
        startTick: start,
        endTick: end,
        loop: false,
        energy: 3,
      });
      if (token !== generation.current) return;
      setStarting(false);
      setReplaying(true);
      setMessage("Replaying your captured loop with the chosen backing.");
    } catch (err) {
      if (token === generation.current) {
        setStarting(false);
        setMessage(String(err));
      }
    }
  }
  function press(id: string, action: ArcadeIntent, moveDirection = 0) {
    if (!active.current || held.current.has(id)) return;
    if (action === "rest") {
      silence();
      return;
    }
    held.current.add(id);
    if (followMovement) {
      const interval = engine.currentTime - lastMove.current.at;
      setIntensity(
        moveDirection
          ? 2
          : interval > 0 && interval < 0.24
            ? 3
            : interval > 0 && interval < 0.6
              ? 2
              : 1,
      );
      lastMove.current.at = engine.currentTime;
    }
    intentRef.current = action;
    setIntent(action);
    setDirection(moveDirection);
    const now = Math.max(
      0,
      ((engine.currentTime - session.current.origin) * score.bpm * PPQ) / 60,
    );
    session.current.ribbonUntil = now + PPQ;
    setPose(action);
    setMotion((n) => n + 1);
    if (moveDirection) {
      setFacing(moveDirection);
      setX((v) => Math.max(15, Math.min(82, v + moveDirection * 9)));
    }
  }
  function gateRibbon() {
    if (mode !== "ribbon-lead" || !active.current) return;
    session.current.ribbonUntil = 0;
    session.current.pending = [];
    finishCapturedSound();
    for (const voice of voices.current) voice.stop();
    voices.current = [];
    setSoundingIntent("rest");
  }
  function release(id: string, retainTap = false) {
    held.current.delete(id);
    if (!held.current.size) {
      setPose("idle");
      setDirection(0);
      if (!retainTap) gateRibbon();
    }
  }
  function label(action: ArcadeIntent) {
    return action === "rest"
      ? "Rest"
      : action === "reply"
        ? "Answer"
        : currentMode.actions[actions.indexOf(action)];
  }
  return (
    <section
      className="arcade"
      aria-label="Musical character arcade"
      data-mode={mode}
    >
      <header>
        <div>
          <div className="arcade-eyebrow">
            ARCADE EXPERIMENTS · PLAY YOUR WAY
          </div>
          <h3>Reedrunner · musical arena</h3>
          <p>
            {track.name} · {score.bpm} BPM ·{" "}
            {Math.ceil(length / arcadeBarTicks(score))} bar loop ·{" "}
            {role === "drums" ? "drum lane" : `${role} lane`}
          </p>
        </div>
        <div
          className="arcade-meter"
          aria-label={`Intensity ${intensity} of 3`}
        >
          {[1, 2, 3].map((n) => (
            <i key={n} className={n <= intensity ? "lit" : ""} />
          ))}
          <span>{["Calm", "Driving", "Fierce"][intensity - 1]}</span>
        </div>
      </header>
      <div className="arcade-modes" aria-label="Play mode">
        {modes.map((m) => (
          <button
            key={m.id}
            aria-pressed={mode === m.id}
            disabled={capture === "armed" || capture === "recording"}
            onClick={() => setMode(m.id)}
          >
            <strong>{m.name}</strong>
            <small>
              {m.id === "phrase-rider"
                ? "Shape a song"
                : m.id === "groove-fighter"
                  ? "Build a pocket"
                  : "Draw a melody"}
            </small>
          </button>
        ))}
      </div>
      <p className="arcade-mode-description">{currentMode.description}</p>
      <div className="arcade-settings">
        <label>
          Weapon / instrument
          <select
            aria-label="Weapon / instrument"
            value={weaponId}
            onChange={(e) => setWeaponId(e.target.value as typeof weaponId)}
          >
            {weapons.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <small>
            {role === "drums"
              ? "Percussion weapon · separate drum lane"
              : weapon.vibe}
          </small>
        </label>
        <label>
          Phrase intensity
          <select
            aria-label="Phrase intensity"
            value={followMovement ? "auto" : intensity}
            onChange={(e) => {
              setFollowMovement(e.target.value === "auto");
              if (e.target.value !== "auto")
                setIntensity(Number(e.target.value) as 1 | 2 | 3);
            }}
          >
            <option value="auto">Follow my movement</option>
            <option value="1">Calm · leave space</option>
            <option value="2">Driving · syncopation</option>
            <option value="3">Fierce · more motion</option>
          </select>
          <small>Changes rhythm and expression at the next phrase</small>
        </label>
        <label>
          Loop length
          <select
            aria-label="Arcade loop length"
            value={windowBars}
            disabled={running || starting || replaying || !!take.notes.length}
            onChange={(e) => setWindowBars(e.target.value)}
          >
            <option value="1">1 bar</option>
            <option value="2">2 bars</option>
            <option value="phrase">Selected phrase</option>
          </select>
          <small>Bounded by the selected phrase and song loop</small>
        </label>
        <label>
          Backing
          <select
            aria-label="Arcade backing"
            value={backing}
            disabled={running || starting || replaying}
            onChange={(e) => setBacking(e.target.value as ArcadeBacking)}
          >
            <option value="without-role">Song without my role</option>
            <option value="full">Full song</option>
            <option value="foundation">Bass + drums foundation</option>
            <option value="metronome">Metronome only</option>
          </select>
          <small>
            {backing === "without-role"
              ? `Leaves room for your ${role}`
              : "Backing changes take effect when you start"}
          </small>
        </label>
      </div>
      <div
        className="arcade-loop-progress"
        role="progressbar"
        aria-label="Arcade loop progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        <span style={{ width: `${progress * 100}%` }} />
      </div>
      <div className="arcade-phrase-state">
        <span>
          {capture === "armed"
            ? `COUNT IN · ${countdown} beats to record`
            : capture === "recording"
              ? "● RECORDING · one loop"
              : replaying
                ? "REPLAYING TAKE"
                : running
                  ? "JAM · nothing captured"
                  : take.notes.length
                    ? "TAKE READY TO REVIEW"
                    : "READY TO JAM"}
        </span>
        <span>
          Playing: {label(soundingIntent)}
          {intent !== soundingIntent &&
          running &&
          (mode !== "ribbon-lead" || held.current.size > 0)
            ? ` · next: ${label(intent)}`
            : ""}
        </span>
      </div>
      <div
        ref={stage}
        className={`arcade-stage arena ${running ? "arena-running" : ""}`}
        data-pose={pose}
        data-weapon={weaponId}
        tabIndex={0}
        role="group"
        aria-label="Reedrunner playable arena"
        aria-describedby="arcade-help"
        onKeyDown={(e) => {
          if (e.ctrlKey || e.metaKey || e.altKey) return;
          if (e.code === "Space") {
            e.preventDefault();
            e.stopPropagation();
            if (!e.repeat) {
              if (running || replaying) stop();
              else void play();
            }
            return;
          }
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            stop();
            return;
          }
          const input = keys[e.key.length === 1 ? e.key.toLowerCase() : e.key];
          if (!input) return;
          e.preventDefault();
          e.stopPropagation();
          if (!e.repeat) press(`key-${e.code}`, input.action, input.direction);
        }}
        onKeyUp={(e) => {
          if (keys[e.key.length === 1 ? e.key.toLowerCase() : e.key]) {
            e.preventDefault();
            e.stopPropagation();
            release(`key-${e.code}`);
          }
        }}
        onBlur={() => {
          held.current.clear();
          setPose("idle");
          setDirection(0);
          session.current.ribbonUntil = 0;
          gateRibbon();
        }}
      >
        <div className="arena-moon" aria-hidden="true" />
        <div className="arena-mountains" aria-hidden="true" />
        <div className="arena-grid" aria-hidden="true" />
        <div className="arena-caption">
          {running ? "ON THE SONG’S CLOCK" : "READY WHEN YOU ARE"}
          <span>
            {Array.from({ length: score.meter[0] }, (_, n) => (
              <i key={n} className={running && beat === n ? "lit" : ""} />
            ))}
          </span>
        </div>
        {mode === "ribbon-lead" && (
          <div
            className="arcade-ribbon"
            role="slider"
            tabIndex={0}
            aria-label="Ribbon pitch height"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(ribbon * 100)}
            aria-orientation="vertical"
            onKeyDown={(e) => {
              if (["ArrowUp", "ArrowDown"].includes(e.key)) {
                e.preventDefault();
                e.stopPropagation();
                setRibbon((v) =>
                  Math.max(
                    0,
                    Math.min(1, v + (e.key === "ArrowUp" ? 0.08 : -0.08)),
                  ),
                );
                if (!e.repeat) press(`ribbon-${e.code}`, "strike");
              }
            }}
            onKeyUp={(e) => {
              e.stopPropagation();
              release(`ribbon-${e.code}`);
            }}
            onBlur={() => {
              held.current.clear();
              session.current.ribbonUntil = 0;
              gateRibbon();
            }}
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              const rect = e.currentTarget.getBoundingClientRect();
              setRibbon(
                1 -
                  Math.max(
                    0,
                    Math.min(1, (e.clientY - rect.top) / rect.height),
                  ),
              );
              press(`ribbon-${e.pointerId}`, "strike");
            }}
            onPointerMove={(e) => {
              if (!held.current.has(`ribbon-${e.pointerId}`)) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const next =
                1 -
                Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
              setRibbon((v) => (Math.abs(v - next) > 0.035 ? next : v));
              setX(
                18 +
                  Math.max(
                    0,
                    Math.min(1, (e.clientX - rect.left) / rect.width),
                  ) *
                    62,
              );
            }}
            onPointerUp={(e) => release(`ribbon-${e.pointerId}`)}
            onPointerCancel={(e) => release(`ribbon-${e.pointerId}`)}
            onLostPointerCapture={(e) => release(`ribbon-${e.pointerId}`)}
          >
            <span>HIGH</span>
            <i style={{ bottom: `${ribbon * 85}%` }}>↝</i>
            <span>LOW · HOLD & DRAG</span>
          </div>
        )}
        <div className="arena-phantom" aria-hidden="true">
          <span>{mode === "groove-fighter" ? "♩" : "♪"}</span>
          <i />
        </div>
        <div className="runner-position" style={{ left: `${x}%` }}>
          <div
            className="runner"
            data-facing={facing}
            data-action={pose}
            key={motion}
          >
            <svg
              viewBox="0 0 160 170"
              role="img"
              aria-label={`Reedrunner holding ${weapon.name}`}
            >
              <ellipse
                cx="73"
                cy="154"
                rx="37"
                ry="8"
                fill="#111b34"
                opacity=".6"
              />
              <g className="runner-body">
                <path
                  d="M61 96 46 140 59 146 79 112 88 145 101 141 91 95"
                  fill="#27395c"
                  stroke="#a4c1c2"
                  strokeWidth="3"
                />
                <path d="m59 52-19 57 37-13 26 7-8-52" fill="#58c4b8" />
                <path d="m52 63-24 31 18 10 24-24" fill="#233f55" />
                <path d="m66 43-30-5 12 29 20 3" fill="#f5aa69" />
                <path
                  d="M58 37 Q51 9 77 10 Q102 13 100 41 L88 58 65 54Z"
                  fill="#1e3048"
                  stroke="#e5d5ac"
                  strokeWidth="4"
                />
                <path d="m65 31 29-3-5 12-22 2" fill="#f4e6bf" />
                <path d="m87 29 6 1" stroke="#223047" strokeWidth="4" />
                <path d="m95 17 11-13-3 24" fill="#6de0cb" />
                <path
                  d="m68 59 17 32 28-26"
                  fill="none"
                  stroke="#efd8b0"
                  strokeWidth="12"
                  strokeLinecap="round"
                />
                <g
                  className="runner-weapon"
                  stroke="#f4e7c2"
                  strokeWidth="4"
                  strokeLinejoin="round"
                >
                  {weaponId === "blade" ? (
                    <>
                      <path d="m103 82 39-57-4 29-28 33Z" fill="#79f0dd" />
                      <path d="m100 76 18 11M104 84l-8 12" />
                    </>
                  ) : weaponId === "staff" ? (
                    <>
                      <path d="m104 115 16-81" />
                      <circle cx="122" cy="26" r="14" fill="#ac9cff" />
                      <circle cx="122" cy="26" r="5" fill="#e5d8ff" />
                    </>
                  ) : weaponId === "bow" ? (
                    <>
                      <path
                        d="M123 19q45 47-7 91l7-91Z"
                        fill="none"
                        stroke="#ffb477"
                      />
                      <path d="m105 71 42-7m-8-5 8 5-7 7" stroke="#ffe8bc" />
                    </>
                  ) : (
                    <>
                      <path d="m100 118 27-96" />
                      <path d="m127 22 14-15 4 27-25 22Z" fill="#9ee5b8" />
                    </>
                  )}
                </g>
              </g>
            </svg>
            <div className="runner-aura" aria-hidden="true">
              {pose === "idle"
                ? ""
                : pose === "guard"
                  ? "◌"
                  : pose === "leap"
                    ? "↗ ♪"
                    : pose === "dash"
                      ? "♫ →"
                      : "✦ ♪"}
            </div>
          </div>
        </div>
        <div className="arena-floor" aria-hidden="true" />
        <span className="arena-focus-hint">
          {running ? "J K L I · R rest · Esc stop" : "Start a jam to perform"}
        </span>
      </div>
      <p id="arcade-help" className="arcade-help">
        Focus arena: <b>J</b> {currentMode.actions[0]} · <b>K / ↑</b>{" "}
        {currentMode.actions[1]} ·{" "}
        <b>{mode === "ribbon-lead" ? "L" : "L / ← →"}</b>{" "}
        {currentMode.actions[2]} · <b>I / ↓</b> {currentMode.actions[3]} ·{" "}
        <b>R</b> rest.{" "}
        {mode === "ribbon-lead"
          ? "Hold to sing; release for space. Drag the ribbon to shape pitch."
          : "One move selects the next whole bar. Your idea keeps playing without repeated tapping."}
      </p>
      <div className="arcade-actions">
        {actions.map((action, index) => (
          <button
            key={action}
            disabled={!running}
            aria-label={`${currentMode.actions[index]} · ${mode}`}
            aria-pressed={intent === action}
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              press(`pointer-${e.pointerId}`, action);
            }}
            onPointerUp={(e) => release(`pointer-${e.pointerId}`)}
            onPointerCancel={(e) => release(`pointer-${e.pointerId}`)}
            onLostPointerCapture={(e) => release(`pointer-${e.pointerId}`)}
            onClick={(e) => {
              if (e.detail === 0) {
                press("accessible-action", action);
                release("accessible-action", true);
              }
            }}
          >
            <kbd>
              {
                [
                  "J",
                  "K / ↑",
                  mode === "ribbon-lead" ? "L · ← → steer pitch" : "L / ← →",
                  "I / ↓",
                ][index]
              }
            </kbd>
            <strong>{currentMode.actions[index]}</strong>
            <small>
              {mode === "ribbon-lead" ? "hold to shape" : "next bar"}
            </small>
          </button>
        ))}
      </div>
      <div className="arcade-direction-controls" aria-label="Move with pointer">
        {[-1, 1].map((dir) => (
          <button
            key={dir}
            disabled={!running}
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              press(`direction-${e.pointerId}`, "dash", dir);
            }}
            onPointerUp={(e) => release(`direction-${e.pointerId}`)}
            onPointerCancel={(e) => release(`direction-${e.pointerId}`)}
            onLostPointerCapture={(e) => release(`direction-${e.pointerId}`)}
            onClick={(e) => {
              if (e.detail === 0) {
                press("accessible-direction", "dash", dir);
                release("accessible-direction", true);
              }
            }}
          >
            {dir < 0 ? "← Move left" : "Move right →"}
          </button>
        ))}
        <button disabled={!running} onClick={silence}>
          Rest · R
        </button>
      </div>
      <div className="ga-toolbar arcade-transport">
        <button
          disabled={running || starting || replaying}
          onClick={() => void play()}
        >
          {starting ? "Starting sound…" : "Start jam"}
        </button>
        <button
          disabled={
            starting ||
            replaying ||
            capture === "armed" ||
            capture === "recording" ||
            !!take.notes.length
          }
          onClick={record}
        >
          Record next loop
        </button>
        <button disabled={!running && !starting && !replaying} onClick={stop}>
          Stop
        </button>
        <button
          disabled={
            !take.notes.length ||
            capture === "armed" ||
            capture === "recording" ||
            starting
          }
          onClick={() => void replay()}
        >
          Replay take
        </button>
        <button
          disabled={
            !take.notes.length || capture === "armed" || capture === "recording"
          }
          onClick={() => {
            stop();
            onKeep(
              take.notes.map((n) => ({ ...n })),
              take.lanes.length === 1 ? take.lanes[0]?.patch : undefined,
              take.lanes,
            );
          }}
        >
          Keep {take.notes.length} notes
        </button>
        <button
          disabled={
            !take.notes.length || capture === "armed" || capture === "recording"
          }
          onClick={() => {
            stop();
            const empty = emptyTake();
            takeRef.current = empty;
            onTakeChange(empty);
            setCaptureState("jam");
            setMessage(
              "Take discarded. Start a new jam or record another loop.",
            );
          }}
        >
          Discard take
        </button>
        <span>
          {take.notes.length} notes · {take.lanes.length} instrument{" "}
          {take.lanes.length === 1 ? "lane" : "lanes"}
        </span>
      </div>
      <p role="status" className="arcade-status">
        {message}
      </p>
      <p className="arcade-footnote">
        Jam freely. Record captures the next loop once and stops for review.
        Kept takes become ordinary editable notes; changing weapons during
        recording creates separate instrument lanes.
      </p>
    </section>
  );
}
