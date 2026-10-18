import {
  lstat,
  mkdir,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { importScenePack, exportScenePack } from "@onepage/director-io";
import type { SceneDocument } from "@onepage/director-core";
import { effectiveCoverage } from "@onepage/director-core";

export interface ProjectRegistry {
  schemaVersion: 1;
  revision: number;
  slots: Record<string, { scene: SceneDocument; installedAt: string }>;
}
const filename = "director-scenes.json";
async function registryPath(root: string) {
  const canonical = await realpath(root);
  if (!(await lstat(canonical)).isDirectory())
    throw new Error("Project root must be a directory.");
  const path = join(canonical, filename);
  try {
    if (!(await lstat(path)).isFile() || (await lstat(path)).isSymbolicLink())
      throw new Error("Registry must be a regular file.");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return path;
}
export async function readRegistry(root: string): Promise<ProjectRegistry> {
  const path = await registryPath(root);
  try {
    const stat = await lstat(path);
    if (stat.size > 64 * 1024 * 1024)
      throw new Error("Project registry exceeds 64 MiB.");
    const data = JSON.parse(await readFile(path, "utf8")) as ProjectRegistry;
    if (
      data.schemaVersion !== 1 ||
      !Number.isSafeInteger(data.revision) ||
      !data.slots ||
      typeof data.slots !== "object" ||
      Array.isArray(data.slots)
    )
      throw new Error("Unsupported project registry.");
    return data;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return { schemaVersion: 1, revision: 0, slots: {} };
    throw error;
  }
}
export async function installScene(
  root: string,
  scene: SceneDocument,
  expectedRevision: number,
) {
  // Roundtrip validation and dependency closure are identical to downloadable packs.
  const pinned = importScenePack(exportScenePack(scene));
  const gaps = effectiveCoverage(pinned).filter((item) => !item.ready);
  if (gaps.length)
    throw new Error(
      `Scene needs asset preparation before registration: ${gaps.map((item) => `${item.name}: ${item.missing.join(", ")}`).join("; ")}`,
    );
  if (
    !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,100}$/.test(pinned.slot.id) ||
    ["__proto__", "constructor", "prototype"].includes(pinned.slot.id)
  )
    throw new Error("Invalid slot ID.");
  const path = await registryPath(root),
    lock = path + ".lock";
  try {
    await mkdir(lock);
  } catch {
    throw new Error(
      "Another installation is in progress. Retry after it finishes.",
    );
  }
  const temp = path + "." + randomUUID() + ".tmp";
  try {
    const registry = await readRegistry(root);
    if (registry.revision !== expectedRevision)
      throw new Error(
        "Project changed since review. Refresh and compare before installing.",
      );
    const next: ProjectRegistry = {
      ...registry,
      revision: registry.revision + 1,
      slots: {
        ...registry.slots,
        [pinned.slot.id]: {
          scene: pinned,
          installedAt: new Date().toISOString(),
        },
      },
    };
    const serialized = JSON.stringify(next, null, 2);
    if (Buffer.byteLength(serialized) > 64 * 1024 * 1024)
      throw new Error("Project registry exceeds 64 MiB.");
    await writeFile(temp, serialized, { flag: "wx", mode: 0o600 });
    // Last good registry retained for explicit recovery. Atomic rename publishes all dependencies together.
    if (registry.revision) {
      const backup = temp + ".previous";
      try {
        await writeFile(backup, JSON.stringify(registry), {
          mode: 0o600,
          flag: "wx",
        });
        await rename(backup, path + ".previous");
      } finally {
        await rm(backup, { force: true });
      }
    }
    await rename(temp, path);
    return {
      revision: next.revision,
      message: `Scene registered in ${filename}, slot ${pinned.slot.name}. The game host must load this registry.`,
    };
  } finally {
    await rm(temp, { force: true });
    await rm(lock, { recursive: true, force: true });
  }
}
