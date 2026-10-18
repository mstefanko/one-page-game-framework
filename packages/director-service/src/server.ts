import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { spawn } from "node:child_process";
import { requestProposal, type ProviderConfig } from "./provider";
import { installScene, readRegistry } from "./install";
import type { SceneDocument } from "@onepage/director-core";

export interface CompanionConfig extends ProviderConfig {
  port?: number;
  token?: string;
  projectRoot?: string;
  origins?: string[];
}
export function safeToken(provided: string, expected: string) {
  const a = Buffer.from(provided),
    b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
async function readBody(
  request: IncomingMessage,
): Promise<Record<string, unknown>> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16 * 1024 * 1024) throw new Error("Request exceeds 16 MiB.");
    chunks.push(chunk);
  }
  const value = JSON.parse(Buffer.concat(chunks).toString());
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Expected a JSON object.");
  return value;
}
async function nativeStatus(executable = "claude") {
  return await new Promise<boolean>((resolve) => {
    const child = spawn(executable, ["auth", "status", "--json"], {
      stdio: ["ignore", "pipe", "ignore"],
      shell: false,
    });
    let data = "";
    const timer = setTimeout(() => {
      child.kill();
      resolve(false);
    }, 5000);
    child.stdout.on("data", (chunk) => {
      data += chunk;
      if (data.length > 16000) child.kill();
    });
    child.on("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
    child.on("close", () => {
      clearTimeout(timer);
      try {
        resolve(JSON.parse(data).loggedIn === true);
      } catch {
        resolve(false);
      }
    });
  });
}
export function createCompanion(config: CompanionConfig) {
  const token = config.token ?? randomBytes(24).toString("hex");
  const origins = config.origins ?? [
    "http://127.0.0.1:4174",
    "http://localhost:4174",
  ];
  const runs = new Map<string, AbortController>();
  let attemptedRuns = 0;
  const server = createServer(async (request, response) => {
    const send = (status: number, data: unknown) => {
      if (!response.destroyed) {
        response.writeHead(status, {
          "content-type": "application/json",
          "cache-control": "no-store",
        });
        response.end(JSON.stringify(data));
      }
    };
    const origin = request.headers.origin;
    const host = request.headers.host ?? "";
    if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host)) {
      send(403, { error: "Invalid host." });
      return;
    }
    if (origin && !origins.includes(origin)) {
      send(403, { error: "Origin not allowed." });
      return;
    }
    if (origin) response.setHeader("access-control-allow-origin", origin);
    response.setHeader("vary", "Origin");
    if (request.method === "OPTIONS") {
      response.setHeader("access-control-allow-methods", "GET, POST");
      response.setHeader(
        "access-control-allow-headers",
        "authorization, content-type",
      );
      response.writeHead(204);
      response.end();
      return;
    }
    if (
      !safeToken(
        (request.headers.authorization ?? "").replace(/^Bearer /, ""),
        token,
      )
    ) {
      send(401, {
        error:
          "Pair this editor with the token printed by your local companion.",
      });
      return;
    }
    try {
      const path = request.url?.split("?")[0];
      if (path === "/status" && request.method === "GET") {
        const available =
          config.mode === "claude-code"
            ? await nativeStatus(config.executable)
            : !!config.apiKey && !!config.model;
        send(200, {
          mode: config.mode,
          available,
          model: config.model ?? "Claude Code configured default",
          budget: config.budget,
          budgetEnforced: config.mode === "claude-code",
          attemptedRuns,
          projectConnected: !!config.projectRoot,
          media: { image: false, voice: false },
          message: available
            ? "Ready"
            : "Sign in through Claude Code, or configure API credentials and model in the companion.",
        });
        return;
      }
      if (path === "/project" && request.method === "GET") {
        if (!config.projectRoot)
          throw new Error("Start the companion with --project <folder> first.");
        const registry = await readRegistry(config.projectRoot);
        send(200, {
          revision: registry.revision,
          slots: Object.keys(registry.slots),
        });
        return;
      }
      if (request.method !== "POST") {
        send(404, { error: "Unknown operation." });
        return;
      }
      if (!request.headers["content-type"]?.startsWith("application/json")) {
        send(415, { error: "JSON required." });
        return;
      }
      const body = await readBody(request);
      if (path === "/propose") {
        if (runs.size)
          throw new Error(
            "A run is already active. Stop it or wait before starting another.",
          );
        if (attemptedRuns >= 20)
          throw new Error(
            "Companion session limit reached. Restart to authorize more runs.",
          );
        if (
          typeof body.runId !== "string" ||
          !/^[-a-zA-Z0-9]{1,100}$/.test(body.runId) ||
          typeof body.prompt !== "string"
        )
          throw new Error("Invalid run request.");
        const abort = new AbortController();
        runs.set(body.runId, abort);
        attemptedRuns++;
        const close = () => {
          if (!response.writableEnded) abort.abort();
        };
        response.on("close", close);
        try {
          const candidate = await requestProposal(
            body.scene as SceneDocument,
            body.prompt,
            config,
            abort.signal,
          );
          send(200, { candidate });
        } finally {
          runs.delete(body.runId);
          response.off("close", close);
        }
        return;
      }
      if (path === "/cancel") {
        const id = String(body.runId);
        runs.get(id)?.abort();
        send(200, { cancelled: true });
        return;
      }
      if (path === "/install") {
        if (!config.projectRoot)
          throw new Error(
            "No game project is connected. Download a scene pack instead.",
          );
        if (!Number.isSafeInteger(body.expectedRevision))
          throw new Error("Review the project revision before installation.");
        send(
          200,
          await installScene(
            config.projectRoot,
            body.scene as SceneDocument,
            body.expectedRevision as number,
          ),
        );
        return;
      }
      send(404, { error: "Unknown operation." });
    } catch (error) {
      send(400, {
        error: error instanceof Error ? error.message : "Operation failed.",
      });
    }
  });
  server.on("close", () => {
    for (const run of runs.values()) run.abort();
  });
  return { server, token };
}
