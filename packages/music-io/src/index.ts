import { assertScore, type Score } from "@onepage/project";
import runtime from "./player-runtime.generated.js?raw";
export {
  exportSourcePack,
  importSourcePack,
  exportLibraryPack,
  importLibraryPack,
} from "./packs";
export { exportMidi, inspectMidi, convertMidi, type MidiReview } from "./midi";

/** Shared bundled player; all data remains inert until parsed and schema-validated. */
export async function createPlayerHtml(score: Score): Promise<string> {
  assertScore(score);
  const data = JSON.stringify(score)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  const script = runtime.replace(/<\/script/gi, "<\\/script");
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; base-uri 'none'; form-action 'none'"><title>Pocket Score player</title><style>body{font:18px system-ui;background:#111827;color:#eef2ff;max-width:42rem;margin:12vh auto;padding:2rem}button{font:inherit;padding:.7rem 1.2rem;margin-right:.5rem}label{display:block;margin:1.2rem 0}small{color:#b6c2da}</style><h1 id="title">Pocket Score</h1><button id="play">Play / restart</button><button id="stop">Stop / mute</button><label><input id="loop" type="checkbox" ${score.playback === "loop" ? "checked" : ""}> Loop</label><p id="status" role="status">Press Play to enable sound.</p><small>Made with Pocket Score · Music rights remain with its creator.</small><script id="song-data" type="application/json">${data}</script><script>${script}</script></html>`;
}
