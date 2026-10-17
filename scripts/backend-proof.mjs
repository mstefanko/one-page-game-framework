// Reproducible, non-browser portion of C1. This does not certify listening quality.
import { build } from "esbuild";
import { gzipSync } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
import { Song, Synth, Config } from "beepbox";
const custom = await build({
  stdin: {
    contents:
      "export {AudioEngine,renderScore} from '@onepage/music-web-audio';",
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "browser",
  minify: true,
});
const alternative = await build({
  stdin: {
    contents: "export {Synth,Song} from 'beepbox';",
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "browser",
  minify: true,
});
const adapter = {
  format: "BeepBox",
  version: 9,
  scale: "expert",
  key: "C",
  introBars: 0,
  loopBars: 1,
  beatsPerBar: 6.5,
  ticksPerBeat: 480,
  beatsPerMinute: 120,
  channels: [
    {
      type: "pitch",
      instruments: [{ type: "chip", wave: "square", volume: 60 }],
      patterns: [
        {
          notes: [
            {
              pitches: [57],
              points: [
                { tick: 0, pitchBend: 0, volume: 80 },
                { tick: 480, pitchBend: 0, volume: 80 },
              ],
            },
            {
              pitches: [60],
              points: [
                { tick: 2496, pitchBend: 0, volume: 80 },
                { tick: 2592, pitchBend: 0, volume: 80 },
              ],
            },
            {
              pitches: [57],
              points: [
                { tick: 2880, pitchBend: 0, volume: 80 },
                { tick: 3120, pitchBend: 0, volume: 80 },
              ],
            },
          ],
        },
      ],
      sequence: [1],
    },
  ],
};
const song = new Song();
song.fromJsonObject(adapter);
const roundtrip = song.toJsonObject();
// Pad to 7 beats to preserve notes for sample rendering; this changes loop length.
const padded = new Song();
padded.fromJsonObject({ ...adapter, beatsPerBar: 7 });
const synth = new Synth(padded);
synth.samplesPerSecond = 48000;
synth.loopRepeatCount = 0;
synth.snapToStart();
const length = 156000,
  L = new Float32Array(length),
  R = new Float32Array(length);
const started = performance.now();
synth.synthesize(L, R, length, true);
const elapsed = performance.now() - started;
synth.freeAllTones();
let peak = 0,
  sum = 0;
for (let i = 0; i < length; i++) {
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  sum += L[i] * L[i] + R[i] * R[i];
}
const bytes = (o) => ({
  minified: o.outputFiles[0].contents.length,
  gzip: gzipSync(o.outputFiles[0].contents).length,
});
const report = {
  runtime: process.version,
  beepboxVersion: "4.2.0",
  customBundleBytes: bytes(custom),
  beepboxBundleBytes: bytes(alternative),
  canonicalPPQ: 480,
  beepboxPartsPerBeat: Config.partsPerBeat,
  requestedBeatsPerBar: 6.5,
  importedBeatsPerBar: song.beatsPerBar,
  roundtrip,
  render: {
    sampleRate: 48000,
    frames: length,
    durationSeconds: length / 48000,
    computeMs: elapsed,
    peak,
    rms: Math.sqrt(sum / (length * 2)),
  },
  decision:
    "Native graph provisional production baseline. BeepBox can render but bar/tick adaptation loses exact canonical timing without custom crop/restart translation. Browser and listening evidence required separately.",
};
await mkdir(".local", { recursive: true });
await writeFile(".local/backend-proof.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, roundtrip: undefined }, null, 2));
