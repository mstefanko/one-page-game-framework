import { validateScene, effectiveCoverage } from "@onepage/director-core";
import type {
  SceneDocument,
  PackManifest,
  AssetFamily,
  MediaResource,
} from "@onepage/director-core";
import { runtimeBundle } from "../../director-runtime/src/bundle.generated";
const LIMIT = 24 * 1024 * 1024;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
function parse(json: string): any {
  if (json.length > LIMIT) throw new Error("Pack exceeds 24 MiB limit");
  let count = 0;
  const data = JSON.parse(json, (key, value) => {
    if (["__proto__", "prototype", "constructor"].includes(key))
      throw new Error("Unsafe object key");
    if (++count > 200000) throw new Error("Pack has too many values");
    if (typeof value === "number" && !Number.isFinite(value))
      throw new Error("Invalid number");
    return value;
  });
  function visit(v: any, depth: number) {
    if (depth > 32) throw new Error("Pack nesting too deep");
    if (v && typeof v === "object") {
      for (const [key, value] of Object.entries(v)) {
        if (
          /^(script|javascript|code|html|onload|onclick|onerror|module|executable)$/i.test(
            key,
          )
        )
          throw new Error("Executable pack fields are not supported");
        visit(value, depth + 1);
      }
    }
  }
  visit(data, 0);
  return data;
}
function keys(value: unknown, allowed: string, kind: string) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`Invalid ${kind}`);
  const permitted = new Set(allowed.split(" "));
  for (const key of Object.keys(value)) {
    if (!permitted.has(key)) throw new Error(`Unknown ${kind} field: ${key}`);
  }
}
function points(value: unknown) {
  if (value === undefined) return;
  for (const point of Object.values(value as object))
    keys(point, "x y", "socket");
}
const text = (v: unknown) => typeof v === "string" && v.length <= 65536;
const identity = (v: unknown) =>
  typeof v === "string" && v.length > 0 && v.length <= 256;
function socketsValid(value: unknown): boolean {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.values(value).every(
      (p: any) =>
        p &&
        Number.isFinite(p.x) &&
        Number.isFinite(p.y) &&
        Math.abs(p.x) <= 8192 &&
        Math.abs(p.y) <= 8192,
    )
  );
}
function mediaValid(media: MediaResource[]) {
  if (!Array.isArray(media) || media.length > 512)
    throw new Error("Invalid media list");
  const ids = new Set<string>();
  for (const m of media) {
    if (
      !m ||
      !identity(m.id) ||
      !text(m.name) ||
      !text(m.source) ||
      !text(m.license) ||
      (m.author !== undefined && !text(m.author)) ||
      ids.has(m.id)
    )
      throw new Error("Duplicate media identity");
    keys(m, "id name mime dataUrl source license author", "media");
    ids.add(m.id);
    if (
      ![
        "image/png",
        "image/jpeg",
        "image/webp",
        "audio/wav",
        "audio/mpeg",
        "audio/ogg",
      ].includes(m.mime) ||
      typeof m.dataUrl !== "string" ||
      !m.dataUrl.startsWith(`data:${m.mime};base64,`) ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(
        m.dataUrl.slice(m.dataUrl.indexOf(",") + 1),
      )
    )
      throw new Error("Media must be safe embedded PNG/JPEG/WebP or audio");
    // Bound PNG decoded dimensions before a browser allocates its image buffer.
    if (m.mime === "image/png") {
      const header = atob(
        m.dataUrl.slice(
          m.dataUrl.indexOf(",") + 1,
          m.dataUrl.indexOf(",") + 1 + 44,
        ),
      );
      if (header.length >= 24 && header.slice(1, 4) === "PNG") {
        const bytes = Uint8Array.from(header, (c) => c.charCodeAt(0)),
          view = new DataView(bytes.buffer),
          width = view.getUint32(16),
          height = view.getUint32(20);
        if (width > 8192 || height > 8192 || width * height > 32 * 1024 * 1024)
          throw new Error("Image decoded dimensions exceed budget");
      }
    }
    if (m.dataUrl.length > 12 * 1024 * 1024)
      throw new Error("Media exceeds size limit");
  }
}
function familiesValid(assets: AssetFamily[], media: MediaResource[]) {
  if (!Array.isArray(assets) || assets.length > 512)
    throw new Error("Invalid asset list");
  const familyIds = new Set<string>(),
    variantIds = new Set<string>(),
    mediaIds = new Set(media.map((m) => m.id));
  for (const a of assets) {
    if (
      !a ||
      !identity(a.id) ||
      !text(a.name) ||
      !text(a.source) ||
      !text(a.license) ||
      (a.author !== undefined && !text(a.author)) ||
      (a.packId !== undefined && !text(a.packId)) ||
      !["character", "set", "prop", "audio"].includes(a.kind) ||
      familyIds.has(a.id) ||
      !Array.isArray(a.variants) ||
      a.variants.length > 64
    )
      throw new Error("Invalid asset family");
    keys(a, "id name kind variants source license packId author", "family");
    familyIds.add(a.id);
    for (const v of a.variants) {
      if (
        !v ||
        !identity(v.id) ||
        !text(v.name) ||
        (v.missing !== undefined &&
          (!Array.isArray(v.missing) || !v.missing.every(text))) ||
        !socketsValid(v.sockets) ||
        !["8-bit", "16-bit", "realistic"].includes(v.style) ||
        !Number.isFinite(v.logicalHeight) ||
        v.logicalHeight <= 0 ||
        v.logicalHeight > 8192 ||
        typeof v.ready !== "boolean" ||
        !Number.isInteger(v.revision) ||
        v.revision < 1 ||
        variantIds.has(v.id) ||
        !Array.isArray(v.frames) ||
        v.frames.length > 4096 ||
        !Array.isArray(v.clips)
      )
        throw new Error("Invalid variant");
      keys(
        v,
        "id name style revision mediaId frames clips sockets logicalHeight ready missing renderKey",
        "variant",
      );
      points(v.sockets);
      variantIds.add(v.id);
      if (v.mediaId && !mediaIds.has(v.mediaId))
        throw new Error("Missing variant media");
      if (
        v.renderKey &&
        !["courier", "keeper", "station", "foreground", "lamp"].includes(
          v.renderKey,
        )
      )
        throw new Error("Unknown renderer");
      for (const f of v.frames) {
        keys(f, "x y width height duration sockets", "frame");
        points(f.sockets);
        if (
          ![f.x, f.y, f.width, f.height, f.duration].every(Number.isFinite) ||
          f.width <= 0 ||
          f.height <= 0 ||
          f.width > 8192 ||
          f.height > 8192 ||
          f.x < 0 ||
          f.y < 0 ||
          f.duration <= 0 ||
          !Number.isInteger(f.duration) ||
          (f.sockets !== undefined && !socketsValid(f.sockets))
        )
          throw new Error("Invalid sprite frame");
      }
      for (const c of v.clips) {
        keys(c, "name frames loop fps", "clip");
        if (
          !text(c.name) ||
          typeof c.loop !== "boolean" ||
          !Array.isArray(c.frames) ||
          !c.frames.length ||
          !c.frames.every(
            (i) => Number.isInteger(i) && i >= 0 && i < v.frames.length,
          ) ||
          !Number.isFinite(c.fps) ||
          c.fps <= 0
        )
          throw new Error("Invalid animation clip");
      }
    }
  }
}
function sceneValid(scene: SceneDocument) {
  if (!scene || scene.schemaVersion !== 1)
    throw new Error("Unsupported scene schema");
  if (
    !identity(scene.id) ||
    !text(scene.title) ||
    !text(scene.brief) ||
    !scene.slot ||
    ![
      scene.slot.id,
      scene.slot.name,
      scene.slot.onComplete,
      scene.slot.onSkip,
    ].every(text)
  )
    throw new Error("Invalid scene metadata");
  if (
    scene.width > 4096 ||
    scene.height > 4096 ||
    scene.shots.length > 512 ||
    scene.actors.length > 256 ||
    scene.layers.length > 256 ||
    scene.shots.some((s) => s.start + s.duration > 60 * 60 * 60)
  )
    throw new Error("Scene exceeds runtime bounds");
  keys(
    scene,
    "schemaVersion id revision title width height fps style brief shots actors layers motions dialogue camera audio environment locks assets media slot",
    "scene",
  );
  keys(scene.slot, "id name onComplete onSkip", "slot");
  const envKeys =
    "weather timeOfDay frontRain backRain lantern wetness ambience abandoned";
  keys(scene.environment, envKeys, "environment");
  for (const shot of scene.shots) {
    keys(shot, "id name start duration environment", "shot");
    if (shot.environment) keys(shot.environment, envKeys, "environment");
  }
  for (const actor of scene.actors)
    keys(actor, "id name familyId x y scale variantId", "actor");
  for (const layer of scene.layers)
    keys(
      layer,
      "id name kind x y z visible output opacity manualOverride familyId",
      "layer",
    );
  for (const motion of scene.motions) {
    keys(
      motion,
      "id shotId actorId action start duration from to ease endLink",
      "motion",
    );
    keys(motion.from, "x y", "point");
    keys(motion.to, "x y", "point");
  }
  for (const dialogue of scene.dialogue)
    keys(
      dialogue,
      "id shotId actorId text start duration revealRate waitForInput voiceMediaId transcript voiceNeedsReview style",
      "dialogue",
    );
  for (const camera of scene.camera) {
    keys(camera, "id shotId start duration from to zoom fromZoom", "camera");
    keys(camera.from, "x y", "point");
    keys(camera.to, "x y", "point");
  }
  for (const audio of scene.audio)
    keys(audio, "id kind start duration mediaId title volume", "audio");
  for (const lock of scene.locks)
    keys(lock, "id target targetId property label", "lock");
  mediaValid(scene.media);
  familiesValid(scene.assets, scene.media);
  const errors = validateScene(scene).filter((d) => d.severity === "error");
  if (errors.length) throw new Error(errors.map((d) => d.message).join("; "));
  return scene;
}
export function importScenePack(json: string): SceneDocument {
  const parsed = parse(json);
  if (parsed.scene) {
    keys(parsed, "format version scene", "scene pack");
    if (parsed.format !== "pocket-director-scene" || parsed.version !== 1)
      throw new Error("Unsupported scene pack format/version");
  }
  return sceneValid(parsed.scene ?? parsed);
}
function closure(scene: SceneDocument): SceneDocument {
  const copy = clone(scene),
    ids = new Set([
      ...scene.actors.map((a) => a.familyId),
      ...scene.layers.map((l) => l.familyId).filter(Boolean),
    ]);
  copy.assets = copy.assets
    .filter((a) => ids.has(a.id))
    .map((a) => ({
      ...a,
      variants: a.variants.filter(
        (v) =>
          scene.actors.some(
            (actor) =>
              actor.familyId === a.id &&
              (actor.variantId
                ? actor.variantId === v.id
                : v.style === scene.style),
          ) ||
          scene.layers.some(
            (layer) => layer.familyId === a.id && v.style === scene.style,
          ),
      ),
    }));
  const mids = new Set(
    [
      ...copy.assets.flatMap((a) => a.variants.map((v) => v.mediaId)),
      ...scene.audio.map((a) => a.mediaId),
      ...scene.dialogue.map((d) => d.voiceMediaId),
    ].filter(Boolean),
  );
  copy.media = copy.media.filter((m) => mids.has(m.id));
  return copy;
}
export function exportScenePack(scene: SceneDocument): string {
  sceneValid(scene);
  return JSON.stringify(
    { format: "pocket-director-scene", version: 1, scene: closure(scene) },
    null,
    2,
  );
}
export function importAssetPack(json: string): PackManifest {
  const p = parse(json);
  keys(
    p,
    "schemaVersion id name version author license source assets media",
    "asset pack",
  );
  if (
    p.schemaVersion !== 1 ||
    typeof p.id !== "string" ||
    typeof p.version !== "string" ||
    typeof p.name !== "string" ||
    typeof p.author !== "string" ||
    typeof p.source !== "string" ||
    typeof p.license !== "string"
  )
    throw new Error("Invalid asset pack manifest");
  mediaValid(p.media);
  familiesValid(p.assets, p.media);
  p.assets = p.assets.map((a: AssetFamily) => ({
    ...a,
    author: a.author ?? p.author,
  }));
  p.media = p.media.map((m: MediaResource) => ({
    ...m,
    author: m.author ?? p.author,
  }));
  return p;
}
export function exportAssetPack(pack: PackManifest): string {
  return JSON.stringify(importAssetPack(JSON.stringify(pack)), null, 2);
}
function unique(id: string, used: Set<string>): string {
  let next = id,
    n = 2;
  while (used.has(next)) next = `${id}~${n++}`;
  used.add(next);
  return next;
}
export function addPackToScene(
  scene: SceneDocument,
  pack: PackManifest,
  selectedFamilyIds: string[],
): SceneDocument {
  const safe = importAssetPack(JSON.stringify(pack)),
    copy = clone(scene),
    selected = safe.assets.filter((a) => selectedFamilyIds.includes(a.id));
  if (selected.length !== new Set(selectedFamilyIds).size)
    throw new Error("Unknown selected family");
  const mids = new Set(
      selected.flatMap((a) => a.variants.map((v) => v.mediaId)).filter(Boolean),
    ),
    mediaIds = new Set(copy.media.map((m) => m.id)),
    familyIds = new Set(copy.assets.map((a) => a.id)),
    variantIds = new Set(
      copy.assets.flatMap((a) => a.variants.map((v) => v.id)),
    ),
    remap = new Map<string, string>();
  for (const m of safe.media.filter((m) => mids.has(m.id))) {
    const same = copy.media.find(
      (x) => x.id === m.id && JSON.stringify(x) === JSON.stringify(m),
    );
    if (same) {
      remap.set(m.id, m.id);
      continue;
    }
    const id = unique(m.id, mediaIds);
    remap.set(m.id, id);
    copy.media.push({ ...m, id });
  }
  for (const a of selected) {
    const identical = copy.assets.find(
      (x) =>
        x.id === a.id &&
        JSON.stringify(x) ===
          JSON.stringify({ ...a, packId: `${safe.id}@${safe.version}` }),
    );
    if (identical) continue;
    copy.assets.push({
      ...a,
      id: unique(a.id, familyIds),
      packId: `${safe.id}@${safe.version}`,
      variants: a.variants.map((v) => ({
        ...v,
        id: unique(v.id, variantIds),
        ...(v.mediaId ? { mediaId: remap.get(v.mediaId) } : {}),
      })),
    });
  }
  copy.revision++;
  return copy;
}
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("pocket-director-sidecar", 2);
    req.onupgradeneeded = () => {
      for (const store of ["drafts", "versions", "packs", "media"]) {
        if (!req.result.objectStoreNames.contains(store))
          req.result.createObjectStore(store);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function saveDraft(scene: SceneDocument): Promise<void> {
  sceneValid(scene);
  const db = await openDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["drafts", "versions"], "readwrite");
      tx.objectStore("drafts").put(clone(scene), "current");
      tx.objectStore("versions").put(
        clone(scene),
        `${scene.id}@${scene.revision}`,
      );
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function loadDraft(): Promise<SceneDocument | null> {
  const db = await openDB();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("drafts"),
        req = tx.objectStore("drafts").get("current");
      req.onsuccess = () => {
        try {
          resolve(req.result ? sceneValid(req.result) : null);
        } catch (e) {
          reject(e);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}
export async function listDraftVersions(): Promise<SceneDocument[]> {
  const db = await openDB();
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction("versions").objectStore("versions").getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}
const scriptSafe = (text: string) =>
  text
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
export async function exportStandaloneHtml(
  scene: SceneDocument,
): Promise<string> {
  sceneValid(scene);
  const runtimeScene = {
    ...scene,
    layers: scene.layers
      .filter((l) => l.output)
      .map((l) => ({ ...l, visible: true })),
  };
  const missing = effectiveCoverage(runtimeScene).filter((c) => !c.ready);
  if (missing.length)
    throw new Error(
      `Runtime export requires complete used assets: ${missing.map((c) => `${c.name}: ${c.missing.join(", ")}`).join("; ")}`,
    );
  const source = closure(runtimeScene);
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; media-src data:"><title>Pocket Director Player</title><style>*{box-sizing:border-box}body{margin:0;background:#101820;color:#f4e8d1;font:16px system-ui;min-height:100vh;display:grid;place-content:center;padding:16px}main{width:min(92vw,900px)}canvas{display:block;width:100%;image-rendering:pixelated;border:1px solid #556069}nav{display:flex;gap:12px;margin:16px 0}button{background:#ecd7ae;color:#26333b;border:0;border-radius:6px;padding:12px 18px;font:inherit}#status{min-height:24px;font-size:14px}</style><main><canvas aria-label="Cutscene"></canvas><nav><button id="advance">Continue</button><button id="pause">Play / pause</button><button id="skip">Skip</button></nav><div role="status" id="status">Loading embedded art…</div></main><script type="application/json" id="scene">${scriptSafe(JSON.stringify(source))}</script><script>${runtimeBundle.replace(/<\/script/gi, "<\\/script")}\nPocketDirector.mountPlayer(JSON.parse(document.getElementById('scene').textContent));</script></html>`;
}

/** Normalize PNG plus Aseprite JSON. Action mapping is explicit; no filename guessing. */
export function importAsepriteSheet(
  json: string,
  pngDataUrl: string,
  options: {
    id: string;
    name: string;
    style: "8-bit" | "16-bit" | "realistic";
    source: string;
    license: string;
    author: string;
    actions: Record<string, string>;
    ground: { x: number; y: number };
  },
): PackManifest {
  const data = parse(json),
    raw = Array.isArray(data.frames)
      ? data.frames
      : Object.values(data.frames ?? {});
  if (!raw.length || raw.length > 4096 || !data.meta?.size)
    throw new Error("Expected Aseprite frame metadata");
  const mediaId = `${options.id}:sheet`,
    frames = raw.map((entry: any) => {
      if (entry.rotated)
        throw new Error("Rotated frames require baking before import");
      if (entry.trimmed)
        throw new Error(
          "Trimmed sheets require untrimmed export for this adapter",
        );
      const f = entry.frame;
      return {
        x: f.x,
        y: f.y,
        width: f.w,
        height: f.h,
        duration: Math.max(1, Math.round((entry.duration * 60) / 1000)),
      };
    });
  const tags = data.meta.frameTags ?? [];
  const clips = tags.map((tag: any) => {
    if (
      !Number.isInteger(tag.from) ||
      !Number.isInteger(tag.to) ||
      tag.from < 0 ||
      tag.to < tag.from ||
      tag.to >= frames.length
    )
      throw new Error("Invalid animation tag bounds");
    const name = options.actions[tag.name];
    if (!name) throw new Error(`Map action for tag ${tag.name}`);
    if (
      !["forward", "reverse", "pingpong"].includes(tag.direction ?? "forward")
    )
      throw new Error("Unsupported tag direction");
    let indices = Array.from(
      { length: tag.to - tag.from + 1 },
      (_, i) => tag.from + i,
    );
    if (tag.direction === "reverse") indices.reverse();
    if (tag.direction === "pingpong")
      indices = [...indices, ...indices.slice(1, -1).reverse()];
    return {
      name,
      frames: indices,
      loop: true,
      fps: 60 / frames[tag.from].duration,
    };
  });
  if (!clips.length)
    throw new Error("Animation tags and explicit action mappings are required");
  return importAssetPack(
    JSON.stringify({
      schemaVersion: 1,
      id: options.id,
      name: options.name,
      version: "1",
      author: options.author,
      license: options.license,
      source: options.source,
      assets: [
        {
          id: `${options.id}:family`,
          name: options.name,
          kind: "character",
          source: options.source,
          license: options.license,
          variants: [
            {
              id: `${options.id}:appearance`,
              name: options.name,
              style: options.style,
              revision: 1,
              mediaId,
              frames,
              clips,
              sockets: { ground: options.ground },
              logicalHeight: frames[0].height,
              ready: true,
            },
          ],
        },
      ],
      media: [
        {
          id: mediaId,
          name: options.name,
          mime: "image/png",
          dataUrl: pngDataUrl,
          source: options.source,
          license: options.license,
        },
      ],
    }),
  );
}

/** Immutable library revisions; media is catalogued separately by content hash. */
export async function saveAssetPack(pack: PackManifest): Promise<void> {
  const safe = importAssetPack(JSON.stringify(pack));
  const media = await Promise.all(
    safe.media.map(async (m) => {
      const hash = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(m.dataUrl),
      );
      return {
        hash: Array.from(new Uint8Array(hash), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join(""),
        resource: m,
      };
    }),
  );
  const db = await openDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["packs", "media"], "readwrite"),
        store = tx.objectStore("packs"),
        key = `${safe.id}@${safe.version}`,
        request = store.get(key);
      let conflict = false;
      request.onsuccess = () => {
        if (
          request.result &&
          JSON.stringify(request.result) !== JSON.stringify(safe)
        ) {
          conflict = true;
          tx.abort();
          return;
        }
        store.put(safe, key);
        for (const m of media) tx.objectStore("media").put(m.resource, m.hash);
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () =>
        reject(
          new Error(
            conflict
              ? "Pack revision is immutable; import as a new version"
              : "Pack save aborted",
          ),
        );
    });
  } finally {
    db.close();
  }
}
export async function loadAssetPacks(): Promise<PackManifest[]> {
  const db = await openDB();
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction("packs").objectStore("packs").getAll();
      req.onsuccess = () =>
        resolve(req.result.map((p) => importAssetPack(JSON.stringify(p))));
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

/** A flat image remains an explicitly sized set/prop, with no fabricated animation. */
export function importImageAsset(
  dataUrl: string,
  options: {
    id: string;
    name: string;
    kind: "set" | "prop";
    style: "8-bit" | "16-bit" | "realistic";
    width: number;
    height: number;
    source: string;
    license: string;
    author: string;
    logicalHeight?: number;
  },
): PackManifest {
  const mime = /^data:(image\/(?:png|jpeg|webp));base64,/.exec(dataUrl)?.[1];
  if (!mime) throw new Error("Choose an embedded PNG, JPEG or WebP image");
  if (
    !["set", "prop"].includes(options.kind) ||
    ![options.width, options.height].every(
      (n) => Number.isInteger(n) && n > 0 && n <= 8192,
    )
  )
    throw new Error("Invalid image dimensions or family kind");
  const mediaId = `${options.id}:image`;
  return importAssetPack(
    JSON.stringify({
      schemaVersion: 1,
      id: options.id,
      name: options.name,
      version: "1",
      author: options.author,
      license: options.license,
      source: options.source,
      assets: [
        {
          id: `${options.id}:family`,
          name: options.name,
          kind: options.kind,
          source: options.source,
          license: options.license,
          variants: [
            {
              id: `${options.id}:appearance`,
              name: options.name,
              style: options.style,
              revision: 1,
              mediaId,
              frames: [
                {
                  x: 0,
                  y: 0,
                  width: options.width,
                  height: options.height,
                  duration: 60,
                },
              ],
              clips: [],
              sockets: {
                origin: { x: 0, y: 0 },
                ground: { x: options.width / 2, y: options.height },
              },
              logicalHeight:
                options.logicalHeight ??
                (options.kind === "set" ? 176 : Math.min(options.height, 48)),
              ready: true,
            },
          ],
        },
      ],
      media: [
        {
          id: mediaId,
          name: options.name,
          mime,
          dataUrl,
          source: options.source,
          license: options.license,
        },
      ],
    }),
  );
}
