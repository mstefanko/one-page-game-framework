import { Inflate, strFromU8, strToU8, zipSync } from "fflate";
import { assertScore, type Score } from "@onepage/project";

const MAX_PAYLOAD = 8 * 1024 * 1024;
const MAX_ARCHIVE = 10 * 1024 * 1024;
const decoder = new TextDecoder("utf-8", { fatal: true });
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// SHA-256 over the exact UTF-8 payload bytes, independent of ZIP timestamps/compression.
function sha256(bytes: Uint8Array): string {
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const h = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
  ];
  const padded = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);
  padded.set(bytes);
  padded[bytes.length] = 128;
  new DataView(padded.buffer).setUint32(padded.length - 4, bytes.length * 8);
  const rotate = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  const words = new Uint32Array(64),
    view = new DataView(padded.buffer);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) words[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const a = words[i - 15],
        b = words[i - 2];
      words[i] =
        words[i - 16] +
        (rotate(a, 7) ^ rotate(a, 18) ^ (a >>> 3)) +
        words[i - 7] +
        (rotate(b, 17) ^ rotate(b, 19) ^ (b >>> 10));
    }
    let [a, b, c, d, e, f, g, j] = h;
    for (let i = 0; i < 64; i++) {
      const first =
        (j +
          (rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)) +
          ((e & f) ^ (~e & g)) +
          k[i] +
          words[i]) |
        0;
      const second =
        ((rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)) +
          ((a & b) ^ (a & c) ^ (b & c))) |
        0;
      j = g;
      g = f;
      f = e;
      e = (d + first) | 0;
      d = c;
      c = b;
      b = a;
      a = (first + second) | 0;
    }
    for (const [i, value] of [a, b, c, d, e, f, g, j].entries())
      h[i] = (h[i] + value) >>> 0;
  }
  return h.map((value) => value.toString(16).padStart(8, "0")).join("");
}
function crc32(bytes: Uint8Array): number {
  let crc = -1;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ -1) >>> 0;
}
function inflateBounded(compressed: Uint8Array, size: number): Uint8Array {
  const result = new Uint8Array(size);
  let written = 0;
  const inflater = new Inflate((chunk) => {
    if (written + chunk.length > size)
      throw new Error("ZIP payload exceeds its declared decompression limit");
    result.set(chunk, written);
    written += chunk.length;
  });
  // A small compressed chunk bounds temporary inflated allocations even for a forged size header.
  for (let offset = 0; offset < compressed.length; offset += 1024)
    inflater.push(
      compressed.subarray(offset, offset + 1024),
      offset + 1024 >= compressed.length,
    );
  if (!compressed.length || written !== size)
    throw new Error("ZIP payload does not match its declared size");
  return result;
}

/** Strict ZIP subset: stored/deflated entries, no encryption/descriptors/ZIP64 or extra paths. */
function unpack(bytes: Uint8Array): Map<string, Uint8Array> {
  if (bytes.length < 22 || bytes.length > MAX_ARCHIVE)
    throw new Error("Pack exceeds archive size limit or is truncated");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = bytes.length - 22;
  while (
    end >= Math.max(0, bytes.length - 65557) &&
    view.getUint32(end, true) !== 0x06054b50
  )
    end--;
  if (
    end < Math.max(0, bytes.length - 65557) ||
    end + 22 + view.getUint16(end + 20, true) !== bytes.length
  )
    throw new Error("Invalid ZIP directory");
  const count = view.getUint16(end + 10, true),
    central = view.getUint32(end + 16, true);
  if (
    view.getUint16(end + 4, true) ||
    view.getUint16(end + 6, true) ||
    count !== 2 ||
    view.getUint16(end + 8, true) !== count ||
    central + view.getUint32(end + 12, true) !== end
  )
    throw new Error("Unsupported ZIP structure or entry count");
  const result = new Map<string, Uint8Array>();
  const ranges: { start: number; end: number }[] = [];
  let offset = central,
    total = 0;
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50)
      throw new Error("Invalid ZIP entry");
    const flags = view.getUint16(offset + 8, true),
      method = view.getUint16(offset + 10, true);
    const checksum = view.getUint32(offset + 16, true),
      compressed = view.getUint32(offset + 20, true),
      size = view.getUint32(offset + 24, true);
    const nameSize = view.getUint16(offset + 28, true),
      extraSize = view.getUint16(offset + 30, true),
      commentSize = view.getUint16(offset + 32, true),
      local = view.getUint32(offset + 42, true);
    if (offset + 46 + nameSize + extraSize + commentSize > end)
      throw new Error("Truncated ZIP entry");
    const name = decoder.decode(
      bytes.subarray(offset + 46, offset + 46 + nameSize),
    );
    if (!["manifest.json", "payload.json"].includes(name) || result.has(name))
      throw new Error("Unsafe, duplicate, or unknown archive path");
    total += size;
    if (
      flags & ~0x800 ||
      ![0, 8].includes(method) ||
      total > MAX_PAYLOAD + 65536 ||
      size > (name === "manifest.json" ? 65536 : MAX_PAYLOAD) ||
      view.getUint16(offset + 34, true)
    )
      throw new Error("Unsupported ZIP entry or decompression limit");
    if (local + 30 > central || view.getUint32(local, true) !== 0x04034b50)
      throw new Error("Invalid local ZIP entry");
    const localNameSize = view.getUint16(local + 26, true),
      localExtraSize = view.getUint16(local + 28, true);
    const start = local + 30 + localNameSize + localExtraSize,
      stop = start + compressed;
    if (
      stop > central ||
      start > central ||
      view.getUint16(local + 6, true) !== flags ||
      view.getUint16(local + 8, true) !== method ||
      view.getUint32(local + 14, true) !== checksum ||
      view.getUint32(local + 18, true) !== compressed ||
      view.getUint32(local + 22, true) !== size ||
      decoder.decode(bytes.subarray(local + 30, local + 30 + localNameSize)) !==
        name
    )
      throw new Error("Inconsistent local ZIP entry");
    if (ranges.some((range) => local < range.end && stop > range.start))
      throw new Error("Overlapping ZIP entries");
    ranges.push({ start: local, end: stop });
    const compressedBytes = bytes.subarray(start, stop);
    const payload =
      method === 0
        ? compressedBytes.slice()
        : inflateBounded(compressedBytes, size);
    if (payload.length !== size || crc32(payload) !== checksum)
      throw new Error("Corrupt ZIP payload");
    result.set(name, payload);
    offset += 46 + nameSize + extraSize + commentSize;
  }
  if (offset !== end) throw new Error("Ambiguous ZIP directory");
  return result;
}
function exportPack(kind: "song" | "library", value: unknown): Uint8Array {
  const payload = strToU8(JSON.stringify(value));
  if (payload.length > MAX_PAYLOAD)
    throw new Error("Pack payload exceeds size limit");
  const manifest = {
    format: "onepage-music",
    schemaVersion: 1,
    kind,
    payload: {
      path: "payload.json",
      bytes: payload.length,
      sha256: sha256(payload),
    },
    provenance: {
      generator: "Pocket Score",
      note: "Authorship and rights remain with the song creator.",
    },
  };
  return zipSync({
    "manifest.json": strToU8(JSON.stringify(manifest)),
    "payload.json": payload,
  });
}
function importPack(bytes: Uint8Array, kind: "song" | "library"): unknown {
  const files = unpack(bytes);
  const manifest: unknown = JSON.parse(strFromU8(files.get("manifest.json")!));
  const payload = files.get("payload.json")!;
  if (
    !object(manifest) ||
    manifest.format !== "onepage-music" ||
    manifest.schemaVersion !== 1 ||
    manifest.kind !== kind ||
    !object(manifest.payload) ||
    manifest.payload.path !== "payload.json" ||
    manifest.payload.bytes !== payload.length ||
    manifest.payload.sha256 !== sha256(payload)
  )
    throw new Error("Unsupported manifest or corrupt payload hash");
  return JSON.parse(decoder.decode(payload));
}
export function exportSourcePack(score: Score): Uint8Array {
  assertScore(score);
  return exportPack("song", score);
}
export function importSourcePack(bytes: Uint8Array): Score {
  const score = importPack(bytes, "song");
  assertScore(score);
  return score;
}

function assertLibrary(value: unknown): void {
  if (
    !object(value) ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.drafts) ||
    !Array.isArray(value.versions)
  )
    throw new Error("Invalid library backup");
  const songIds = new Set<string>(),
    versionIds = new Set<string>();
  for (const draft of value.drafts) {
    if (
      !object(draft) ||
      !Number.isSafeInteger(draft.revision) ||
      (draft.revision as number) < 1 ||
      typeof draft.updatedAt !== "number" ||
      !Number.isFinite(draft.updatedAt) ||
      draft.updatedAt < 0
    )
      throw new Error("Invalid backup draft");
    assertScore(draft.score);
    if (songIds.has(draft.score.id)) throw new Error("Duplicate backup song");
    songIds.add(draft.score.id);
  }
  for (const version of value.versions) {
    if (
      !object(version) ||
      typeof version.id !== "string" ||
      !version.id ||
      typeof version.name !== "string" ||
      !version.name.trim() ||
      typeof version.createdAt !== "number" ||
      !Number.isFinite(version.createdAt) ||
      version.createdAt < 0
    )
      throw new Error("Invalid backup version");
    assertScore(version.score);
    if (version.scoreId !== version.score.id || versionIds.has(version.id))
      throw new Error("Invalid backup version identity");
    versionIds.add(version.id);
  }
}
export function exportLibraryPack(backup: unknown): Uint8Array {
  assertLibrary(backup);
  return exportPack("library", backup);
}
export function importLibraryPack(bytes: Uint8Array): unknown {
  const backup = importPack(bytes, "library");
  assertLibrary(backup);
  return backup;
}
