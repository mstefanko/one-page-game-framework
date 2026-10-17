import { expect, test } from "@playwright/test";
import { pathToFileURL } from "node:url";

const sourceUrl = (name: string) =>
  `/@fs${process.cwd()}/packages/${name}/src/index.ts`;

test("browser source pack and MIDI preserve supported notes", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(
    async (urls) => {
      const project = (await import(
        urls.project
      )) as typeof import("../../packages/project/src/index");
      const io = (await import(
        urls.io
      )) as typeof import("../../packages/music-io/src/index");
      const core = (await import(
        urls.core
      )) as typeof import("../../packages/music-core/src/index");
      const score = project.createStarter("clockwork-steps");
      const pack = io.exportSourcePack(score);
      const restored = io.importSourcePack(pack);
      const midi = io.exportMidi(score);
      const review = io.inspectMidi(midi);
      const converted = io.convertMidi(review, { acceptLosses: true });
      const trace = (value: typeof score) =>
        core
          .compileScore(value)
          .map((note) => ({
            start: note.startTick,
            length: note.durationTicks,
            pitch: note.pitch,
            velocity: Math.round(note.velocity * 127),
          }))
          .sort(
            (a, b) =>
              a.start - b.start || a.pitch - b.pitch || a.length - b.length,
          );
      return {
        packSize: pack.length,
        exactSource: JSON.stringify(restored) === JSON.stringify(score),
        blocking: review.blocking,
        warnings: review.warnings,
        convertedTrace: trace(converted),
        sourceTrace: trace(score),
        length: converted.lengthTicks,
      };
    },
    {
      project: sourceUrl("project"),
      io: sourceUrl("music-io"),
      core: sourceUrl("music-core"),
    },
  );
  expect(result.packSize).toBeGreaterThan(100);
  expect(result.exactSource).toBe(true);
  expect(result.blocking).toEqual([]);
  expect(result.warnings.length).toBeGreaterThan(0);
  expect(result.convertedTrace).toEqual(result.sourceTrace);
  expect(result.length).toBe(3120);
});

test("shared offline graph renders finite audible PCM and a valid WAV", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(
    async (urls) => {
      const project = (await import(
        urls.project
      )) as typeof import("../../packages/project/src/index");
      const audio = (await import(
        urls.audio
      )) as typeof import("../../packages/music-web-audio/src/index");
      const score = project.createStarter();
      const buffer = await audio.renderScore(score, {
        startTick: 0,
        endTick: 480,
        loops: 1,
        sampleRate: 48000,
        tailSeconds: 0.1,
      });
      const wav = audio.encodeWav(buffer);
      const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
      let peak = 0,
        nonfinite = 0,
        pcmPeak = 0;
      for (let channel = 0; channel < buffer.numberOfChannels; channel++)
        for (const sample of buffer.getChannelData(channel)) {
          if (!Number.isFinite(sample)) nonfinite++;
          peak = Math.max(peak, Math.abs(sample));
        }
      for (let offset = 44; offset < wav.length; offset += 2)
        pcmPeak = Math.max(pcmPeak, Math.abs(view.getInt16(offset, true)));
      return {
        channels: buffer.numberOfChannels,
        frames: buffer.length,
        expectedFrames: Math.ceil((60 / score.bpm + 0.1) * 48000),
        sampleRate: buffer.sampleRate,
        peak,
        pcmPeak,
        nonfinite,
        header: String.fromCharCode(...wav.subarray(0, 4)),
        wave: String.fromCharCode(...wav.subarray(8, 12)),
        wavSize: wav.length,
        declaredSize: view.getUint32(40, true),
      };
    },
    { project: sourceUrl("project"), audio: sourceUrl("music-web-audio") },
  );
  expect(result.channels).toBe(2);
  expect(result.sampleRate).toBe(48000);
  expect(result.frames).toBe(result.expectedFrames);
  expect(result.nonfinite).toBe(0);
  expect(result.peak).toBeGreaterThan(0.001);
  expect(result.peak).toBeLessThan(1);
  expect(result.pcmPeak).toBeGreaterThan(30);
  expect(result.header).toBe("RIFF");
  expect(result.wave).toBe("WAVE");
  expect(result.wavSize).toBe(44 + result.frames * result.channels * 2);
  expect(result.declaredSize).toBe(result.wavSize - 44);
});

test("downloaded standalone HTML opens from disk, unlocks playback and makes zero network requests", async ({
  page,
  context,
}, testInfo) => {
  await page.goto("/");
  const downloadPromise = page.waitForEvent("download");
  await page.evaluate(
    async (urls) => {
      const project = (await import(
        urls.project
      )) as typeof import("../../packages/project/src/index");
      const io = (await import(
        urls.io
      )) as typeof import("../../packages/music-io/src/index");
      const score = project.createStarter();
      score.title = "Local player <safe> & sound";
      const html = await io.createPlayerHtml(score);
      const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "pocket-score-player.html";
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    { project: sourceUrl("project"), io: sourceUrl("music-io") },
  );
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("pocket-score-player.html");
  const file = testInfo.outputPath("pocket-score-player.html");
  await download.saveAs(file);
  const player = await context.newPage();
  const network: string[] = [],
    errors: string[] = [];
  player.on("request", (request) => {
    if (/^https?:/i.test(request.url())) network.push(request.url());
  });
  player.on("pageerror", (error) => errors.push(error.message));
  await player.goto(pathToFileURL(file).href);
  await expect(player.locator("#title")).toHaveText(
    "Local player <safe> & sound",
  );
  await player.getByRole("button", { name: "Play / restart" }).click();
  await expect(player.getByRole("status")).toHaveText("Playing");
  // Let the real audio-clock scheduler pass several lookahead windows.
  await player.waitForTimeout(400);
  await player.getByRole("button", { name: "Stop / mute" }).click();
  await expect(player.getByRole("status")).toHaveText("Stopped");
  expect(network).toEqual([]);
  expect(errors).toEqual([]);
  await player.close();
});
