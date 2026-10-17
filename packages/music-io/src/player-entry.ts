import { assertScore } from "@onepage/project";
import { AudioEngine } from "@onepage/music-web-audio";

const engine = new AudioEngine();
const status = document.getElementById("status")!;
try {
  const score: unknown = JSON.parse(
    document.getElementById("song-data")!.textContent!,
  );
  assertScore(score);
  document.getElementById("title")!.textContent = score.title;
  document.getElementById("play")!.addEventListener("click", async () => {
    try {
      await engine.play(score, {
        loop: (document.getElementById("loop") as HTMLInputElement).checked,
      });
      status.textContent = "Playing";
    } catch (error) {
      status.textContent =
        error instanceof Error ? error.message : "Sound could not start";
    }
  });
  document.getElementById("stop")!.addEventListener("click", () => {
    engine.stop();
    status.textContent = "Stopped";
  });
  window.addEventListener("pagehide", () => {
    void engine.dispose();
  });
} catch {
  status.textContent = "This player contains invalid song data";
}
