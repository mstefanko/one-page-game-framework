import { useDialogFocus } from "./useDialogFocus";
import { useEffect, useRef, useState } from "react";
import {
  assertScore,
  createBlankScore,
  createStarter,
  STARTERS,
  type Score,
  type Note,
  type Patch,
} from "@onepage/project";
import {
  createLibrary,
  type AssetLibrary,
  type LibraryEntry,
  type SavedVersion,
} from "@onepage/asset-library";
import { AudioEngine, renderScore, encodeWav } from "@onepage/music-web-audio";
import { GameAudio } from "./GameAudio";
import { Arcade, type ArcadeLane, type ArcadeTake } from "./Arcade";
import { captureNote, getPitchForRole } from "./capture";
import {
  exportSourcePack,
  importSourcePack,
  exportLibraryPack,
  importLibraryPack,
  exportMidi,
  inspectMidi,
  convertMidi,
  createPlayerHtml,
  type MidiReview,
} from "@onepage/music-io";
import "./styles.css";
const uid = () => crypto.randomUUID();
const copy = <T,>(v: T): T => structuredClone(v);
function download(data: BlobPart, name: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const pitchName = (n: number) =>
  `${["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"][n % 12]}${Math.floor(n / 12) - 1}`;
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
type Surface = "notes" | "pad" | "arcade";
export function Composer() {
  const [score, setScore] = useState<Score | null>(null),
    [view, setView] = useState<"sketch" | "studio" | "game">("sketch"),
    [surface, setSurface] = useState<Surface>("pad");
  const [trackId, setTrackId] = useState("melody"),
    [clipId, setClipId] = useState("melody-clip"),
    [selected, setSelected] = useState<string | null>(null);
  const [history, setHistory] = useState<Score[]>([]),
    [future, setFuture] = useState<Score[]>([]),
    [status, setStatus] = useState("Choose a starter or start fresh"),
    [error, setError] = useState("");
  const [drawer, setDrawer] = useState(false),
    [entries, setEntries] = useState<LibraryEntry[]>([]),
    [versions, setVersions] = useState<SavedVersion[]>([]),
    [dialog, setDialog] = useState<"settings" | "export" | "keep" | null>(null);
  const [playing, setPlaying] = useState(false),
    [position, setPosition] = useState(0),
    [rendering, setRendering] = useState(false),
    [energy, setEnergy] = useState(3),
    [take, setTake] = useState<Note[]>([]),
    [density, setDensity] = useState(240),
    [previousTakes, setPreviousTakes] = useState<Note[][]>([]),
    [midiReview, setMidiReview] = useState<MidiReview | null>(null),
    [pendingTake, setPendingTake] = useState<Note[]>([]),
    [pendingTakePatch, setPendingTakePatch] = useState<Patch | null>(null),
    [pendingArcadeLanes, setPendingArcadeLanes] = useState<ArcadeLane[]>([]),
    [arcadeTake, setArcadeTake] = useState<ArcadeTake>({
      notes: [],
      patch: null,
      lanes: [],
    }),
    [auditionId, setAuditionId] = useState<string | null>(null),
    [sidePreview, setSidePreview] = useState(false),
    [wavRange, setWavRange] = useState<"whole" | "loop">("whole"),
    [wavTail, setWavTail] = useState(false);
  const engine = useRef(new AudioEngine()).current,
    library = useRef<AssetLibrary | null>(null),
    libraryReady = useRef<Promise<AssetLibrary> | null>(null),
    takeRef = useRef<Note[]>([]),
    arcadeTakeRef = useRef<ArcadeTake>(arcadeTake),
    navigationGeneration = useRef(0),
    unkeptTakeRef = useRef(false),
    lastPadTick = useRef<number | null>(null),
    revisions = useRef(new Map<string, number>()),
    queue = useRef(Promise.resolve()),
    current = useRef(score),
    savingFailed = useRef(false),
    pendingWrites = useRef(0),
    activeVoice = useRef<null | (() => void)>(null),
    padInput = useRef<{ pitch: number; start: number } | null>(null),
    padStart = useRef(0),
    padPointer = useRef<number | null>(null),
    [padRecording, setPadRecording] = useState(false);
  useDialogFocus(
    midiReview ? "midi" : (dialog ?? (drawer ? "library" : null)),
    () => {
      setMidiReview(null);
      closeDialog();
      setDrawer(false);
    },
  );
  current.current = score;
  takeRef.current = take;
  arcadeTakeRef.current = arcadeTake;
  unkeptTakeRef.current = Boolean(
    take.length ||
      previousTakes.length ||
      pendingTake.length ||
      arcadeTake.notes.length,
  );
  useEffect(() => {
    let live = true;
    let owned: AssetLibrary | null = null;
    const ready = createLibrary();
    libraryReady.current = ready;
    ready
      .then((lib) => {
        owned = lib;
        if (live) {
          library.current = lib;
          void refresh();
        } else lib.close();
      })
      .catch((e) => setError(message(e)));
    return () => {
      live = false;
      void queue.current.finally(() => owned?.close());
      void engine.dispose();
    };
  }, []);
  useEffect(() => {
    const timer = setInterval(() => {
      setPlaying(engine.isPlaying);
      setPosition(engine.getPositionTick());
    }, 50);
    return () => clearInterval(timer);
  }, [engine]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (
        pendingWrites.current ||
        savingFailed.current ||
        takeRef.current.length ||
        previousTakes.length ||
        pendingTake.length ||
        arcadeTakeRef.current.notes.length ||
        padInput.current
      ) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [previousTakes, pendingTake]);
  async function safely(action: () => unknown | Promise<unknown>) {
    try {
      await action();
    } catch (e) {
      setError(message(e));
    }
  }
  async function refresh() {
    try {
      if (library.current) setEntries(await library.current.list());
    } catch (e) {
      setError(message(e));
    }
  }
  function persist(next: Score) {
    pendingWrites.current += 1;
    setStatus("Saving…");
    const snapshot = copy(next);
    queue.current = queue.current
      .then(async () => {
        if (libraryReady.current) library.current = await libraryReady.current;
        if (!library.current)
          throw new Error(
            "Browser library unavailable. Download a backup to preserve your work.",
          );
        if (savingFailed.current)
          throw new Error("Save paused. Preserve your edits as a copy.");
        const saved = await library.current.saveDraft(
          snapshot,
          revisions.current.get(snapshot.id) ?? null,
        );
        revisions.current.set(snapshot.id, saved.revision);
        if (
          current.current?.id === snapshot.id &&
          JSON.stringify(current.current) === JSON.stringify(snapshot)
        )
          setStatus("Saved in this browser");
        await refresh();
      })
      .catch((e) => {
        savingFailed.current = true;
        setStatus("Unsaved • work stays in memory");
        setError(message(e));
      })
      .finally(() => {
        pendingWrites.current -= 1;
      });
  }
  function edit(change: (next: Score) => void): boolean {
    if (!score) return false;
    const next = copy(score);
    try {
      change(next);
      if (next.id !== score.id)
        throw new Error(
          "Song identity cannot change inside an edit. Open or fork the song instead.",
        );
      assertScore(next);
      setHistory((h) => [...h.slice(-79), score]);
      setFuture([]);
      setScore(next);
      persist(next);
      return true;
    } catch (e) {
      setError(message(e));
      return false;
    }
  }
  function editPatch(change: (patch: Patch) => void) {
    if (!track) return false;
    return edit((s) => {
      const target = s.tracks.find((t) => t.id === track.id)!;
      let sound = s.patches.find((p) => p.id === target.patchId)!;
      if (s.tracks.filter((t) => t.patchId === sound.id).length > 1) {
        sound = { ...sound, id: uid() };
        s.patches.push(sound);
        target.patchId = sound.id;
      }
      change(sound);
    });
  }
  function open(
    next: Score,
    fresh = false,
    target = "melody",
    nextSurface: Surface = "notes",
  ) {
    navigationGeneration.current++;
    engine.stop();
    setScore(next);
    current.current = next;
    const selectedTrack =
      next.tracks.find((t) => t.id === target) ??
      next.tracks.find((t) => t.role === target) ??
      next.tracks[0];
    setTrackId(selectedTrack?.id ?? "");
    setClipId(
      next.clips.find((c) => c.trackId === selectedTrack?.id)?.id ??
        next.clips[0]?.id ??
        "",
    );
    setSelected(null);
    setHistory([]);
    setFuture([]);
    setArcadeTake({ notes: [], patch: null, lanes: [] });
    setPendingTakePatch(null);
    setTake([]);
    setPreviousTakes([]);
    setSurface(nextSurface);
    setDrawer(false);
    setDialog(null);
    setSidePreview(false);
    setView("sketch");
    setError("");
    setStatus(fresh ? "Saving…" : "Saved in this browser");
    if (fresh) persist(next);
  }
  async function leaveSafe() {
    navigationGeneration.current++;
    if (
      takeRef.current.length ||
      previousTakes.length ||
      pendingTake.length ||
      arcadeTakeRef.current.notes.length ||
      padInput.current
    ) {
      setError(
        "Keep or explicitly discard your recorded takes before leaving this song.",
      );
      return false;
    }
    let pending: Promise<void>;
    do {
      pending = queue.current;
      await pending;
    } while (pending !== queue.current);
    if (savingFailed.current && current.current) {
      setError(
        "Your unsaved edits are still here. Preserve them as a copy or download the editable source before switching.",
      );
      return false;
    }
    return true;
  }
  async function goHome() {
    if (!(await leaveSafe())) return;
    engine.stop();
    padUp();
    setScore(null);
    setDialog(null);
    setDrawer(false);
  }
  async function editGameScore(input: Score) {
    const leaving = leaveSafe();
    const token = navigationGeneration.current;
    const source = current.current;
    if (!(await leaving)) return;
    try {
      const lib = await libraryReady.current;
      const stored = await lib?.readDraft(input.id);
      if (token !== navigationGeneration.current || current.current !== source)
        return;
      if (
        unkeptTakeRef.current ||
        takeRef.current.length ||
        arcadeTakeRef.current.notes.length ||
        padInput.current
      ) {
        setError(
          "A new take started while the snapshot was loading. Keep or discard it before loading a game snapshot.",
        );
        return;
      }
      if (stored) {
        revisions.current.set(input.id, stored.revision);
        open(stored.score);
      } else {
        const fork = copy(input);
        fork.id = uid();
        fork.title += " (game snapshot copy)";
        open(fork, true);
      }
      setSidePreview(true);
      setView("sketch");
    } catch (e) {
      setError(message(e));
    }
  }
  async function audition(id: string) {
    try {
      if (auditionId === id && engine.isPlaying) {
        engine.stop();
        setAuditionId(null);
        return;
      }
      setAuditionId(id);
      await engine.play(createStarter(id), { loop: false });
    } catch (e) {
      setError(message(e));
    }
  }
  async function newSong(starter?: string) {
    if (!(await leaveSafe())) return;
    await queue.current;
    if (savingFailed.current && score) {
      setError(
        "Download your unsaved song or preserve it as a copy before switching.",
      );
      return;
    }
    const next = starter ? createStarter(starter) : createBlankScore();
    next.id = uid();
    open(
      next,
      true,
      STARTERS.find((s) => s.id === starter)?.suggestedEdit.trackId ?? "melody",
      starter ? "notes" : "pad",
    );
    if (starter) {
      const target = STARTERS.find((s) => s.id === starter)!.suggestedEdit
        .trackId;
      const targetClip = next.clips.find((c) => c.trackId === target);
      const notes =
        next.patterns.find((p) => p.id === targetClip?.patternId)?.notes ?? [];
      const candidates =
        starter === "midnight-delivery" && notes.some((n) => n.pitch === 38)
          ? notes.filter((n) => n.pitch === 38)
          : notes;
      setSelected(
        [...candidates].sort((a, b) => b.startTick - a.startTick)[0]?.id ??
          null,
      );
    }
  }
  function undo(redo = false) {
    if (!score) return;
    const stack = redo ? future : history;
    const next = stack.at(-1);
    if (!next) return;
    if (redo) {
      setFuture(stack.slice(0, -1));
      setHistory((h) => [...h, score]);
    } else {
      setHistory(stack.slice(0, -1));
      setFuture((f) => [...f, score]);
    }
    setScore(next);
    persist(next);
  }
  async function play() {
    try {
      if (engine.isPlaying) {
        engine.stop();
        return;
      }
      if (score) await engine.play(score, { energy });
    } catch (e) {
      setError(message(e));
    }
  }
  const track = score?.tracks.find((t) => t.id === trackId) ?? score?.tracks[0],
    clip =
      score?.clips.find((c) => c.id === clipId && c.trackId === track?.id) ??
      score?.clips.find((c) => c.trackId === track?.id),
    pattern = score?.patterns.find((p) => p.id === clip?.patternId),
    patch = score?.patches.find((p) => p.id === track?.patchId),
    note = pattern?.notes.find((n) => n.id === selected);
  function selectTrack(id: string) {
    if (
      takeRef.current.length ||
      previousTakes.length ||
      pendingTake.length ||
      arcadeTakeRef.current.notes.length ||
      padInput.current
    ) {
      setError(
        "Keep or discard the recorded takes before changing their target part.",
      );
      return;
    }
    if (!sidePreview) engine.stop();
    lastPadTick.current = null;
    finishPadNote();
    setPadRecording(false);
    setTake([]);
    setPreviousTakes([]);
    setTrackId(id);
    setClipId(score?.clips.find((c) => c.trackId === id)?.id ?? "");
    setSelected(null);
    return true;
  }
  function closeDialog() {
    setDialog(null);
    setPendingTake([]);
    setPendingTakePatch(null);
    setPendingArcadeLanes([]);
  }
  function requestKeep(
    notes: Note[],
    performancePatch?: Patch,
    lanes?: ArcadeLane[],
  ) {
    if (!notes.length) return;
    padUp();
    setPendingTake(copy(notes));
    setPendingTakePatch(performancePatch ? copy(performancePatch) : null);
    setPendingArcadeLanes(copy(lanes ?? []));
    setDrawer(false);
    setDialog("keep");
  }
  function keepNotes(notes: Note[], mode: "new" | "replace") {
    if (!pattern || !notes.length) return;
    if (pendingArcadeLanes.length > 1 && mode === "replace") return;
    if (
      pendingTakePatch &&
      notes.some((n) => n.startTick + n.durationTicks > pattern.lengthTicks)
    ) {
      setError(
        "This phrase became shorter after recording. Restore its original length before keeping the Arcade take; all captured notes are preserved.",
      );
      return;
    }
    const freeze = (source: Note[]) =>
      source.map((n) => ({
        ...n,
        id: uid(),
        startTick: Math.min(n.startTick, pattern.lengthTicks - 1),
        durationTicks: Math.min(
          n.durationTicks,
          pattern.lengthTicks - Math.min(n.startTick, pattern.lengthTicks - 1),
        ),
      }));
    let success = false;
    if (mode === "replace") {
      const frozen = freeze(notes).map((n) => ({
        ...n,
        pitch: n.pitch - (pendingTakePatch ? (clip?.transpose ?? 0) : 0),
      }));
      if (frozen.some((n) => n.pitch < 0 || n.pitch > 127)) {
        setError(
          "This clip's transposition cannot preserve these captured pitches. Add the take as a new part instead.",
        );
        return;
      }
      success = edit((s) => {
        s.patterns.find((p) => p.id === pattern.id)!.notes = frozen;
        if (pendingTakePatch) {
          const keptPatch = { ...pendingTakePatch, id: uid() };
          s.patches.push(keptPatch);
          s.tracks.find((t) => t.id === track!.id)!.patchId = keptPatch.id;
        }
      });
    } else {
      const lanes = (
        pendingArcadeLanes.length
          ? pendingArcadeLanes
          : [{ patch: pendingTakePatch ?? patch!, notes, role: track!.role }]
      ).map((lane) => ({
        ...lane,
        trackId: uid(),
        patternId: uid(),
        clipId: uid(),
      }));
      success = edit((s) => {
        for (const lane of lanes) {
          const newPatch = { ...lane.patch, id: uid() };
          s.patches.push(newPatch);
          s.tracks.push({
            ...track!,
            role: lane.role,
            id: lane.trackId,
            name: pendingArcadeLanes.length
              ? `${lane.patch.name} take`
              : `${track!.name} take`,
            patchId: newPatch.id,
          });
          s.patterns.push({
            id: lane.patternId,
            name: "Kept performance",
            lengthTicks: pattern.lengthTicks,
            notes: freeze(lane.notes),
          });
          s.clips.push({
            id: lane.clipId,
            trackId: lane.trackId,
            patternId: lane.patternId,
            startTick: clip?.startTick ?? 0,
            repeats: 1,
            transpose: 0,
          });
        }
      });
      if (success) {
        setTrackId(lanes[0]!.trackId);
        setClipId(lanes[0]!.clipId);
      }
    }
    if (!success) return;
    setTake([]);
    setPreviousTakes([]);
    setDialog(null);
    setPendingTake([]);
    if (pendingTakePatch) setArcadeTake({ notes: [], patch: null, lanes: [] });
    setPendingTakePatch(null);
    setPendingArcadeLanes([]);
    setSurface("notes");
  }
  async function padDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!score || !patch || !track) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const pointer = e.pointerId;
    padPointer.current = pointer;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = Math.max(
      0,
      Math.min(0.999, (e.clientY - rect.top) / rect.height),
    );
    try {
      await engine.enable();
      if (!engine.isPlaying || lastPadTick.current === null)
        await engine.play(score, {
          energy,
          startTick: clip?.startTick ?? 0,
          endTick:
            (clip?.startTick ?? 0) +
            (pattern?.lengthTicks ?? score.lengthTicks),
          loop: true,
        });
      if (padPointer.current !== pointer) return;
      padStart.current = engine.getPositionTick();
      lastPadTick.current = padStart.current;
      setPadRecording(true);
      padAt(y, true);
    } catch (err) {
      setError(message(err));
    }
  }
  function padMove(e: React.PointerEvent<HTMLDivElement>, force = false) {
    const rect = e.currentTarget.getBoundingClientRect(),
      y = Math.max(0, Math.min(0.999, (e.clientY - rect.top) / rect.height));
    padAt(y, force);
  }
  function padAt(y: number, force = false) {
    if (!patch || !track || (!padInput.current && !force)) return;
    const pitch = getPitchForRole(track.role, y, score!.scale);
    const now = engine.getPositionTick();
    if (
      padInput.current &&
      padInput.current.pitch === pitch &&
      Math.abs(now - padInput.current.start) < density
    )
      return;
    finishPadNote();
    padInput.current = { pitch, start: now };
    activeVoice.current = engine.previewNote(
      patch,
      pitch,
      0.75,
      1,
      track.gain,
      track.pan,
    );
  }
  function finishPadNote(commit = true): Note | undefined {
    activeVoice.current?.();
    activeVoice.current = null;
    const input = padInput.current;
    padInput.current = null;
    if (!input || !pattern) return;
    const end = engine.getPositionTick(),
      rangeStart = clip?.startTick ?? 0,
      rangeEnd = rangeStart + pattern.lengthTicks;
    const duration = Math.max(
      1,
      Math.round(
        end >= input.start ? end - input.start : rangeEnd - input.start,
      ),
    );
    const captured = captureNote({
      id: uid(),
      positionTick: Math.round(input.start),
      loopStartTick: rangeStart,
      loopEndTick: rangeEnd,
      durationTicks: duration,
      pitch: input.pitch,
      velocity: 0.75,
    });
    if (commit) setTake((t) => [...t.slice(-255), captured]);
    return captured;
  }
  function padUp() {
    padPointer.current = null;
    finishPadNote();
    setPadRecording(false);
  }
  useEffect(() => {
    const timer = setInterval(() => {
      if (!pattern || lastPadTick.current === null) return;
      const now = engine.getPositionTick();
      if (!engine.isPlaying) {
        finishPadNote();
        lastPadTick.current = null;
        setPadRecording(false);
        return;
      }
      const input = padInput.current;
      if (now < lastPadTick.current) {
        const tail = finishPadNote(false);
        const completed = [...takeRef.current, ...(tail ? [tail] : [])];
        if (completed.length)
          setPreviousTakes((t) => [completed, ...t].slice(0, 2));
        setTake([]);
        if (input && patch && track && padPointer.current !== null) {
          padInput.current = { pitch: input.pitch, start: now };
          activeVoice.current = engine.previewNote(
            patch,
            input.pitch,
            0.75,
            1,
            track.gain,
            track.pan,
          );
        }
      } else if (input && now - input.start >= density && patch && track) {
        finishPadNote();
        padInput.current = { pitch: input.pitch, start: now };
        activeVoice.current = engine.previewNote(
          patch,
          input.pitch,
          0.75,
          1,
          track.gain,
          track.pan,
        );
      }
      lastPadTick.current = now;
    }, 25);
    return () => clearInterval(timer);
  }, [patch, track, pattern, density, score]);
  useEffect(() => {
    const blur = () => {
      padPointer.current = null;
      finishPadNote();
      setPadRecording(false);
    };
    window.addEventListener("blur", blur);
    return () => window.removeEventListener("blur", blur);
  }, [pattern]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input,select,textarea,button"))
        return;
      if (e.code === "Space" && !sidePreview && view !== "game") {
        e.preventDefault();
        void play();
      }
      if (e.key >= "1" && e.key <= "4" && score?.tracks[Number(e.key) - 1])
        selectTrack(score.tracks[Number(e.key) - 1]!.id);
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        undo(e.shiftKey);
      }
      if (e.key === "Delete" && selected && pattern)
        edit((s) => {
          s.patterns.find((p) => p.id === pattern.id)!.notes = s.patterns
            .find((p) => p.id === pattern.id)!
            .notes.filter((n) => n.id !== selected);
        });
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });
  async function exportWav() {
    if (!score) return;
    setRendering(true);
    setError("");
    try {
      const audio = await renderScore(copy(score), {
        loops: 1,
        startTick: wavRange === "loop" ? score.loop?.startTick : 0,
        endTick: wavRange === "loop" ? score.loop?.endTick : score.lengthTicks,
        tailSeconds: wavTail
          ? Math.max(0.4, ...score.patches.map((p) => p.release))
          : 0,
      });
      download(
        encodeWav(audio).buffer as ArrayBuffer,
        `${score.title}.wav`,
        "audio/wav",
      );
    } catch (e) {
      setError(message(e));
    } finally {
      setRendering(false);
    }
  }
  function changeLength(value: number) {
    if (!score || !Number.isInteger(value) || value < 120) return;
    edit((s) => {
      const old = s.lengthTicks;
      if (
        value < old &&
        s.clips.some(
          (c) =>
            c.startTick +
              s.patterns.find((p) => p.id === c.patternId)!.lengthTicks *
                c.repeats >
            value,
        )
      )
        throw new Error(
          "Shorter length would truncate clips. Resize or remove those clips first.",
        );
      s.lengthTicks = value;
      if (s.loop?.endTick === old) s.loop.endTick = value;
    });
  }
  return (
    <div className="pocket-app">
      <header className="topbar">
        <button className="brand" onClick={() => void goHome()}>
          ▦{" "}
          <span>
            POCKET<span className="accent">SCORE</span>
          </span>
        </button>
        <span className="tiny">A SMALL STUDIO FOR BIG MOMENTS</span>
        <button
          className="quiet"
          onClick={() => {
            setDialog(null);
            setMidiReview(null);
            setDrawer(!drawer);
            void refresh();
          }}
        >
          Library
        </button>
      </header>
      {error && (
        <div className="error" role="alert">
          {error}
          <button onClick={() => setError("")}>Dismiss</button>
          {score && (
            <button
              onClick={() => {
                const next = copy(score);
                next.id = uid();
                next.title += " (recovered copy)";
                savingFailed.current = false;
                open(next, true, trackId, surface);
              }}
            >
              Preserve as a copy
            </button>
          )}
        </div>
      )}
      {!score ? (
        <main className="home">
          <div className="eyebrow">MAKE SOMETHING ONLY YOU COULD MAKE</div>
          <h1>
            Score a moment
            <br />
            in your game<span className="accent">.</span>
          </h1>
          <p className="intro">
            Pick a small beginning. Move a note, find a sound, make it yours.
          </p>
          <div className="home-actions">
            <button className="primary" onClick={() => void newSong()}>
              ＋ New song / live pad
            </button>
            <label className="button">
              Open song / MIDI
              <input
                type="file"
                accept=".json,.opmusic,.zip,.mid,.midi"
                hidden
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    if (file.size > 8_000_000)
                      throw new Error("File too large");
                    if (/\.midi?$/i.test(file.name)) {
                      setMidiReview(
                        inspectMidi(new Uint8Array(await file.arrayBuffer())),
                      );
                      return;
                    }
                    const next: unknown = /\.json$/i.test(file.name)
                      ? JSON.parse(await file.text())
                      : importSourcePack(
                          new Uint8Array(await file.arrayBuffer()),
                        );
                    assertScore(next);
                    next.id = uid();
                    open(next, true);
                  } catch (err) {
                    setError(message(err));
                  }
                }}
              />
            </label>
          </div>
          <div className="section-label">
            SIX ORIGINAL STARTERS <span>NO MUSIC THEORY REQUIRED</span>
          </div>
          <div className="starter-grid">
            {STARTERS.map((s, i) => (
              <article className={`starter starter-${i}`} key={s.id}>
                <div className="starter-art">
                  {["☾", "✦", "❋", "⌁", "◉", "⌂"][i]}
                  <span>{s.moment}</span>
                </div>
                <div className="starter-copy">
                  <small>
                    {s.playback === "loop" ? "↻ LOOP" : "↗ ONE-SHOT"} · {s.bpm}{" "}
                    BPM
                  </small>
                  <h2>{s.title}</h2>
                  <p>{s.description}</p>
                  <p className="starter-hint">
                    Try this: {s.suggestedEdit.hint}
                  </p>
                  <div className="starter-actions">
                    <button onClick={() => void audition(s.id)}>
                      {auditionId === s.id && playing ? "■ Stop" : "▶ Listen"}
                    </button>
                    <button onClick={() => void newSong(s.id)}>
                      Make it yours →
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <footer>
            Original notes. Your direction. Saved on this device — download a
            backup to keep a portable copy.
          </footer>
        </main>
      ) : (
        <>
          <div className="songbar">
            <div>
              <input
                aria-label="Song title"
                className="song-title"
                value={score.title}
                onChange={(e) =>
                  edit((s) => {
                    s.title = e.target.value;
                  })
                }
              />
              <div className="save-status" role="status">
                ● {status}
              </div>
            </div>
            <div className="transport">
              <button
                className={playing ? "primary playing" : "primary"}
                disabled={sidePreview || view === "game"}
                title={
                  sidePreview || view === "game"
                    ? "Use Play and Pause in the game preview"
                    : undefined
                }
                onClick={() => void play()}
              >
                {playing ? "■ Stop" : "▶ Play"}
              </button>
              <span className="time">
                {(position / 480).toFixed(1)} <small>BEATS</small>
              </span>
              <button
                onClick={() => {
                  setDrawer(false);
                  setDialog("settings");
                }}
              >
                {score.bpm} BPM ·{" "}
                {score.playback === "loop" ? "↻ Loop" : "One-shot"}
              </button>
              <button
                onClick={() => undo()}
                disabled={!history.length}
                aria-label="Undo"
              >
                ↶
              </button>
              <button
                onClick={() => undo(true)}
                disabled={!future.length}
                aria-label="Redo"
              >
                ↷
              </button>
              <button
                onClick={() => {
                  setDrawer(false);
                  setDialog("export");
                }}
              >
                ↓ Export
              </button>
            </div>
          </div>
          <nav className="modebar">
            {(["sketch", "studio", "game"] as const).map((v) => (
              <button
                key={v}
                className={view === v ? "active" : ""}
                onClick={() => {
                  if (!sidePreview) engine.stop();
                  setView(v);
                  if (v === "sketch") setSurface(sidePreview ? "notes" : "pad");
                }}
              >
                {v === "game" ? "Game audio" : v[0]!.toUpperCase() + v.slice(1)}
              </button>
            ))}
            {view !== "game" && (
              <button
                className={sidePreview ? "active" : ""}
                onClick={() => {
                  padUp();
                  engine.stop();
                  setSidePreview((v) => !v);
                  setSurface("notes");
                }}
              >
                {" "}
                {sidePreview
                  ? "Close game preview"
                  : "Preview game beside editor"}
              </button>
            )}
            <span>
              {view === "sketch"
                ? "FOLLOW YOUR EAR"
                : view === "studio"
                  ? "SHAPE THE WHOLE PHRASE"
                  : "GAME AUDIO WORKSPACE"}
            </span>
          </nav>
          <div
            className={
              sidePreview && view !== "game"
                ? "composition-layout with-game-preview"
                : "composition-layout"
            }
          >
            {(view === "game" || sidePreview) && (
              <div className={view === "game" ? "full-game" : "side-game"}>
                <GameAudio
                  score={score}
                  onEditScore={(next) => void editGameScore(next)}
                  engine={engine}
                />
                {sidePreview && view !== "game" && (
                  <p className="hint">
                    Edit notes while this checkpoint stays visible. Game preview
                    owns sound; use its Play/Pause and Preview current draft
                    controls. Close preview to perform on the pad or Arcade.
                  </p>
                )}
              </div>
            )}
            {view !== "game" && (
              <main className="workspace">
                <aside className="parts">
                  <div className="section-label">
                    PARTS <span>{score.tracks.length}/32</span>
                  </div>
                  {score.tracks.map((t, i) => (
                    <button
                      className={`part ${track?.id === t.id ? "selected" : ""}`}
                      key={t.id}
                      onClick={() => selectTrack(t.id)}
                    >
                      <span className="part-number">{i + 1}</span>
                      <span>
                        <strong>{t.name}</strong>
                        <small>
                          {score.patches.find((p) => p.id === t.patchId)?.name}
                        </small>
                      </span>
                      <span>⌁</span>
                    </button>
                  ))}
                  <button
                    className="add-part"
                    onClick={() => {
                      if (
                        takeRef.current.length ||
                        previousTakes.length ||
                        pendingTake.length ||
                        arcadeTakeRef.current.notes.length ||
                        padInput.current
                      ) {
                        setError(
                          "Keep or discard your recorded takes before adding another part.",
                        );
                        return;
                      }
                      const id = uid(),
                        p = uid(),
                        c = uid();
                      const success = edit((s) => {
                        const sound = { ...s.patches[0]!, id: uid() };
                        s.patches.push(sound);
                        s.tracks.push({
                          id,
                          name: `Part ${s.tracks.length + 1}`,
                          role: "melody",
                          patchId: sound.id,
                          gain: 0.6,
                          pan: 0,
                          minEnergy: 1,
                        });
                        s.patterns.push({
                          id: p,
                          name: "New pattern",
                          lengthTicks: s.lengthTicks,
                          notes: [],
                        });
                        s.clips.push({
                          id: c,
                          trackId: id,
                          patternId: p,
                          startTick: 0,
                          repeats: 1,
                          transpose: 0,
                        });
                      });
                      if (success) {
                        setTrackId(id);
                        setClipId(c);
                      }
                    }}
                  >
                    ＋ Add part
                  </button>
                  <div className="part-help">
                    Keys 1–4 select a part.
                    <br />
                    Space plays or stops.
                    <br />
                    Your notes stay editable.
                  </div>
                </aside>
                <section className="composition">
                  <div className="section-strip">
                    {score.sections.map((s) => (
                      <button
                        key={s.id}
                        disabled={sidePreview}
                        title={
                          sidePreview
                            ? "Use the game preview transport"
                            : undefined
                        }
                        onClick={() =>
                          void engine
                            .play(score, {
                              startTick: s.startTick,
                              endTick: s.startTick + s.lengthTicks,
                              loop: false,
                              energy,
                            })
                            .catch((e) => setError(message(e)))
                        }
                      >
                        {s.name} <small>{s.lengthTicks / 480} beats</small>
                      </button>
                    ))}
                    <button
                      onClick={() =>
                        edit((s) =>
                          s.sections.push({
                            id: uid(),
                            name: `Section ${s.sections.length + 1}`,
                            startTick: 0,
                            lengthTicks: s.lengthTicks,
                          }),
                        )
                      }
                    >
                      ＋ Section marker
                    </button>
                  </div>
                  {view === "studio" && (
                    <div className="arrangement">
                      <div className="section-label">
                        ARRANGEMENT{" "}
                        <span>SELECT A CLIP TO EDIT ITS PATTERN</span>
                      </div>
                      {score.tracks.map((t) => (
                        <div className="arrange-row" key={t.id}>
                          <span>{t.name}</span>
                          <div>
                            {score.clips
                              .filter((c) => c.trackId === t.id)
                              .map((c) => (
                                <button
                                  key={c.id}
                                  className={
                                    clip?.id === c.id ? "selected" : ""
                                  }
                                  style={{
                                    left: `${(100 * c.startTick) / score.lengthTicks}%`,
                                    width: `${(100 * (score.patterns.find((p) => p.id === c.patternId)?.lengthTicks ?? 0) * c.repeats) / score.lengthTicks}%`,
                                  }}
                                  onClick={() => {
                                    if (!selectTrack(t.id)) return;
                                    setClipId(c.id);
                                    setSurface("notes");
                                  }}
                                >
                                  {
                                    score.patterns.find(
                                      (p) => p.id === c.patternId,
                                    )?.name
                                  }{" "}
                                  ×{c.repeats}
                                </button>
                              ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {view === "studio" && clip && (
                    <div className="clip-controls">
                      <strong>Selected clip</strong>
                      {(["startTick", "repeats", "transpose"] as const).map(
                        (key) => (
                          <label key={key}>
                            {key}
                            <input
                              type="number"
                              value={clip[key]}
                              onChange={(e) =>
                                edit((s) => {
                                  s.clips.find((c) => c.id === clip.id)![key] =
                                    Number(e.target.value);
                                })
                              }
                            />
                          </label>
                        ),
                      )}
                      <button
                        onClick={() =>
                          edit((s) => {
                            const end =
                              clip.startTick +
                              pattern!.lengthTicks * clip.repeats;
                            if (end + pattern!.lengthTicks > s.lengthTicks)
                              throw new Error(
                                "Extend song length in settings before adding another clip.",
                              );
                            s.clips.push({
                              ...clip,
                              id: uid(),
                              startTick: end,
                              repeats: 1,
                            });
                          })
                        }
                      >
                        Duplicate clip after
                      </button>
                    </div>
                  )}
                  {surface !== "arcade" && arcadeTake.notes.length > 0 && (
                    <div className="arcade-preserved-take" role="status">
                      Arcade take preserved · {arcadeTake.notes.length} notes ·{" "}
                      {arcadeTake.lanes
                        .map((lane) => lane.patch.name)
                        .join(" + ")}
                      <button onClick={() => setSurface("arcade")}>
                        Return to Arcade take
                      </button>
                    </div>
                  )}
                  <div className="editor-heading">
                    <div>
                      <div className="eyebrow">
                        {track?.role === "drums"
                          ? "BUILD A RHYTHM"
                          : "A LITTLE ROOM TO EXPLORE"}
                      </div>
                      <h2>
                        {track?.name} <span>{pattern?.name}</span>
                      </h2>
                    </div>
                    <div className="surface-tabs">
                      {(["notes", "pad", "arcade"] as const).map((v) => (
                        <button
                          key={v}
                          className={surface === v ? "active" : ""}
                          disabled={
                            (sidePreview && v !== "notes") ||
                            (v === "pad" && arcadeTake.notes.length > 0)
                          }
                          onClick={() => setSurface(v)}
                        >
                          {v === "pad"
                            ? "Live pad"
                            : v === "arcade"
                              ? "Arcade · lab"
                              : "Notes"}
                        </button>
                      ))}
                    </div>
                  </div>
                  {surface === "arcade" && track ? (
                    <Arcade
                      score={score}
                      trackId={track.id}
                      clipId={clip?.id}
                      take={arcadeTake}
                      onTakeChange={(next) => {
                        arcadeTakeRef.current = next;
                        setArcadeTake(next);
                      }}
                      onKeep={requestKeep}
                      engine={engine}
                    />
                  ) : surface === "pad" ? (
                    <div className="pad-section">
                      <div
                        className={`live-pad ${padRecording ? "recording" : ""}`}
                        onPointerDown={(e) => void padDown(e)}
                        onPointerMove={(e) => padMove(e)}
                        onPointerUp={padUp}
                        onPointerCancel={padUp}
                        role="application"
                        aria-label={`Live pad for ${track?.name}: drag vertically to change pitch`}
                      >
                        <span className="pad-high">
                          HIGH {track?.role === "drums" ? "HAT" : "NOTES"}
                        </span>
                        <div>
                          <div className="pad-orbit">＋</div>
                          <h3>
                            {padRecording
                              ? "You’re making a take"
                              : "Touch a sound. Follow it."}
                          </h3>
                          <p>
                            {track?.name} · {patch?.name}
                            <br />
                            Hold and move up or down. Lift to leave space.
                          </p>
                        </div>
                        <span className="pad-low">
                          LOW {track?.role === "drums" ? "KICK" : "NOTES"}
                        </span>
                      </div>
                      <div className="pad-controls">
                        <label>
                          Pulse spacing{" "}
                          <select
                            value={density}
                            onChange={(e) => setDensity(Number(e.target.value))}
                          >
                            <option value={480}>Relaxed</option>
                            <option value={240}>Moving</option>
                            <option value={120}>Busy</option>
                          </select>
                        </label>
                        <span>{take.length} captured notes</span>
                        <button
                          disabled={!take.length}
                          onClick={() => requestKeep(take)}
                          className="primary"
                        >
                          Keep take → notes
                        </button>
                        <button
                          disabled={!take.length && !previousTakes.length}
                          onClick={() => {
                            setTake([]);
                            setPreviousTakes([]);
                            setPendingTake([]);
                          }}
                        >
                          Discard unkept takes
                        </button>
                      </div>
                      <div
                        className="pad-keys"
                        aria-label="Tap notes with buttons"
                      >
                        {Array.from({ length: 8 }, (_, i) => {
                          const pitch = getPitchForRole(
                            track?.role ?? "melody",
                            1 - (i + 0.5) / 8,
                            score.scale,
                          );
                          return (
                            <button
                              key={i}
                              onClick={() =>
                                void safely(async () => {
                                  if (!patch || !track || !pattern) return;
                                  try {
                                    await engine.enable();
                                    engine.previewNote(
                                      patch,
                                      pitch,
                                      0.75,
                                      0.25,
                                      track.gain,
                                      track.pan,
                                    );
                                    const start = engine.isPlaying
                                      ? (((engine.getPositionTick() -
                                          (clip?.startTick ?? 0)) %
                                          pattern.lengthTicks) +
                                          pattern.lengthTicks) %
                                        pattern.lengthTicks
                                      : (take.length * density) %
                                        pattern.lengthTicks;
                                    setTake((t) => [
                                      ...t,
                                      captureNote({
                                        positionTick: start,
                                        loopStartTick: 0,
                                        loopEndTick: pattern.lengthTicks,
                                        pitch,
                                        velocity: 0.75,
                                        durationTicks: density * 0.8,
                                      }),
                                    ]);
                                  } catch (e) {
                                    setError(message(e));
                                  }
                                })
                              }
                            >
                              {track?.role === "drums"
                                ? ({
                                    36: "Kick",
                                    38: "Snare",
                                    42: "Hat",
                                    46: "Open hat",
                                  }[pitch] ?? pitchName(pitch))
                                : pitchName(pitch)}
                            </button>
                          );
                        })}
                      </div>
                      {previousTakes.map((notes, i) => (
                        <button
                          key={i}
                          className="previous-take"
                          onClick={() => requestKeep(notes)}
                        >
                          Keep previous take {i + 1} · {notes.length} notes
                        </button>
                      ))}
                      <p className="hint">
                        The pad uses your selected part’s sound. One phrase
                        loops while you play; lifting leaves rests in the same
                        pass. Keep chooses a new part or replaces this linked
                        pattern. A completed pass moves into the two-pass
                        history. Tempo stays at {score.bpm} BPM.
                      </p>
                    </div>
                  ) : (
                    pattern && (
                      <>
                        <div className="pattern-tools">
                          <span>
                            {pattern.lengthTicks / 480} beats ·{" "}
                            {pattern.notes.length} notes ·{" "}
                            {
                              score.clips.filter(
                                (c) => c.patternId === pattern.id,
                              ).length
                            }{" "}
                            linked clip(s)
                          </span>
                          <button
                            onClick={() => {
                              const id = uid();
                              edit((s) => {
                                const p = copy(pattern);
                                p.id = id;
                                p.name += " copy";
                                p.notes = p.notes.map((n) => ({
                                  ...n,
                                  id: uid(),
                                }));
                                s.patterns.push(p);
                                s.clips.find(
                                  (c) => c.id === clip!.id,
                                )!.patternId = id;
                              });
                            }}
                          >
                            Make unique
                          </button>
                          <button
                            onClick={() =>
                              edit((s) => {
                                const p = s.patterns.find(
                                  (p) => p.id === pattern.id,
                                )!;
                                const n = {
                                  id: uid(),
                                  startTick: 0,
                                  durationTicks: 240,
                                  pitch: track?.role === "bass" ? 45 : 69,
                                  velocity: 0.8,
                                };
                                p.notes.push(n);
                                setSelected(n.id);
                              })
                            }
                          >
                            ＋ Note
                          </button>
                        </div>
                        {track?.role === "drums" ? (
                          <div className="drum-grid">
                            {[
                              [42, "Closed hat"],
                              [38, "Snare"],
                              [36, "Kick"],
                            ].map(([pitch, label]) => (
                              <div className="drum-row" key={pitch}>
                                <strong>{label}</strong>
                                {Array.from(
                                  {
                                    length: Math.ceil(
                                      pattern.lengthTicks / 240,
                                    ),
                                  },
                                  (_, i) => {
                                    const n = pattern.notes.find(
                                      (n) =>
                                        n.pitch === pitch &&
                                        n.startTick === i * 240,
                                    );
                                    return (
                                      <button
                                        key={i}
                                        aria-label={`${label} step ${i + 1}`}
                                        aria-pressed={!!n}
                                        className={`${n ? "on" : ""} ${i % 4 === 0 ? "beat" : ""}`}
                                        onClick={() => {
                                          edit((s) => {
                                            const p = s.patterns.find(
                                              (p) => p.id === pattern.id,
                                            )!;
                                            if (n)
                                              p.notes = p.notes.filter(
                                                (v) => v.id !== n.id,
                                              );
                                            else
                                              p.notes.push({
                                                id: uid(),
                                                pitch: Number(pitch),
                                                startTick: i * 240,
                                                durationTicks: Math.min(
                                                  90,
                                                  p.lengthTicks - i * 240,
                                                ),
                                                velocity: 0.75,
                                              });
                                          });
                                        }}
                                      />
                                    );
                                  },
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <PianoRoll
                            pattern={pattern}
                            selected={selected}
                            position={position}
                            onSelect={setSelected}
                            onAdd={(startTick, pitch) => {
                              const id = uid();
                              edit((s) => {
                                s.patterns
                                  .find((p) => p.id === pattern.id)!
                                  .notes.push({
                                    id,
                                    startTick,
                                    durationTicks: Math.min(
                                      240,
                                      pattern.lengthTicks - startTick,
                                    ),
                                    pitch,
                                    velocity: 0.8,
                                  });
                              });
                              setSelected(id);
                              if (patch && !sidePreview)
                                void engine
                                  .enable()
                                  .then(() => engine.previewNote(patch, pitch));
                            }}
                          />
                        )}
                        <div className="note-inspector">
                          {note ? (
                            <>
                              <strong>{pitchName(note.pitch)}</strong>
                              {(
                                [
                                  "pitch",
                                  "startTick",
                                  "durationTicks",
                                  "velocity",
                                ] as const
                              ).map((key) => (
                                <label key={key}>
                                  {key === "startTick"
                                    ? "Start tick"
                                    : key === "durationTicks"
                                      ? "Length ticks"
                                      : key}
                                  <input
                                    type="number"
                                    value={note[key]}
                                    step={key === "velocity" ? 0.05 : 1}
                                    min={key === "durationTicks" ? 1 : 0}
                                    max={
                                      key === "pitch"
                                        ? 127
                                        : key === "velocity"
                                          ? 1
                                          : pattern.lengthTicks
                                    }
                                    onChange={(e) =>
                                      edit((s) => {
                                        s.patterns
                                          .find((p) => p.id === pattern.id)!
                                          .notes.find((n) => n.id === note.id)![
                                          key
                                        ] = Number(e.target.value);
                                      })
                                    }
                                  />
                                </label>
                              ))}
                              <button
                                onClick={() =>
                                  edit((s) => {
                                    s.patterns.find(
                                      (p) => p.id === pattern.id,
                                    )!.notes = s.patterns
                                      .find((p) => p.id === pattern.id)!
                                      .notes.filter((n) => n.id !== note.id);
                                    setSelected(null);
                                  })
                                }
                              >
                                Delete note
                              </button>
                            </>
                          ) : (
                            <span>
                              Click a note to edit it. Click empty space to add
                              one. All changes can be undone.
                            </span>
                          )}
                        </div>
                        <details className="note-list">
                          <summary>
                            Accessible note list ({pattern.notes.length})
                          </summary>
                          {[...pattern.notes]
                            .sort((a, b) => a.startTick - b.startTick)
                            .map((n) => (
                              <button
                                key={n.id}
                                onClick={() => setSelected(n.id)}
                              >
                                {pitchName(n.pitch)} · tick {n.startTick} ·{" "}
                                {n.durationTicks} ticks
                              </button>
                            ))}
                        </details>
                      </>
                    )
                  )}
                </section>
                <aside className="inspector">
                  <div className="section-label">SOUND & MIX</div>
                  {track && patch && (
                    <>
                      <label>
                        Part name
                        <input
                          value={track.name}
                          onChange={(e) =>
                            edit((s) => {
                              s.tracks.find((t) => t.id === track.id)!.name =
                                e.target.value;
                            })
                          }
                        />
                      </label>
                      <label>
                        Instrument
                        <select
                          value={patch.waveform}
                          onChange={(e) =>
                            editPatch((sound) => {
                              sound.waveform = e.target
                                .value as Patch["waveform"];
                              sound.name = e.target.value;
                            })
                          }
                        >
                          {[
                            "pulse",
                            "triangle",
                            "sine",
                            "sawtooth",
                            "noise",
                          ].map((v) => (
                            <option key={v}>{v}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Role
                        <select
                          value={track.role}
                          onChange={(e) =>
                            edit((s) => {
                              s.tracks.find((t) => t.id === track.id)!.role = e
                                .target.value as typeof track.role;
                            })
                          }
                        >
                          {["melody", "bass", "harmony", "drums"].map((v) => (
                            <option key={v}>{v}</option>
                          ))}
                        </select>
                      </label>
                      {(
                        ["brightness", "attack", "release", "duty"] as const
                      ).map((key) => (
                        <label key={key}>
                          {key}
                          <input
                            type="range"
                            min={key === "duty" ? 0.05 : 0}
                            max={
                              key === "duty" ? 0.95 : key === "release" ? 2 : 1
                            }
                            step=".01"
                            value={patch[key]}
                            onChange={(e) =>
                              editPatch((sound) => {
                                sound[key] = Number(e.target.value);
                              })
                            }
                          />
                        </label>
                      ))}
                      <label>
                        Volume
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step=".01"
                          value={track.gain}
                          onChange={(e) =>
                            edit((s) => {
                              s.tracks.find((t) => t.id === track.id)!.gain =
                                Number(e.target.value);
                            })
                          }
                        />
                      </label>
                      <label>
                        Pan
                        <input
                          type="range"
                          min="-1"
                          max="1"
                          step=".01"
                          value={track.pan}
                          onChange={(e) =>
                            edit((s) => {
                              s.tracks.find((t) => t.id === track.id)!.pan =
                                Number(e.target.value);
                            })
                          }
                        />
                      </label>
                      <label>
                        Layer enters at
                        <select
                          value={track.minEnergy}
                          onChange={(e) =>
                            edit((s) => {
                              s.tracks.find(
                                (t) => t.id === track.id,
                              )!.minEnergy = Number(e.target.value);
                            })
                          }
                        >
                          <option value="1">Calm</option>
                          <option value="2">Moving</option>
                          <option value="3">Burst</option>
                        </select>
                      </label>
                      <label>
                        Audition intensity
                        <select
                          value={energy}
                          onChange={(e) => {
                            setEnergy(Number(e.target.value));
                            if (!sidePreview)
                              engine.setEnergy(Number(e.target.value));
                          }}
                        >
                          <option value="1">Calm</option>
                          <option value="2">Moving</option>
                          <option value="3">Burst / all parts</option>
                        </select>
                      </label>
                    </>
                  )}
                </aside>
              </main>
            )}
          </div>
        </>
      )}
      {drawer && (
        <div
          className="drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Library"
        >
          {error && (
            <div className="error" role="alert">
              {error}
              <button onClick={() => setError("")}>Clear error</button>
            </div>
          )}
          <div className="drawer-title">
            <h2>Your library</h2>
            <button onClick={() => setDrawer(false)} aria-label="Close library">
              ×
            </button>
          </div>
          <p>Saved in this browser. Keep a download for backup.</p>
          <button onClick={() => void newSong()}>＋ New song</button>
          {entries.map((entry) => (
            <div className="library-entry" key={entry.id}>
              <button
                onClick={() =>
                  void safely(async () => {
                    if (!(await leaveSafe())) return;
                    if (savingFailed.current) {
                      setError(
                        "Preserve unsaved edits as a copy before switching.",
                      );
                      return;
                    }
                    const draft = await library.current?.readDraft(entry.id);
                    if (draft) {
                      revisions.current.set(entry.id, draft.revision);
                      open(draft.score);
                    }
                  })
                }
              >
                <strong>{entry.title}</strong>
                <small>{entry.versionCount} saved versions</small>
              </button>
              <button
                aria-label={`Delete ${entry.title}`}
                onClick={() =>
                  void safely(async () => {
                    if (!(await leaveSafe())) return;
                    await library.current?.deleteSong(entry.id);
                    if (score?.id === entry.id) {
                      engine.stop();
                      setScore(null);
                    }
                    await refresh();
                    setError(
                      `Moved “${entry.title}” to recovery trash. Backups include it.`,
                    );
                  })
                }
              >
                ×
              </button>
            </div>
          ))}
          {score && (
            <>
              <h3>Versions of {score.title}</h3>
              <button
                onClick={() =>
                  void safely(async () => {
                    try {
                      await queue.current;
                      if (savingFailed.current)
                        throw new Error("Save a recovered copy first");
                      await library.current?.saveVersion(
                        score,
                        `Version ${new Date().toLocaleString()}`,
                      );
                      setVersions(
                        await library.current!.listVersions(score.id),
                      );
                      void refresh();
                    } catch (e) {
                      setError(message(e));
                    }
                  })
                }
              >
                Save version
              </button>
              <button
                onClick={() =>
                  void safely(async () =>
                    setVersions(
                      (await library.current?.listVersions(score.id)) ?? [],
                    ),
                  )
                }
              >
                Show versions
              </button>
              {versions
                .filter((v) => v.scoreId === score.id)
                .map((v) => (
                  <button
                    className="version"
                    key={v.id}
                    onClick={() => {
                      edit((s) => Object.assign(s, copy(v.score)));
                      setDrawer(false);
                    }}
                  >
                    {v.name} · restore as draft
                  </button>
                ))}
            </>
          )}
          <hr />
          <button
            onClick={() =>
              void safely(async () => {
                await queue.current;
                const backup = await library.current?.exportLibrary();
                if (backup)
                  download(
                    exportLibraryPack(backup).buffer as ArrayBuffer,
                    "pocket-score-library.zip",
                    "application/zip",
                  );
              })
            }
          >
            Download library backup
          </button>
          <label className="button">
            Restore library backup
            <input
              type="file"
              hidden
              accept=".json,.zip"
              onChange={async (e) => {
                try {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.size > 20_000_000) throw new Error("Backup too large");
                  await library.current?.importLibrary(
                    /\.json$/i.test(f.name)
                      ? JSON.parse(await f.text())
                      : importLibraryPack(
                          new Uint8Array(await f.arrayBuffer()),
                        ),
                  );
                  await refresh();
                } catch (err) {
                  setError(message(err));
                }
              }}
            />
          </label>
        </div>
      )}
      {dialog && score && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={
              dialog === "settings"
                ? "Song settings"
                : dialog === "keep"
                  ? "Keep performance"
                  : "Export song"
            }
          >
            {error && (
              <div className="error" role="alert">
                {error}
                <button onClick={() => setError("")}>Clear error</button>
              </div>
            )}
            <div className="drawer-title">
              <h2>
                {dialog === "settings"
                  ? "Song settings"
                  : dialog === "keep"
                    ? "Keep this performance"
                    : "Take your song with you"}
              </h2>
              <button onClick={closeDialog} aria-label="Close dialog">
                ×
              </button>
            </div>
            {dialog === "keep" ? (
              <div className="export-options">
                <p>
                  {pendingTake.length} frozen notes · {track?.name} ·{" "}
                  {pendingArcadeLanes.length
                    ? pendingArcadeLanes
                        .map((lane) => lane.patch.name)
                        .join(" + ")
                    : (pendingTakePatch ?? patch)?.name}
                </p>
                <button onClick={() => keepNotes(pendingTake, "new")}>
                  Add as a new part{" "}
                  <small>
                    Keep the backing and this phrase separately editable
                  </small>
                </button>
                <button
                  disabled={pendingArcadeLanes.length > 1}
                  onClick={() => keepNotes(pendingTake, "replace")}
                >
                  Replace selected phrase{" "}
                  <small>
                    {pendingArcadeLanes.length > 1
                      ? "Multiple weapons need separate parts to preserve their instruments. Keep these as new parts."
                      : `Replaces all notes in ${pattern?.name}; affects its linked clips. Undo restores notes and instrument.`}
                  </small>
                </button>
              </div>
            ) : dialog === "settings" ? (
              <div className="settings-grid">
                <label>
                  Tempo (BPM)
                  <input
                    type="number"
                    min="20"
                    max="400"
                    value={score.bpm}
                    onChange={(e) => {
                      engine.stop();
                      edit((s) => {
                        s.bpm = Number(e.target.value);
                      });
                    }}
                  />
                </label>
                <label>
                  Playback
                  <select
                    value={score.playback}
                    onChange={(e) =>
                      edit((s) => {
                        s.playback = e.target.value as Score["playback"];
                        s.loop =
                          s.playback === "loop"
                            ? { startTick: 0, endTick: s.lengthTicks }
                            : null;
                      })
                    }
                  >
                    <option value="loop">Loop</option>
                    <option value="one-shot">One-shot</option>
                  </select>
                </label>
                <label>
                  Root
                  <select
                    value={score.scale.root}
                    onChange={(e) =>
                      edit((s) => {
                        s.scale.root = Number(e.target.value);
                      })
                    }
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i} value={i}>
                        {
                          [
                            "C",
                            "C♯",
                            "D",
                            "D♯",
                            "E",
                            "F",
                            "F♯",
                            "G",
                            "G♯",
                            "A",
                            "A♯",
                            "B",
                          ][i]
                        }
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Scale guidance
                  <select
                    value={score.scale.mode}
                    onChange={(e) =>
                      edit((s) => {
                        s.scale.mode = e.target.value as Score["scale"]["mode"];
                      })
                    }
                  >
                    <option>minor</option>
                    <option>major</option>
                    <option>chromatic</option>
                  </select>
                </label>
                <label>
                  Beats per bar
                  <input
                    type="number"
                    min="1"
                    max="32"
                    value={score.meter[0]}
                    onChange={(e) =>
                      edit((s) => {
                        s.meter[0] = Number(e.target.value);
                      })
                    }
                  />
                </label>
                <label>
                  Beat unit
                  <select
                    value={score.meter[1]}
                    onChange={(e) =>
                      edit((s) => {
                        s.meter[1] = Number(
                          e.target.value,
                        ) as Score["meter"][1];
                      })
                    }
                  >
                    {[1, 2, 4, 8, 16, 32].map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Song length (ticks)
                  <input
                    type="number"
                    min="120"
                    step="120"
                    value={score.lengthTicks}
                    onChange={(e) => changeLength(Number(e.target.value))}
                  />
                </label>
                <p className="hint">
                  480 ticks = one quarter note. Scale changes guide future
                  playing; existing notes stay yours. Length changes never
                  silently cut notes.
                </p>
              </div>
            ) : (
              <div className="export-options">
                <button
                  onClick={() =>
                    void safely(() =>
                      download(
                        exportSourcePack(score).buffer as ArrayBuffer,
                        `${score.title}.opmusic`,
                        "application/zip",
                      ),
                    )
                  }
                >
                  Editable source pack{" "}
                  <small>Portable, validated song and sounds</small>
                </button>
                <button
                  onClick={() =>
                    void safely(() =>
                      download(
                        exportMidi(score).buffer as ArrayBuffer,
                        `${score.title}.mid`,
                        "audio/midi",
                      ),
                    )
                  }
                >
                  MIDI notes{" "}
                  <small>
                    Continue editing in a DAW; chip sounds do not transfer
                  </small>
                </button>
                <button
                  onClick={() =>
                    void safely(async () => {
                      try {
                        download(
                          await createPlayerHtml(score),
                          `${score.title}.html`,
                          "text/html",
                        );
                      } catch (e) {
                        setError(message(e));
                      }
                    })
                  }
                >
                  Standalone player HTML{" "}
                  <small>Play offline in a browser</small>
                </button>
                <button
                  onClick={() =>
                    download(
                      JSON.stringify(score, null, 2),
                      `${score.title}.json`,
                    )
                  }
                >
                  Editable score JSON{" "}
                  <small>All notes, sounds and arrangement</small>
                </button>
                <label>
                  Audio range
                  <select
                    value={wavRange}
                    onChange={(e) =>
                      setWavRange(e.target.value as "whole" | "loop")
                    }
                  >
                    <option value="whole">Whole song</option>
                    <option value="loop" disabled={!score.loop}>
                      Explicit loop region
                    </option>
                  </select>
                </label>
                <label>
                  End handling
                  <select
                    value={wavTail ? "tail" : "cut"}
                    onChange={(e) => setWavTail(e.target.value === "tail")}
                  >
                    <option value="cut">Cut at range end</option>
                    <option value="tail">
                      Include instrument release tail
                    </option>
                  </select>
                </label>
                <button disabled={rendering} onClick={() => void exportWav()}>
                  {rendering ? "Rendering audio…" : "Download WAV"}
                  <small>
                    Stereo · 48 kHz · 16-bit ·{" "}
                    {wavRange === "loop" ? "loop region" : "whole song"} ·{" "}
                    {wavTail ? "release tail" : "cut at end"}
                  </small>
                </button>
                <p className="hint">
                  WAV is audio. Download editable source to keep changing notes.
                  Rendering uses the same synth as playback. Cutting at the
                  range end can interrupt a release; a seamless loop is not
                  guaranteed.
                </p>
              </div>
            )}
          </section>
        </div>
      )}
      {midiReview && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="MIDI conversion review"
          >
            {error && (
              <div className="error" role="alert">
                {error}
                <button onClick={() => setError("")}>Clear error</button>
              </div>
            )}
            <div className="drawer-title">
              <h2>Review MIDI conversion</h2>
              <button onClick={() => setMidiReview(null)}>×</button>
            </div>
            {midiReview.tracks.map((t, i) => (
              <p key={i}>
                {t.name} · {t.noteCount} notes · {t.role}
              </p>
            ))}
            {midiReview.warnings.map((w, i) => (
              <p key={i} className="hint">
                {w}
              </p>
            ))}
            {midiReview.blocking.map((w, i) => (
              <p key={i} className="error">
                {w}
              </p>
            ))}
            <button
              className="primary"
              disabled={!!midiReview.blocking.length}
              onClick={() => {
                try {
                  const next = convertMidi(midiReview, { acceptLosses: true });
                  next.id = uid();
                  open(next, true);
                  setMidiReview(null);
                } catch (e) {
                  setError(message(e));
                }
              }}
            >
              Accept listed changes and import
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
function PianoRoll({
  pattern,
  selected,
  position,
  onSelect,
  onAdd,
}: {
  pattern: Score["patterns"][number];
  selected: string | null;
  position: number;
  onSelect: (id: string) => void;
  onAdd: (start: number, pitch: number) => void;
}) {
  const lo = Math.min(48, ...pattern.notes.map((n) => n.pitch)) - 2,
    hi = Math.max(84, ...pattern.notes.map((n) => n.pitch)) + 2,
    rows = hi - lo + 1,
    height = rows * 12,
    width = 960;
  return (
    <div className="piano-scroll">
      <svg
        className="piano-roll"
        viewBox={`0 0 ${width + 48} ${height + 24}`}
        role="img"
        aria-label="Piano roll. Use the accessible note list below to select notes."
      >
        <g transform="translate(48 24)">
          {Array.from({ length: rows }, (_, i) => {
            const pitch = hi - i;
            return (
              <g key={pitch}>
                <rect
                  x="0"
                  y={i * 12}
                  width={width}
                  height="12"
                  fill={
                    [1, 3, 6, 8, 10].includes(pitch % 12)
                      ? "#151a26"
                      : "#1b2130"
                  }
                  onClick={(e) => {
                    const rect =
                      e.currentTarget.ownerSVGElement!.getBoundingClientRect();
                    const x =
                      ((e.clientX - rect.left) / rect.width) * (width + 48) -
                      48;
                    onAdd(
                      Math.max(
                        0,
                        Math.min(
                          pattern.lengthTicks - 1,
                          Math.floor(
                            ((x / width) * pattern.lengthTicks) / 120,
                          ) * 120,
                        ),
                      ),
                      pitch,
                    );
                  }}
                />
                <text
                  x="-6"
                  y={i * 12 + 9}
                  textAnchor="end"
                  className="piano-key"
                >
                  {pitch % 12 === 0 ? pitchName(pitch) : ""}
                </text>
              </g>
            );
          })}
          {Array.from(
            { length: Math.ceil(pattern.lengthTicks / 240) + 1 },
            (_, i) => (
              <line
                key={i}
                x1={((i * 240) / pattern.lengthTicks) * width}
                x2={((i * 240) / pattern.lengthTicks) * width}
                y1="0"
                y2={height}
                stroke={i % 2 ? "#242c3d" : "#354054"}
                pointerEvents="none"
              />
            ),
          )}
          {pattern.notes.map((n) => (
            <rect
              key={n.id}
              x={(n.startTick / pattern.lengthTicks) * width}
              y={(hi - n.pitch) * 12 + 1}
              width={Math.max(
                5,
                (n.durationTicks / pattern.lengthTicks) * width,
              )}
              height="10"
              rx="3"
              className={selected === n.id ? "selected-note" : "music-note"}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(n.id);
              }}
            >
              <title>
                {pitchName(n.pitch)} · tick {n.startTick}
              </title>
            </rect>
          ))}
          <line
            x1={
              ((position % pattern.lengthTicks) / pattern.lengthTicks) * width
            }
            x2={
              ((position % pattern.lengthTicks) / pattern.lengthTicks) * width
            }
            y1="0"
            y2={height}
            stroke="#fbdaa0"
            strokeWidth="2"
            pointerEvents="none"
          />
        </g>
      </svg>
    </div>
  );
}
