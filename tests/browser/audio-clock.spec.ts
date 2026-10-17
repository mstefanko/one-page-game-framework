import { test, expect } from "@playwright/test";
const sourceUrl = (name: string) =>
  `/@fs${process.cwd()}/packages/${name}/src/index.ts`;
const urls = {
  project: sourceUrl("project"),
  audio: sourceUrl("music-web-audio"),
};
test("audio-clock energy changes preserve tempo, stall recovery stays finite, stop/dispose clean up", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.mouse.click(1, 1);
  const metrics = await page.evaluate(async (urls) => {
    const { createBlankScore } = (await import(
      urls.project
    )) as typeof import("../../packages/project/src/index");
    const { AudioEngine } = (await import(
      urls.audio
    )) as typeof import("../../packages/music-web-audio/src/index");
    const score = createBlankScore();
    score.patterns[0]!.notes = Array.from({ length: 16 }, (_, i) => ({
      id: String(i),
      startTick: i * 240,
      durationTicks: 120,
      pitch: 60 + (i % 4),
      velocity: 0.5,
    }));
    const engine = new AudioEngine();
    await engine.play(score);
    await new Promise((r) => setTimeout(r, 120));
    const beforeTick = engine.getPositionTick(),
      beforeTime = engine.currentTime;
    engine.setEnergy(1);
    const afterTick = engine.getPositionTick();
    const stallStart = performance.now();
    while (performance.now() - stallStart < 180) {
      /* Deliberate main-thread scheduling interruption. */
    }
    await new Promise((r) => setTimeout(r, 60));
    const recoveredTick = engine.getPositionTick(),
      recoveredTime = engine.currentTime;
    const cancel = engine.previewNote(score.patches[0]!, 72, 0.5, 1);
    cancel();
    cancel();
    engine.stop();
    const stopped = engine.isPlaying;
    await engine.dispose();
    return {
      beforeTick,
      afterTick,
      recoveredTick,
      elapsedAudio: recoveredTime - beforeTime,
      elapsedTicks: recoveredTick - beforeTick,
      stopped,
      state: engine.state,
    };
  }, urls);
  expect(metrics.afterTick).toBeGreaterThanOrEqual(metrics.beforeTick);
  expect(metrics.afterTick - metrics.beforeTick).toBeLessThan(30);
  expect(Number.isFinite(metrics.recoveredTick)).toBe(true);
  expect(metrics.recoveredTick).toBeGreaterThan(metrics.afterTick);
  expect(metrics.elapsedTicks).toBeCloseTo(metrics.elapsedAudio * 960, 3);
  expect(metrics.stopped).toBe(false);
  expect(metrics.state).toBe("closed");
  console.log("Audio clock metrics:", JSON.stringify(metrics));
  await testInfo.attach("audio-clock-metrics.json", {
    body: JSON.stringify(metrics, null, 2),
    contentType: "application/json",
  });
});
test("3120-tick offline phrases retain exact finite length and report loop boundary metrics", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const metrics = await page.evaluate(async (urls) => {
    const { createBlankScore } = (await import(
      urls.project
    )) as typeof import("../../packages/project/src/index");
    const { renderScore } = (await import(
      urls.audio
    )) as typeof import("../../packages/music-web-audio/src/index");
    const score = createBlankScore();
    score.lengthTicks = 3120;
    score.loop = { startTick: 0, endTick: 3120 };
    score.patterns[0]!.lengthTicks = 3120;
    score.patches[0]!.release = 0.2;
    score.patterns[0]!.notes = [
      {
        id: "first",
        startTick: 0,
        durationTicks: 240,
        pitch: 60,
        velocity: 0.6,
      },
      {
        id: "last",
        startTick: 3000,
        durationTicks: 120,
        pitch: 67,
        velocity: 0.6,
      },
    ];
    const buffer = await renderScore(score, {
      startTick: 0,
      endTick: 3120,
      loops: 2,
      sampleRate: 48000,
      tailSeconds: 0,
    });
    const data = buffer.getChannelData(0),
      join = 156000;
    let peak = 0,
      nonfinite = 0,
      energy = 0;
    for (const sample of data) {
      if (!Number.isFinite(sample)) nonfinite++;
      peak = Math.max(peak, Math.abs(sample));
      energy += sample * sample;
    }
    return {
      frames: buffer.length,
      expectedFrames: 312000,
      phraseFrames: join,
      nonfinite,
      peak,
      rms: Math.sqrt(energy / data.length),
      continuousJoinDelta: Math.abs(data[join]! - data[join - 1]!),
      fileRepeatDelta: Math.abs(data[0]! - data[data.length - 1]!),
      note: "Metrics characterize this fixture in this browser. Tail-zero cropping is not a universal seamless-loop certification.",
    };
  }, urls);
  expect(metrics.frames).toBe(metrics.expectedFrames);
  expect(metrics.nonfinite).toBe(0);
  expect(metrics.peak).toBeGreaterThan(0.001);
  expect(metrics.peak).toBeLessThan(1);
  expect(Number.isFinite(metrics.continuousJoinDelta)).toBe(true);
  expect(Number.isFinite(metrics.fileRepeatDelta)).toBe(true);
  console.log("Loop boundary metrics:", JSON.stringify(metrics));
  await testInfo.attach("loop-boundary-metrics.json", {
    body: JSON.stringify(metrics, null, 2),
    contentType: "application/json",
  });
});
