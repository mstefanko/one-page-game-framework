import type { GameSession } from "../../../packages/game-runtime/src/index.ts";
import type {
  CompatibilityIdentity,
  GameDefinitions,
  InputFrame,
} from "../../../packages/game-project/src/types.ts";
/** Development only. Vite removes this module's import from production. */
export function installDevProbe(
  getSession: () => GameSession,
  remount: (
    definitions?: GameDefinitions,
    identity?: CompatibilityIdentity,
  ) => Promise<GameSession>,
): void {
  const inspect = () =>
    getSession() as unknown as {
      readyState: boolean;
      disposed: boolean;
      raf: number | undefined;
      viewEpoch: number;
    };
  const probe = {
    get ready() {
      return inspect().readyState;
    },
    observe: () => getSession().observation(),
    checkpoint: () => getSession().checkpoint(),
    restore: (json: string) => getSession().restore(json),
    pause: () => getSession().pause("Paused by the scenario desk."),
    resume: () => getSession().resume(),
    step: (frame?: InputFrame) => getSession().advance(frame),
    restart: async (scenarioId?: string) => {
      getSession().restart(scenarioId);
      await getSession().ready;
    },
    remount: () => remount(),
    dispose: () => getSession().dispose(),
    // Counts owned lifecycle groups, not browser memory or individual textures.
    counters: () => ({
      raf: inspect().raf === undefined ? 0 : 1,
      listeners: inspect().disposed ? 0 : 1,
      resources: inspect().disposed ? 0 : 1,
      sessions: inspect().disposed ? 0 : 1,
      viewEpoch: inspect().viewEpoch,
    }),
  };
  Object.defineProperty(window, "__GAME_DEV__", {
    value: probe,
    configurable: true,
  });
}
