import { StrictMode, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Director } from "@onepage/director-editor";
import type { Candidate, SceneDocument } from "@onepage/director-core";
import "./connections.css";

const endpoint = "http://127.0.0.1:4175";
function App() {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState(
    () => sessionStorage.getItem("director-companion-token") ?? "",
  );
  const [status, setStatus] = useState("Not connected");
  const [message, setMessage] = useState(
    "Manual editing, imports and offline exports work without a connection.",
  );
  const [project, setProject] = useState(false);
  const close = useRef<HTMLButtonElement>(null);
  async function request(path: string, body?: unknown, signal?: AbortSignal) {
    if (!token)
      throw new Error(
        "Open connection settings and pair your local companion first.",
      );
    let response: Response;
    try {
      response = await fetch(endpoint + path, {
        method: body ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body ? { "content-type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal,
      });
    } catch (error) {
      if (signal?.aborted)
        throw new Error("Run stopped. Your scene is unchanged.");
      throw new Error(
        "Local companion is not reachable. Start npm run director:companion in the framework repository.",
      );
    }
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error ?? "Companion operation failed.");
    return data;
  }
  async function connect() {
    try {
      const result = await request("/status");
      sessionStorage.setItem("director-companion-token", token);
      setStatus(
        result.available
          ? result.mode === "claude-code"
            ? "Claude Code ready"
            : "API ready"
          : "Sign-in required",
      );
      setProject(result.projectConnected);
      setMessage(
        `${result.message} ${result.mode === "claude-code" ? `Run budget: up to $${result.budget} (provider estimate).` : "API mode: one response, 4096 output tokens; dollar budget is not enforced. Configure an account spending limit."} Image and voice creation are not connected; imported media remains available.`,
      );
    } catch (error) {
      setStatus("Not connected");
      setMessage(String(error));
    }
  }
  async function run(
    scene: SceneDocument,
    prompt: string,
    signal?: AbortSignal,
  ): Promise<Candidate> {
    const runId = crypto.randomUUID();
    const cancel = () => {
      void request("/cancel", { runId }).catch(() => {});
    };
    signal?.addEventListener("abort", cancel, { once: true });
    try {
      const result = await request(
        "/propose",
        { scene, prompt, runId },
        signal,
      );
      return result.candidate;
    } finally {
      signal?.removeEventListener("abort", cancel);
    }
  }
  async function install(scene: SceneDocument) {
    if (!project)
      throw new Error(
        "No game folder connected. Start the companion with --project <folder>, then test the connection.",
      );
    const state = await request("/project");
    return await request("/install", {
      scene,
      expectedRevision: state.revision,
    });
  }
  return (
    <>
      <Director
        companion={
          {
            status,
            run:
              token &&
              (status === "Claude Code ready" || status === "API ready")
                ? run
                : undefined,
            configure: () => setOpen(true),
            install,
          } as Parameters<typeof Director>[0]["companion"]
        }
      />
      {open && (
        <div
          className="connection-scrim"
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "Tab") {
              const items = Array.from(
                e.currentTarget.querySelectorAll<HTMLElement>(
                  "button,input,a[href]",
                ),
              );
              const first = items[0],
                last = items.at(-1);
              if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last?.focus();
              } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first?.focus();
              }
            }
          }}
        >
          <section
            className="connection-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="connection-title"
          >
            <header>
              <h2 id="connection-title">Agents & services</h2>
              <button ref={close} autoFocus onClick={() => setOpen(false)}>
                Close
              </button>
            </header>
            <p>
              Runs on this computer. Model requests send your direction and
              scene manifest to your chosen provider. Source images and provider
              credentials are not sent by this editor.
            </p>
            <ol>
              <li>
                In the framework repository run{" "}
                <code>npm run director:companion</code>.
              </li>
              <li>Sign in using Claude Code’s own terminal if needed.</li>
              <li>
                Paste the companion’s pairing token below. It is kept for this
                browser tab only.
              </li>
            </ol>
            <label>
              Companion pairing token
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <div className="connection-actions">
              <button onClick={() => void connect()}>Test connection</button>
              <button
                onClick={() => {
                  sessionStorage.removeItem("director-companion-token");
                  setToken("");
                  setStatus("Not connected");
                  setProject(false);
                  setMessage(
                    "Disconnected from this editor. Claude Code stays signed in.",
                  );
                }}
              >
                Disconnect
              </button>
            </div>
            <p role="status">{message}</p>
            <details>
              <summary>API connection and game folder</summary>
              <p>
                API mode uses{" "}
                <code>npm run director:companion -- --provider api</code>. Set{" "}
                <code>ANTHROPIC_API_KEY</code> and <code>DIRECTOR_MODEL</code>{" "}
                in the companion environment or your system secret manager. This
                page never stores an API key.
              </p>
              <p>
                To register scenes in a project, add{" "}
                <code>--project /path/to/game</code>. Registration writes a
                pinned <code>director-scenes.json</code>; the game must
                implement that scene-slot contract. Download a scene pack to
                integrate other engines.
              </p>
            </details>
            <p className="connection-note">
              Image creation: not connected · Voice creation: not connected ·
              Asset search: import packs. No service is required for manual
              editing.
            </p>
          </section>
        </div>
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
