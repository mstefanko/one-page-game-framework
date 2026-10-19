import definitions from "virtual:game-definitions";
import identity from "virtual:game-identity";
import {
  mountGame,
  type GameSession,
} from "../../../packages/game-runtime/src/index.ts";
import "./style.css";

const root = document.querySelector<HTMLElement>("#app")!;
let session: GameSession;
try {
  session = mountGame(root, definitions, identity);
  session.ready.catch(() => {});
} catch (error) {
  const message = document.createElement("p");
  message.className = "notice";
  message.textContent = `Game content rejected: ${error instanceof Error ? error.message : String(error)}`;
  root.replaceChildren(message);
  throw error;
}
if (import.meta.env.DEV) {
  void import("./dev.ts").then(({ installDevProbe }) =>
    installDevProbe(
      () => session,
      async (nextDefinitions = definitions, nextIdentity = identity) => {
        session.dispose();
        session = mountGame(root, nextDefinitions, nextIdentity);
        await session.ready;
        return session;
      },
    ),
  );
  import.meta.hot?.on("game:diagnostics", ({ diagnostics }) => {
    const status = root.querySelector<HTMLElement>("[data-status]");
    if (status)
      status.textContent = diagnostics
        .map(
          (d: { file: string; jsonPointer: string; message: string }) =>
            `${d.file}${d.jsonPointer}: ${d.message}`,
        )
        .join("\n");
    console.error("Game content validation", diagnostics);
  });
  import.meta.hot?.on(
    "game:restart",
    async ({
      definitions: nextDefinitions,
      identity: nextIdentity,
      reason,
    }) => {
      session.dispose();
      session = mountGame(root, nextDefinitions, nextIdentity);
      await session.ready;
      const status = root.querySelector<HTMLElement>("[data-status]");
      if (status) status.textContent = reason;
    },
  );
}
import.meta.hot?.dispose(() => session.dispose());
