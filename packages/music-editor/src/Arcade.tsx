import { useEffect, useRef, useState } from "react";
import type { Score, Note, Patch } from "@onepage/project";
import {
  createArcadePhrase,
  ticksToSeconds,
  type ArcadeAction,
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
const gestures: {
  action: ArcadeAction;
  key: string;
  name: string;
  music: string;
}[] = [
  { action: "strike", key: "J", name: "Strike", music: "motif & reply" },
  { action: "leap", key: "K / ↑", name: "Leap", music: "rising phrase" },
  { action: "dash", key: "L / ← →", name: "Dash", music: "climbing run" },
  { action: "guard", key: "I / ↓", name: "Guard", music: "settling pulse" },
];
const keys: Record<string, { action: ArcadeAction; direction?: number }> = {
  j: { action: "strike" },
  "1": { action: "strike" },
  k: { action: "leap" },
  w: { action: "leap" },
  ArrowUp: { action: "leap" },
  "2": { action: "leap" },
  l: { action: "dash", direction: 1 },
  d: { action: "dash", direction: 1 },
  ArrowRight: { action: "dash", direction: 1 },
  "3": { action: "dash", direction: 1 },
  a: { action: "dash", direction: -1 },
  ArrowLeft: { action: "dash", direction: -1 },
  i: { action: "guard" },
  s: { action: "guard" },
  ArrowDown: { action: "guard" },
  "4": { action: "guard" },
};
const MAX_NOTES = 2048;
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
  const track = score.tracks.find((t) => t.id === trackId) ?? score.tracks[0];
  const clip =
    score.clips.find((c) => c.id === clipId && c.trackId === trackId) ??
    score.clips.find((c) => c.trackId === trackId);
  const pattern = score.patterns.find((p) => p.id === clip?.patternId);
  const start = clip?.startTick ?? score.loop?.startTick ?? 0;
  const end = Math.min(
    score.lengthTicks,
    start + (pattern?.lengthTicks ?? score.lengthTicks - start),
  );
  const stage = useRef<HTMLDivElement>(null);
  const takeRef = useRef(take);
  takeRef.current = take;
  const poseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = useRef(false),
    generation = useRef(0),
    lastPitch = useRef<number | undefined>(undefined);
  const held = useRef(
    new Map<
      string,
      { action: ArcadeAction; direction: number; nextAt: number }
    >(),
  );
  const taps = useRef<number[]>([]),
    sequence = useRef(0);
  const performRef = useRef<
    (action: ArcadeAction, direction?: number, repeated?: boolean) => void
  >(() => {});
  const [running, setRunning] = useState(false),
    [starting, setStarting] = useState(false);
  const [weaponId, setWeaponId] = useState<string>(
      () =>
        weapons.find((w) => w.name === take.lanes.at(-1)?.patch.name)?.id ??
        "blade",
    ),
    [pace, setPace] = useState("auto");
  const [aggression, setAggression] = useState<1 | 2 | 3>(1),
    [beat, setBeat] = useState(0);
  const [pose, setPose] = useState<ArcadeAction | "idle">("idle"),
    [x, setX] = useState(36),
    [facing, setFacing] = useState(1),
    [motion, setMotion] = useState(0);
  const [message, setMessage] = useState(
    "Start the loop, focus the arena, then move. Every action writes a short phrase in this song.",
  );
  const weapon = weapons.find((w) => w.id === weaponId)!;
  const sound: Patch = {
    id: `arcade-${weapon.id}-${track?.role === "drums" ? "kit" : "tone"}`,
    name: weapon.name,
    waveform: track?.role === "drums" ? "noise" : weapon.waveform,
    attack: weapon.attack,
    release: weapon.release,
    brightness: weapon.brightness,
    duty: weapon.duty,
  };
  const soundRef = useRef(sound);
  soundRef.current = sound;
  function stop() {
    generation.current++;
    active.current = false;
    held.current.clear();
    engine.stop();
    setRunning(false);
    setStarting(false);
    setPose("idle");
  }
  useEffect(() => {
    const blur = () => stop();
    const hidden = () => {
      if (document.hidden) stop();
    };
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      generation.current++;
      if (poseTimer.current) clearTimeout(poseTimer.current);
      active.current = false;
      held.current.clear();
      engine.stop();
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [engine]);
  useEffect(() => {
    stop();
    lastPitch.current = undefined;
    taps.current = [];
  }, [trackId, score.id, score.bpm, start, end]);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      if (!engine.isPlaying) {
        active.current = false;
        held.current.clear();
        setRunning(false);
        setPose("idle");
        setMessage(
          "Sound stopped. Your take is preserved; start again, keep it, or discard it.",
        );
        return;
      }
      setBeat(Math.floor((engine.getPositionTick() - start) / 120) % 4);
      for (const input of held.current.values())
        if (engine.currentTime >= input.nextAt) {
          input.nextAt = engine.currentTime + ticksToSeconds(480, score.bpm);
          performRef.current(input.action, input.direction, true);
        }
    }, 30);
    return () => clearInterval(timer);
  }, [running, engine, start, score.bpm]);
  async function play() {
    const token = ++generation.current;
    held.current.clear();
    active.current = false;
    setStarting(true);
    try {
      await engine.play(score, {
        startTick: start,
        endTick: end,
        loop: true,
        energy: 3,
      });
      if (token !== generation.current) return;
      active.current = true;
      setRunning(true);
      setStarting(false);
      stage.current?.focus();
      setMessage(
        "Loop running. Tap faster for denser phrases; hold a move for one phrase each beat.",
      );
    } catch (err) {
      if (token === generation.current) {
        setStarting(false);
        setMessage(String(err));
      }
    }
  }
  function perform(action: ArcadeAction, direction = 0, repeated = false) {
    if (!active.current || !engine.isPlaying || !track) return;
    let intensity: 1 | 2 | 3 =
      pace === "auto" ? aggression : (Number(pace) as 1 | 2 | 3);
    if (pace === "auto" && !repeated) {
      const now = engine.currentTime;
      taps.current = [...taps.current.filter((t) => now - t < 1.5), now].slice(
        -5,
      );
      const interval =
        taps.current.length > 1
          ? (now - taps.current[0]) / (taps.current.length - 1)
          : 1;
      intensity = interval < 0.24 ? 3 : interval < 0.52 ? 2 : 1;
    }
    const phrase = createArcadePhrase({
      score,
      trackId: track.id,
      action,
      positionTick: engine.getPositionTick(),
      loopStartTick: start,
      loopEndTick: end,
      aggression: intensity,
      previousPitch: lastPitch.current,
      sequence: sequence.current++,
    });
    if (!phrase.notes.length) {
      setMessage(
        "At the loop edge: try on the next beat. No notes were dropped from your take.",
      );
      return;
    }
    if (takeRef.current.notes.length + phrase.notes.length > MAX_NOTES) {
      stop();
      setMessage(
        `Take full (${MAX_NOTES} note limit). Keep or discard it before playing again; this phrase was not recorded.`,
      );
      return;
    }
    const selectedSound = soundRef.current;
    // Use the transport's audio clock, including preroll, for audible/captured alignment.
    const delay = engine.getDelayToTick(phrase.startTick);
    for (const note of phrase.notes)
      engine.previewNote(
        selectedSound,
        note.pitch,
        note.velocity,
        ticksToSeconds(note.durationTicks, score.bpm),
        track.gain,
        track.pan,
        delay +
          ticksToSeconds(start + note.startTick - phrase.startTick, score.bpm),
      );
    lastPitch.current = phrase.lastPitch;
    const lanes = takeRef.current.lanes.map((lane) => ({
      patch: lane.patch,
      role: lane.role,
      notes: [...lane.notes],
    }));
    const lane = lanes.find((lane) => lane.patch.id === selectedSound.id);
    if (lane) lane.notes.push(...phrase.notes);
    else
      lanes.push({
        patch: { ...selectedSound },
        notes: phrase.notes,
        role: track.role,
      });
    const next = {
      notes: [...takeRef.current.notes, ...phrase.notes],
      patch: lanes.length === 1 ? { ...selectedSound } : null,
      lanes,
    };
    takeRef.current = next;
    onTakeChange(next);
    setAggression(intensity);
    setPose(action);
    if (poseTimer.current) clearTimeout(poseTimer.current);
    poseTimer.current = setTimeout(() => setPose("idle"), 600);
    setMotion((n) => n + 1);
    if (direction) {
      setFacing(direction);
      setX((v) =>
        Math.max(12, Math.min(82, v + direction * (intensity * 4 + 5))),
      );
    } else if (action === "dash") setX((v) => (v >= 78 ? 18 : v + 10));
    setMessage(
      `${gestures.find((g) => g.action === action)!.name}: ${phrase.description} · ${phrase.notes.length} editable notes · ${selectedSound.name}.`,
    );
  }
  performRef.current = perform;
  function press(id: string, action: ArcadeAction, direction = 0) {
    if (held.current.has(id) || !active.current) return;
    held.current.set(id, {
      action,
      direction,
      nextAt: engine.currentTime + ticksToSeconds(480, score.bpm),
    });
    perform(action, direction);
  }
  function release(id: string) {
    held.current.delete(id);
  }
  return (
    <section className="arcade" aria-label="Musical character arcade">
      <header>
        <div>
          <div className="arcade-eyebrow">PLAY A PHRASE</div>
          <h3>Reedrunner · musical arena</h3>
          <p>
            {track?.name} · {score.bpm} BPM · song tempo stays fixed
          </p>
        </div>
        <div
          className="arcade-meter"
          aria-label={`Aggression ${aggression} of 3`}
        >
          {[1, 2, 3].map((n) => (
            <i key={n} className={n <= aggression ? "lit" : ""} />
          ))}
          <span>{["Calm", "Driving", "Fierce"][aggression - 1]}</span>
        </div>
      </header>
      <div className="arcade-settings">
        <label>
          Weapon / instrument
          <select
            aria-label="Weapon / instrument"
            value={weaponId}
            onChange={(e) => setWeaponId(e.target.value)}
          >
            {weapons.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <small>
            {track?.role === "drums"
              ? "Percussion weapon · kit pitches"
              : weapon.vibe}
            {take.lanes.length > 1
              ? ` · ${take.lanes.length} weapon parts in this take`
              : ""}
          </small>
        </label>
        <label>
          Phrase intensity
          <select
            aria-label="Phrase intensity"
            value={pace}
            onChange={(e) => {
              setPace(e.target.value);
              if (e.target.value !== "auto")
                setAggression(Number(e.target.value) as 1 | 2 | 3);
            }}
          >
            <option value="auto">Follow my playing</option>
            <option value="1">Calm · eighth notes</option>
            <option value="2">Driving · syncopated</option>
            <option value="3">Fierce · sixteenth notes</option>
          </select>
          <small>Faster actions add notes, never speed up the song</small>
        </label>
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
              if (running) stop();
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
        }}
      >
        <div className="arena-moon" aria-hidden="true" />
        <div className="arena-mountains" aria-hidden="true" />
        <div className="arena-grid" aria-hidden="true" />
        <div className="arena-caption">
          {running ? "ON THE SONG’S CLOCK" : "READY WHEN YOU ARE"}
          <span>
            {[0, 1, 2, 3].map((n) => (
              <i key={n} className={running && beat === n ? "lit" : ""} />
            ))}
          </span>
        </div>
        <div className="arena-phantom" aria-hidden="true">
          <span>♪</span>
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
              {pose === "guard"
                ? "◌"
                : pose === "leap"
                  ? "↗ ♪"
                  : pose === "dash"
                    ? "♫ →"
                    : pose === "strike"
                      ? "✦ ♪"
                      : ""}
            </div>
          </div>
        </div>
        <div className="arena-floor" aria-hidden="true" />
        <span className="arena-focus-hint">
          {running
            ? "Click arena to use keys · Esc stops"
            : "Start the loop to perform"}
        </span>
      </div>
      <p id="arcade-help" className="arcade-help">
        Focus arena: <b>J</b> strike · <b>K / ↑</b> leap · <b>← → / A D</b> dash
        · <b>I / ↓</b> guard. Hold for a phrase each beat. Touch or click the
        same moves below.
      </p>
      <div className="arcade-actions">
        {gestures.map((g) => (
          <button
            key={g.action}
            disabled={!running}
            aria-label={`${g.name} · ${g.music}`}
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              press(`pointer-${e.pointerId}`, g.action);
            }}
            onPointerUp={(e) => release(`pointer-${e.pointerId}`)}
            onPointerCancel={(e) => release(`pointer-${e.pointerId}`)}
            onLostPointerCapture={(e) => release(`pointer-${e.pointerId}`)}
            onClick={(e) => {
              if (e.detail === 0) perform(g.action);
            }}
          >
            <kbd>{g.key}</kbd>
            <strong>{g.name}</strong>
            <small>{g.music}</small>
          </button>
        ))}
      </div>
      <div className="arcade-direction-controls" aria-label="Move with pointer">
        {[-1, 1].map((direction) => (
          <button
            key={direction}
            disabled={!running}
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              press(`direction-${e.pointerId}`, "dash", direction);
            }}
            onPointerUp={(e) => release(`direction-${e.pointerId}`)}
            onPointerCancel={(e) => release(`direction-${e.pointerId}`)}
            onLostPointerCapture={(e) => release(`direction-${e.pointerId}`)}
            onClick={(e) => {
              if (e.detail === 0) perform("dash", direction);
            }}
          >
            {direction < 0 ? "← Dash left" : "Dash right →"}
          </button>
        ))}
      </div>
      <div className="ga-toolbar arcade-transport">
        <button disabled={running || starting} onClick={() => void play()}>
          {starting ? "Starting sound…" : "Start fixed-tempo loop"}
        </button>
        <button disabled={!running && !starting} onClick={stop}>
          Stop
        </button>
        <button
          disabled={!take.notes.length}
          onClick={() => {
            stop();
            onKeep(
              take.notes.map((n) => ({ ...n })),
              take.lanes[0]?.patch,
              take.lanes,
            );
          }}
        >
          Keep {take.notes.length} notes
        </button>
        <button
          disabled={!take.notes.length}
          onClick={() => {
            stop();
            const empty = { notes: [], patch: null, lanes: [] };
            takeRef.current = empty;
            onTakeChange(empty);
            setMessage(
              "Take discarded. Choose another weapon or start a fresh performance.",
            );
          }}
        >
          Discard take
        </button>
        <span>
          {take.notes.length} / {MAX_NOTES} notes
        </span>
      </div>
      <p role="status" className="arcade-status">
        {message}
      </p>
      <p className="arcade-footnote">
        Moves transform the selected song’s motif and harmony into ordinary
        notes. The original song keeps playing underneath your performance.
      </p>
    </section>
  );
}
