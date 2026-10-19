import { validateDefinitions } from "../../game-project/src/index.ts";
import type {
  CompatibilityIdentity,
  GameDefinitions,
  InputFrame,
} from "../../game-project/src/types.ts";
import {
  createWorld,
  observe,
  restoreCheckpoint,
  serializeCheckpoint,
  step,
} from "../../game-simulation/src/index.ts";
import { actions, BrowserInput } from "./input.ts";
import { FixedScheduler } from "./scheduler.ts";
import { GameView } from "./view.ts";

type FaultPhase = "input" | "clock" | "simulation" | "render";

export interface SessionOptions {
  onReady?: () => void;
  onError?: (error: unknown) => void;
}

/** One owner for world, devices, resources and browser scheduling. */
export class GameSession {
  readonly ready: Promise<void>;
  private definitions: GameDefinitions;
  private world: ReturnType<typeof createWorld>;
  private current: ReturnType<typeof observe>;
  private previous: ReturnType<typeof observe>;
  private viewEpoch = 0;
  private previousEpoch = 0;
  private view: GameView;
  private input: BrowserInput | undefined;
  private scheduler: FixedScheduler;
  private abort = new AbortController();
  private resize: ResizeObserver | undefined;
  private raf: number | undefined;
  private disposed = false;
  private readyState = false;
  private memorySave: string | undefined;
  private lastMirrorAt = -Infinity;
  private scenarioId: string;
  private shell: HTMLElement;
  private stage: HTMLElement;
  private status: HTMLElement;
  private mirror: HTMLElement;
  private checkpointText: HTMLTextAreaElement;
  private inspector: HTMLElement;
  private pauseButton: HTMLButtonElement;
  private scenarioSelect: HTMLSelectElement;
  private controls: HTMLElement;
  private scaleLabel: HTMLElement;
  private inspectorOpen = false;
  private cancelInactiveSlots = true;
  private fault: { phase: FaultPhase; requiresRestart: boolean } | undefined;
  private pageCached = false;

  constructor(
    private root: HTMLElement,
    rawDefinitions: unknown,
    private identity: CompatibilityIdentity,
    options: SessionOptions = {},
  ) {
    this.definitions = validateDefinitions(rawDefinitions);
    this.scenarioId = this.definitions.manifest.initialScenarioId;
    this.world = createWorld(this.definitions, identity, this.scenarioId);
    this.current = observe(this.world);
    this.previous = this.current;
    this.shell = document.createElement("main");
    this.shell.className = "game-shell";
    this.shell.innerHTML = `
      <header class="masthead"><div><p class="eyebrow">POCKET PLAY / ORIGINAL PIXEL STUDY</p><h1></h1><p class="intro">Find your footing. Read the enemy. Reach the light.</p></div><span class="edition">M1 · PLATFORM + COMBAT</span></header>
      <section class="play-card" aria-label="Game player"><div class="play-bar"><span class="live-dot" aria-hidden="true"></span><strong>EMBER CROSSING</strong><span data-scale></span></div>
        <div class="stage" tabindex="0" aria-label="Game controls. Arrow keys move, Z jumps, X strikes, C heavy strikes, V guards."></div>
        <div class="status-line"><span data-mirror aria-live="polite" aria-atomic="true"></span><button type="button" data-pause>Pause</button><button type="button" data-restart>Restart</button></div>
      </section>
      <p class="notice" role="status" data-status>Loading the crossing…</p>
      <section class="below"><div class="controls-panel"><p class="eyebrow">HOW TO PLAY</p><h2>Small steps. Decisive strikes.</h2><p>Move through each room and enter its glowing exit. Defeat or pass the sentries. Falling or losing all health ends the run.</p><div class="keyboard-guide"><span><kbd>←</kbd><kbd>→</kbd> Move</span><span><kbd>Z</kbd> Jump</span><span><kbd>X</kbd> Strike</span><span><kbd>C</kbd> Heavy</span><span><kbd>V</kbd> Guard</span><span><kbd>Esc</kbd> Pause</span></div><details><summary>Local player two & gamepad</summary><p>Player two controls apply to authored two-player scenarios; this demo has a computer sentinel. Player two uses A/D to move, F or W to jump, G to strike, H for heavy and R to guard. Two connected gamepads map to player slots one and two: stick or D-pad, A jump, X strike, B heavy, LB guard. Release controls after resuming.</p></details></div>
      <div class="scenario-panel"><p class="eyebrow">SCENARIO DESK</p><h2>Try a different moment.</h2><label for="game-scenario">Named scenario</label><div class="scenario-row"><select id="game-scenario" data-scenario></select><button type="button" data-load>Load</button></div><div class="scenario-actions"><button type="button" data-inspect>Inspect</button><button type="button" data-save>Save checkpoint</button><button type="button" data-restore>Restore saved</button></div><details class="checkpoint-details"><summary>Exact checkpoint / import & export</summary><label for="game-checkpoint">Checkpoint JSON</label><textarea id="game-checkpoint" data-checkpoint spellcheck="false" placeholder="Save a checkpoint or paste one here"></textarea><button type="button" data-import>Restore JSON</button><button type="button" data-export>Export file</button></details></div></section>
      <div class="touch-controls" aria-label="Touch controls"><div><button type="button" data-action="left" aria-label="Move left">←</button><button type="button" data-action="right" aria-label="Move right">→</button></div><div><button type="button" data-action="guard">Guard</button><button type="button" data-action="jump">Jump</button><button type="button" data-action="attack">Strike</button><button type="button" data-action="heavy">Heavy</button></div></div>
      <pre class="inspector" data-inspector hidden></pre><footer>Built from editable JSON · 60 simulation ticks / second · Original placeholder art</footer>`;
    const find = <T extends HTMLElement>(selector: string) =>
      this.shell.querySelector<T>(selector)!;
    find("h1").textContent = this.definitions.manifest.title;
    document.title = `Pocket / ${this.definitions.manifest.title}`;
    find(".play-bar strong").textContent =
      this.definitions.manifest.title.toUpperCase();
    this.stage = find(".stage");
    this.status = find("[data-status]");
    this.mirror = find("[data-mirror]");
    this.checkpointText = find("[data-checkpoint]");
    this.inspector = find("[data-inspector]");
    this.pauseButton = find("[data-pause]");
    this.scenarioSelect = find("[data-scenario]");
    this.controls = find(".touch-controls");
    this.scaleLabel = find("[data-scale]");
    for (const scenario of this.definitions.scenarios) {
      const option = document.createElement("option");
      option.value = scenario.id;
      option.textContent = scenario.id.replace(/[-_]/g, " ");
      this.scenarioSelect.append(option);
    }
    this.scenarioSelect.value = this.scenarioId;
    this.root.replaceChildren(this.shell);
    this.scheduler = new FixedScheduler(
      () => this.commit(this.liveFrame()),
      () =>
        this.pause(
          "Paused after a long frame. Resume to continue from the last committed tick.",
        ),
    );
    this.view = new GameView(this.definitions);
    this.bindUi(find);
    this.setControlsEnabled(false);
    this.ready = this.mount(options);
  }

  private async mount(options: SessionOptions): Promise<void> {
    try {
      await this.view.init();
      if (this.disposed) return;
      this.stage.append(this.view.app.canvas);
      this.view.app.canvas.addEventListener(
        "webglcontextlost",
        (event) => {
          event.preventDefault();
          this.pause(
            "Graphics context lost. Reload the player to recover; your saved checkpoint remains available.",
          );
        },
        { signal: this.abort.signal },
      );
      this.input = new BrowserInput(this.controls, (message) =>
        this.message(message),
      );
      this.input.setActive(false);
      this.resize = new ResizeObserver(() => this.fit());
      this.resize.observe(this.stage);
      this.fit();
      this.readyState = true;
      this.setControlsEnabled(true);
      this.pauseButton.textContent = "Start";
      this.message("Ready. Press Start when you have read the controls.");
      this.draw(1);
      options.onReady?.();
      this.schedule();
    } catch (error) {
      if (this.disposed) return;
      this.message(
        `The player could not start: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.readyState = false;
      this.setControlsEnabled(false);
      this.abort.abort();
      this.resize?.disconnect();
      this.input?.dispose();
      this.view.dispose();
      options.onError?.(error);
      throw error;
    }
  }

  private bindUi(find: <T extends HTMLElement>(selector: string) => T): void {
    const signal = this.abort.signal;
    const click = (selector: string, callback: () => void) =>
      find(selector).addEventListener(
        "click",
        () => {
          if (!this.readyState || this.disposed) return;
          try {
            callback();
          } catch (error) {
            this.fail(error, "simulation");
          }
        },
        { signal },
      );
    click("[data-pause]", () =>
      this.fault?.requiresRestart
        ? this.restart()
        : this.scheduler.paused
          ? this.resume()
          : this.pause("Paused. Your next move can wait."),
    );
    click("[data-restart]", () => this.restart());
    click("[data-load]", () => this.restart(this.scenarioSelect.value));
    click("[data-inspect]", () => {
      this.inspectorOpen = !this.inspectorOpen;
      this.inspector.hidden = !this.inspectorOpen;
      this.updateMirror(true);
    });
    click("[data-save]", () => this.save());
    click("[data-restore]", () => this.loadSave());
    click("[data-import]", () => this.restore(this.checkpointText.value));
    click("[data-export]", () => {
      const blob = new Blob([this.checkpoint()], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${this.definitions.manifest.gameId}-checkpoint.json`;
      link.click();
      URL.revokeObjectURL(url);
    });
    window.addEventListener(
      "keydown",
      (event) => {
        if (
          event.code === "Escape" &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.altKey &&
          this.readyState
        ) {
          event.preventDefault();
          this.scheduler.paused ? this.resume() : this.pause("Paused.");
        }
      },
      { signal },
    );
    window.addEventListener(
      "blur",
      () => this.pause("Paused while the window is unfocused."),
      { signal },
    );
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden) this.pause("Paused while the page is hidden.");
      },
      { signal },
    );
    window.addEventListener(
      "pagehide",
      (event) => {
        if (!event.persisted) {
          this.dispose();
          return;
        }
        this.pageCached = true;
        this.pause("Paused while this page is cached. Resume after returning.");
        if (this.raf !== undefined) cancelAnimationFrame(this.raf);
        this.raf = undefined;
      },
      { signal },
    );
    window.addEventListener(
      "pageshow",
      (event) => {
        if (!event.persisted || !this.pageCached || this.disposed) return;
        this.pageCached = false;
        try {
          this.fit();
          this.draw(1);
          this.message("Returned to the crossing. Resume when ready.");
          this.schedule();
        } catch (error) {
          this.fail(error, "render");
        }
      },
      { signal },
    );
    window.addEventListener(
      "orientationchange",
      () => {
        this.pause("Paused after orientation changed.");
        this.fit();
      },
      { signal },
    );
  }

  private schedule(): void {
    if (
      this.readyState &&
      !this.disposed &&
      !this.pageCached &&
      !this.fault &&
      this.raf === undefined
    )
      this.raf = requestAnimationFrame(this.frame);
  }
  private frame = (time: number): void => {
    this.raf = undefined;
    if (this.disposed || this.pageCached || this.fault) return;
    let phase: FaultPhase = "input";
    try {
      this.input!.poll();
      phase = "clock";
      if (!Number.isFinite(time))
        throw new Error("Invalid animation timestamp");
      phase = "simulation";
      const alpha = this.scheduler.advance(time);
      phase = "render";
      this.draw(this.scheduler.paused ? 1 : alpha);
      this.updateMirror(false, time);
      this.schedule();
    } catch (error) {
      this.fail(error, phase);
    }
  };
  private fail(error: unknown, phase: FaultPhase): void {
    if (this.disposed || this.fault) return;
    this.fault = { phase, requiresRestart: phase === "simulation" };
    if (this.raf !== undefined) cancelAnimationFrame(this.raf);
    this.raf = undefined;
    this.scheduler.pause();
    this.input?.setActive(false);
    this.pauseButton.textContent = this.fault.requiresRestart
      ? "Restart after error"
      : "Retry";
    const detail = error instanceof Error ? error.message : String(error);
    this.message(
      `Player paused (${phase}): ${detail} ${this.fault.requiresRestart ? "Restart or restore a checkpoint to continue safely." : "Press Retry to continue."}`,
    );
  }
  private setControlsEnabled(enabled: boolean): void {
    for (const control of this.shell.querySelectorAll<
      HTMLButtonElement | HTMLSelectElement
    >("button,select"))
      control.disabled = !enabled;
  }
  private liveFrame(): InputFrame {
    const frame = this.input!.queue.consume();
    if (this.cancelInactiveSlots) {
      for (let slot = 2; slot < 4; slot += 1)
        frame.slots.push({
          slot,
          held: {
            left: false,
            right: false,
            jump: false,
            attack: false,
            heavy: false,
            guard: false,
          },
          axes: { moveX: 0 },
          edges: actions.map((action) => ({ action, kind: "cancel" })),
        });
      this.cancelInactiveSlots = false;
    }
    return frame;
  }
  private commit(frame: InputFrame): void {
    const oldLevel = this.current.levelId;
    this.previous = this.current;
    this.previousEpoch = this.viewEpoch;
    step(this.world, frame);
    this.current = observe(this.world);
    if (this.current.levelId !== oldLevel) {
      this.viewEpoch += 1;
      this.previous = this.current;
      this.previousEpoch = this.viewEpoch;
      this.message(
        `Entered ${this.current.levelId.replace(/[-_]/g, " ")}. Find the next exit.`,
      );
    }
    if (this.current.status !== "playing")
      this.pause(
        this.current.status === "won"
          ? "Crossing complete. You reached the light. Restart to play again."
          : "The crossing got the better of you. Restart to try again.",
      );
  }
  private draw(alpha: number): void {
    if (this.readyState && !this.disposed)
      this.view.render(
        this.previous,
        this.current,
        alpha,
        this.previousEpoch,
        this.viewEpoch,
      );
  }
  private fit(): void {
    if (!this.readyState && !this.stage.firstChild) return;
    const { width, height } = this.definitions.manifest.viewport;
    const fit = Math.min(
      this.stage.clientWidth / width,
      this.stage.clientHeight / height,
    );
    const scale =
      fit >= 1 ? Math.max(1, Math.floor(fit)) : Math.max(Number.EPSILON, fit);
    this.view.app.canvas.style.width = `${width * scale}px`;
    this.view.app.canvas.style.height = `${height * scale}px`;
    this.scaleLabel.textContent =
      scale >= 1
        ? `${scale}× INTEGER SCALE`
        : `${scale.toFixed(2)}× FRACTIONAL FIT`;
  }
  private message(text: string): void {
    this.status.textContent = text;
  }
  private updateMirror(force = false, time = performance.now()): void {
    if (!force && time - this.lastMirrorAt < 500) return;
    this.lastMirrorAt = time;
    const player = this.current.actors.find((actor) => actor.slot === 0);
    this.mirror.textContent = `${this.current.levelId.replace(/[-_]/g, " ")} · Health ${player?.health ?? 0}/${player?.maxHealth ?? 0} · ${this.current.status} · Tick ${this.current.tick}`;
    if (this.inspectorOpen)
      this.inspector.textContent = JSON.stringify(
        {
          viewEpoch: this.viewEpoch,
          identity: this.identity,
          observation: this.current,
        },
        null,
        2,
      );
  }
  pause(reason = "Paused."): void {
    if (this.disposed) return;
    this.scheduler.pause();
    this.input?.setActive(false);
    if (!this.fault) {
      this.pauseButton.textContent = "Resume";
      this.message(reason);
    }
  }
  resume(): void {
    if (this.disposed || !this.readyState) return;
    if (this.current.status !== "playing") {
      this.message("This run has ended. Restart to play again.");
      return;
    }
    if (this.fault?.requiresRestart) {
      this.message(
        "Restart or restore a checkpoint to continue safely after the simulation fault.",
      );
      return;
    }
    this.fault = undefined;
    this.previous = this.current;
    this.previousEpoch = this.viewEpoch;
    this.input?.setActive(true);
    this.scheduler.resume();
    this.pauseButton.textContent = "Pause";
    this.message("Back on the crossing.");
    this.stage.focus({ preventScroll: true });
    this.schedule();
  }
  restart(scenarioId = this.scenarioId): void {
    if (this.disposed || !this.readyState) return;
    let next: ReturnType<typeof createWorld>;
    try {
      next = createWorld(this.definitions, this.identity, scenarioId);
    } catch (error) {
      this.message(
        `Scenario rejected: ${error instanceof Error ? error.message : String(error)}`,
      );
      return;
    }
    this.scheduler.pause();
    this.input?.cancel();
    this.input?.queue.cancelAll(true);
    this.cancelInactiveSlots = true;
    this.world = next;
    this.fault = undefined;
    this.scenarioId = scenarioId;
    this.scenarioSelect.value = scenarioId;
    try {
      this.replaceObservation();
      this.resume();
      this.message(`Loaded ${scenarioId.replace(/[-_]/g, " ")}.`);
    } catch (error) {
      this.fail(error, "render");
    }
  }
  private replaceObservation(): void {
    this.viewEpoch += 1;
    this.current = observe(this.world);
    this.previous = this.current;
    this.previousEpoch = this.viewEpoch;
    this.draw(1);
    this.updateMirror(true);
  }
  checkpoint(): string {
    if (this.disposed) throw new Error("Session disposed");
    if (this.fault?.requiresRestart)
      throw new Error(
        "Cannot save uncertain simulation state; restart or restore first.",
      );
    return serializeCheckpoint(this.world);
  }
  restore(json: string): void {
    if (this.disposed || !this.readyState) return;
    let next: ReturnType<typeof restoreCheckpoint>;
    try {
      next = restoreCheckpoint(this.definitions, this.identity, json);
    } catch (error) {
      this.message(
        `Checkpoint rejected: ${error instanceof Error ? error.message : String(error)}`,
      );
      return;
    }
    this.fault = undefined;
    this.pause("Checkpoint restored. Resume when ready.");
    this.world = next;
    this.scenarioId = next.scenarioId;
    this.scenarioSelect.value = next.scenarioId;
    this.input?.queue.cancelAll(true);
    this.cancelInactiveSlots = true;
    this.checkpointText.value = json;
    try {
      this.replaceObservation();
      this.schedule();
    } catch (error) {
      this.fail(error, "render");
    }
  }
  private storageKey(): string {
    return `onepage:${this.definitions.manifest.gameId}:exact:1`;
  }
  private save(): void {
    this.memorySave = this.checkpoint();
    this.checkpointText.value = this.memorySave;
    try {
      localStorage.setItem(this.storageKey(), this.memorySave);
      this.message(`Exact checkpoint saved at tick ${this.current.tick}.`);
    } catch {
      this.message(
        "Storage unavailable. Checkpoint kept in memory; export it to retain a copy.",
      );
    }
  }
  private loadSave(): void {
    let value = this.memorySave;
    if (!value) {
      try {
        value = localStorage.getItem(this.storageKey()) ?? undefined;
      } catch {
        this.message(
          "Storage unavailable. Save an in-memory checkpoint or import checkpoint JSON.",
        );
        return;
      }
    }
    if (value) this.restore(value);
    else this.message("No checkpoint saved yet. Use Save checkpoint first.");
  }
  observation(): ReturnType<typeof observe> {
    return observe(this.world);
  }
  /** Explicit semantic ticks are also the offline runner path. No wall-clock input. */
  advance(frame: InputFrame = { slots: [] }): void {
    if (this.disposed) throw new Error("Session disposed");
    if (!this.readyState) throw new Error("Player is not ready");
    if (this.fault)
      throw new Error(
        "Player is paused after a fault; restart or restore first.",
      );
    try {
      this.commit(frame);
    } catch (error) {
      this.fail(error, "simulation");
      return;
    }
    try {
      this.draw(1);
      this.updateMirror(true);
    } catch (error) {
      this.fail(error, "render");
    }
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.readyState = false;
    this.scheduler.pause();
    if (this.raf !== undefined) cancelAnimationFrame(this.raf);
    this.raf = undefined;
    this.abort.abort();
    this.resize?.disconnect();
    this.input?.dispose();
    this.view.dispose();
    this.shell.remove();
  }
}

export function mountGame(
  root: HTMLElement,
  definitions: unknown,
  identity: CompatibilityIdentity,
  options: SessionOptions = {},
): GameSession {
  return new GameSession(root, definitions, identity, options);
}
