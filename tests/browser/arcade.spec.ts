import { test, expect, type Page } from "@playwright/test";
const sourceUrl = (name: string) =>
  `/@fs${process.cwd()}/packages/${name}/src/index.ts`;
async function openArcade(page: Page, mode = "Phrase Rider") {
  await page.goto("/");
  await page.getByRole("button", { name: "New song / live pad" }).click();
  await page.getByRole("button", { name: "Arcade · lab", exact: true }).click();
  if (mode !== "Phrase Rider")
    await page.getByRole("button", { name: new RegExp(`^${mode}`) }).click();
  await page.getByLabel("Phrase intensity").selectOption("1");
  await page.getByLabel("Arcade loop length").selectOption("1");
}
async function savedScore(page: Page) {
  return page.evaluate(async (url) => {
    const { createLibrary } = (await import(
      url
    )) as typeof import("../../packages/asset-library/src/index");
    const library = await createLibrary();
    try {
      const entries = await library.list();
      return (await library.readDraft(entries[0]!.id))!.score;
    } finally {
      library.close();
    }
  }, sourceUrl("asset-library"));
}
async function review(page: Page) {
  await expect(
    page.getByText("TAKE READY TO REVIEW", { exact: true }),
  ).toBeVisible({ timeout: 12000 });
  await expect(
    page.getByRole("button", { name: /^Keep [1-9]\d* notes$/ }),
  ).toBeEnabled();
}
async function keepNewPart(page: Page) {
  await page.getByRole("button", { name: /^Keep [1-9]\d* notes$/ }).click();
  await page.getByRole("button", { name: /Add as a new part/ }).click();
  await expect(page.locator(".save-status")).toContainText(
    "Saved in this browser",
  );
}

test("Jam captures nothing and rapid moves queue a whole phrase without stacking notes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openArcade(page);
  await page.evaluate(async (url) => {
    const { AudioEngine } = (await import(
      performance
        .getEntriesByType("resource")
        .find((entry) => entry.name.includes("/music-web-audio/src/index.ts"))
        ?.name ?? url
    )) as typeof import("../../packages/music-web-audio/src/index");
    const original = AudioEngine.prototype.previewNote;
    (window as unknown as { arcadeOnsets: number[] }).arcadeOnsets = [];
    AudioEngine.prototype.previewNote = function (...args) {
      (window as unknown as { arcadeOnsets: number[] }).arcadeOnsets.push(
        this.currentTime + (args[6] ?? 0),
      );
      return original.apply(this, args);
    };
  }, sourceUrl("music-web-audio"));
  await page.getByRole("button", { name: "Start jam", exact: true }).click();
  const arena = page.getByRole("group", { name: "Reedrunner playable arena" });
  await expect(arena).toBeFocused();
  await page.keyboard.press("j");
  await page.keyboard.press("k");
  await page.keyboard.press("l");
  await page.keyboard.press("i");
  await expect(page.getByText(/next: Resolve/)).toBeVisible();
  await page.waitForTimeout(650);
  await expect(
    page.getByRole("button", { name: "Keep 0 notes", exact: true }),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { arcadeOnsets: number[] }).arcadeOnsets.length,
    ),
  ).toBeLessThanOrEqual(3);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { arcadeOnsets: number[] }).arcadeOnsets.length,
    ),
  ).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Rest · R", exact: true }).click();
  await expect(page.getByText("Playing: Rest", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  expect(errors).toEqual([]);
});

test("one bounded recording auto-stops, replays, keeps separate weapons and supports undo", async ({
  page,
}) => {
  await openArcade(page);
  await page.getByLabel("Arcade loop length").selectOption("2");
  await page
    .getByRole("button", { name: "Record next loop", exact: true })
    .click();
  await expect(page.getByText(/COUNT IN ·/)).toBeVisible();
  await expect(
    page.getByText("● RECORDING · one loop", { exact: true }),
  ).toBeVisible({ timeout: 6500 });
  await page.waitForTimeout(600);
  await page.getByLabel("Weapon / instrument").selectOption("staff");
  await review(page);
  const countBefore = await page
    .getByRole("button", { name: /^Keep \d+ notes$/ })
    .textContent();
  await page.waitForTimeout(350);
  await expect(
    page.getByRole("button", { name: countBefore!, exact: true }),
  ).toBeEnabled();
  await expect(page.getByText(/2 instrument lanes/)).toBeVisible();
  await page.getByRole("button", { name: "Replay take", exact: true }).click();
  await expect(page.getByText("REPLAYING TAKE", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await page.getByRole("button", { name: "Notes", exact: true }).click();
  await expect(page.getByText(/Arcade take preserved/)).toBeVisible();
  await page.getByRole("button", { name: "Return to Arcade take" }).click();
  await keepNewPart(page);
  await expect(page.locator(".part")).toHaveCount(3);
  const saved = await savedScore(page);
  expect(saved.bpm).toBe(120);
  expect(
    saved.tracks
      .slice(1)
      .map((t) => saved.patches.find((p) => p.id === t.patchId)?.waveform),
  ).toEqual(["pulse", "sine"]);
  expect(
    saved.patterns
      .slice(1)
      .flatMap((p) => p.notes)
      .every((n) => n.startTick + n.durationTicks <= 3840),
  ).toBe(true);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".part")).toHaveCount(1);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(page.locator(".part")).toHaveCount(3);
  await page.getByRole("button", { name: "Arcade · lab", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Keep 0 notes", exact: true }),
  ).toBeDisabled();
});

test("Groove Fighter records an explicit drum role from a melodic selected part", async ({
  page,
}) => {
  await openArcade(page, "Groove Fighter");
  await page.getByLabel("Phrase intensity").selectOption("3");
  await page
    .getByRole("button", { name: "Record next loop", exact: true })
    .click();
  await review(page);
  await keepNewPart(page);
  const saved = await savedScore(page);
  expect(saved.tracks.at(-1)!.role).toBe("drums");
  expect(
    saved.patches.find((p) => p.id === saved.tracks.at(-1)!.patchId)?.waveform,
  ).toBe("noise");
  expect(saved.patterns.at(-1)!.notes.some((n) => n.pitch === 36)).toBe(true);
  expect(saved.patterns.at(-1)!.notes.some((n) => n.pitch === 38)).toBe(true);
});

test("Ribbon Lead follows held input, gates immediately on release, and records one monophonic lane", async ({
  page,
}) => {
  await openArcade(page, "Ribbon Lead");
  await page
    .getByRole("button", { name: "Record next loop", exact: true })
    .click();
  await expect(
    page.getByText("● RECORDING · one loop", { exact: true }),
  ).toBeVisible({ timeout: 5000 });
  const arena = page.getByRole("group", { name: "Reedrunner playable arena" });
  await arena.focus();
  await page.keyboard.down("k");
  await page.keyboard.down("k");
  await page.waitForTimeout(580);
  await page.keyboard.up("k");
  const count = await page
    .getByRole("button", { name: /^Keep \d+ notes$/ })
    .textContent();
  await page.waitForTimeout(400);
  await expect(
    page.getByRole("button", { name: count!, exact: true }),
  ).toBeDisabled();
  await expect(page.getByText("Playing: Rest", { exact: true })).toBeVisible();
  await review(page);
  await keepNewPart(page);
  const saved = await savedScore(page);
  const notes = saved.patterns.at(-1)!.notes;
  expect(notes.length).toBeGreaterThanOrEqual(3);
  expect(notes.length).toBeLessThanOrEqual(6);
  expect(notes.at(-1)!.pitch).toBeGreaterThan(notes[0]!.pitch);
  expect(
    notes.at(-1)!.startTick + notes.at(-1)!.durationTicks - notes[0]!.startTick,
  ).toBeLessThan(700);
  for (let i = 1; i < notes.length; i++)
    expect(
      notes[i - 1]!.startTick + notes[i - 1]!.durationTicks,
    ).toBeLessThanOrEqual(notes[i]!.startTick + 2);
});

test("phone pointer cancellation releases Ribbon and controls fit without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openArcade(page, "Ribbon Lead");
  await page.getByRole("button", { name: "Start jam", exact: true }).click();
  const ribbon = page.getByRole("slider", { name: "Ribbon pitch height" });
  await ribbon.dispatchEvent("pointerdown", {
    pointerId: 1,
    pointerType: "touch",
    clientX: 200,
    clientY: 700,
    isPrimary: true,
  });
  await page.waitForTimeout(180);
  await ribbon.dispatchEvent("pointercancel", {
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
  });
  await page.waitForTimeout(200);
  await expect(page.getByText("Playing: Rest", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "Keep 0 notes", exact: true }),
  ).toBeDisabled();
  await page.screenshot({
    path: ".local/arcade-ribbon-phone.png",
    fullPage: true,
  });
});

test("recorded rest discards unsounded scheduled notes and keeps a bounded partial take", async ({
  page,
}) => {
  await openArcade(page);
  await page
    .getByRole("button", { name: "Record next loop", exact: true })
    .click();
  await expect(
    page.getByText("● RECORDING · one loop", { exact: true }),
  ).toBeVisible({ timeout: 5000 });
  await page.getByRole("button", { name: "Rest · R", exact: true }).click();
  await review(page);
  await keepNewPart(page);
  const saved = await savedScore(page);
  const notes = saved.patterns.at(-1)!.notes;
  expect(notes[0]!.startTick).toBe(0);
  expect(notes.length).toBe(1);
  expect(notes[0]!.durationTicks).toBeLessThan(480);
});

test("a nonzero loop retains selected-pattern coordinates and transposed replacement preserves heard pitch", async ({
  page,
}) => {
  await openArcade(page);
  await expect(page.locator(".save-status")).toContainText(
    "Saved in this browser",
  );
  await page.evaluate(async (url) => {
    const { createLibrary } = (await import(
      url
    )) as typeof import("../../packages/asset-library/src/index");
    const library = await createLibrary();
    try {
      const entry = (await library.list())[0]!;
      const draft = (await library.readDraft(entry.id))!;
      draft.score.clips[0]!.startTick = 480;
      draft.score.clips[0]!.transpose = 12;
      draft.score.patterns[0]!.lengthTicks = 3360;
      draft.score.loop = { startTick: 960, endTick: 2880 };
      await library.saveDraft(draft.score, draft.revision);
    } finally {
      library.close();
    }
  }, sourceUrl("asset-library"));
  await page.reload();
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page
    .locator(".library-entry")
    .getByRole("button")
    .filter({ hasText: "Untitled cue" })
    .click();
  await page.getByRole("button", { name: "Arcade · lab", exact: true }).click();
  await page.getByLabel("Phrase intensity").selectOption("1");
  await page.getByLabel("Arcade loop length").selectOption("1");
  await page.getByLabel("Weapon / instrument").selectOption("bow");
  await page.evaluate(async (url) => {
    const { AudioEngine } = (await import(
      performance
        .getEntriesByType("resource")
        .find((entry) => entry.name.includes("/music-web-audio/src/index.ts"))
        ?.name ?? url
    )) as typeof import("../../packages/music-web-audio/src/index");
    const original = AudioEngine.prototype.previewNote;
    (window as unknown as { arcadePitches: number[] }).arcadePitches = [];
    AudioEngine.prototype.previewNote = function (...args) {
      if (args[0].name === "Ember bow")
        (window as unknown as { arcadePitches: number[] }).arcadePitches.push(
          args[1],
        );
      return original.apply(this, args);
    };
  }, sourceUrl("music-web-audio"));
  await page
    .getByRole("button", { name: "Record next loop", exact: true })
    .click();
  await review(page);
  await page.getByRole("button", { name: /^Keep [1-9]\d* notes$/ }).click();
  await page.getByRole("button", { name: /Replace selected phrase/ }).click();
  await expect(page.locator(".save-status")).toContainText(
    "Saved in this browser",
  );
  const saved = await savedScore(page);
  const notes = saved.patterns[0]!.notes;
  expect(notes[0]!.startTick).toBe(480);
  expect(notes.every((n) => n.startTick + n.durationTicks <= 2400)).toBe(true);
  const heard = await page.evaluate(
    () => (window as unknown as { arcadePitches: number[] }).arcadePitches,
  );
  expect(notes.map((n) => n.pitch + saved.clips[0]!.transpose)).toEqual(
    heard.slice(-notes.length),
  );
  expect(
    saved.patches.find((p) => p.id === saved.tracks[0]!.patchId)?.waveform,
  ).toBe("sawtooth");
});
