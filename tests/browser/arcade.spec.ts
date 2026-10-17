import { test, expect, type Page } from "@playwright/test";

const sourceUrl = (name: string) =>
  `/@fs${process.cwd()}/packages/${name}/src/index.ts`;
async function openArcade(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "New song / live pad" }).click();
  await page.getByRole("button", { name: "Arcade · lab", exact: true }).click();
  await page.getByLabel("Phrase intensity").selectOption("1");
  await page
    .getByRole("button", { name: "Start fixed-tempo loop", exact: true })
    .click();
  await expect(
    page.getByRole("group", { name: "Reedrunner playable arena" }),
  ).toBeFocused();
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

test("weapon changes create separate editable instruments together and undo restores the song", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openArcade(page);
  await expect(
    page.getByRole("img", { name: "Reedrunner holding Pulse blade" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Strike · motif & reply", exact: true })
    .click();
  await page.getByLabel("Weapon / instrument").selectOption("staff");
  await expect(
    page.getByRole("img", { name: "Reedrunner holding Moon staff" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Leap · rising phrase", exact: true })
    .click();
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await page.getByRole("button", { name: "Notes", exact: true }).click();
  await expect(page.getByText(/Arcade take preserved · 4 notes/)).toBeVisible();
  await page.getByRole("button", { name: "Return to Arcade take" }).click();
  await page.getByRole("button", { name: "Keep 4 notes", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Replace selected phrase/ }),
  ).toBeDisabled();
  await page.getByRole("button", { name: /Add as a new part/ }).click();
  await expect(page.locator(".part")).toHaveCount(3);
  await expect(page.locator(".save-status")).toContainText(
    "Saved in this browser",
  );
  const saved = await savedScore(page);
  expect(saved.bpm).toBe(120);
  expect(
    saved.tracks
      .slice(1)
      .map((t) => saved.patches.find((p) => p.id === t.patchId)?.waveform),
  ).toEqual(["pulse", "sine"]);
  expect(saved.patterns.slice(1).map((p) => p.notes.length)).toEqual([2, 2]);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".part")).toHaveCount(1);
  await expect(page.locator(".pattern-tools")).toContainText("0 notes");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(page.locator(".part")).toHaveCount(3);
  await page.getByRole("button", { name: "Arcade · lab", exact: true }).click();
  await page.screenshot({
    path: ".local/arcade-validation.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("focused held controls ignore OS repeat, move the character, and release on focus loss", async ({
  page,
}) => {
  await openArcade(page);
  const arena = page.getByRole("group", { name: "Reedrunner playable arena" });
  const initialX = await page.locator(".runner-position").getAttribute("style");
  await page.keyboard.down("ArrowRight");
  await page.keyboard.down("ArrowRight");
  await expect(
    page.getByRole("button", { name: "Keep 2 notes", exact: true }),
  ).toBeEnabled();
  expect(await page.locator(".runner-position").getAttribute("style")).not.toBe(
    initialX,
  );
  await page.waitForTimeout(600);
  await expect(
    page.getByRole("button", { name: "Keep 4 notes", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("Song title").focus();
  await page.keyboard.up("ArrowRight");
  await page.getByLabel("Song title").fill("jklwasd1234");
  await page.waitForTimeout(650);
  await expect(
    page.getByRole("button", { name: "Keep 4 notes", exact: true }),
  ).toBeEnabled();
  await arena.focus();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Start fixed-tempo loop", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Discard take", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Keep 0 notes", exact: true }),
  ).toBeDisabled();
});

test("fierce touch moves capture denser phrases while cancellation and phone layout stay safe", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openArcade(page);
  await page.getByLabel("Phrase intensity").selectOption("3");
  const dash = page.getByRole("button", { name: "← Dash left", exact: true });
  await dash.hover();
  await page.mouse.down();
  await dash.dispatchEvent("pointercancel", {
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true,
  });
  await page.mouse.up();
  await expect(
    page.getByRole("button", { name: "Keep 4 notes", exact: true }),
  ).toBeEnabled();
  await page.waitForTimeout(650);
  await expect(
    page.getByRole("button", { name: "Keep 4 notes", exact: true }),
  ).toBeEnabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await expect(page.getByRole("button", { name: /^120 BPM/ })).toBeVisible();
});

test("replacement preserves heard pitch on a transposed clip and restores its original patch with undo", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New song / live pad" }).click();
  await page.getByRole("button", { name: "Studio", exact: true }).click();
  await page.getByLabel("transpose", { exact: true }).fill("12");
  await page.getByRole("button", { name: "Arcade · lab", exact: true }).click();
  await page.getByLabel("Weapon / instrument").selectOption("bow");
  await page.getByLabel("Phrase intensity").selectOption("1");
  await page.evaluate(async (url) => {
    const { AudioEngine } = (await import(
      url
    )) as typeof import("../../packages/music-web-audio/src/index");
    const original = AudioEngine.prototype.previewNote;
    (window as unknown as { arcadePitches: number[] }).arcadePitches = [];
    AudioEngine.prototype.previewNote = function (...args) {
      (window as unknown as { arcadePitches: number[] }).arcadePitches.push(
        args[1],
      );
      return original.apply(this, args);
    };
  }, sourceUrl("music-web-audio"));
  await page
    .getByRole("button", { name: "Start fixed-tempo loop", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Strike · motif & reply", exact: true })
    .click();
  await page.getByRole("button", { name: "Keep 2 notes", exact: true }).click();
  await page.getByRole("button", { name: /Replace selected phrase/ }).click();
  await expect(page.locator(".save-status")).toContainText(
    "Saved in this browser",
  );
  const saved = await savedScore(page);
  const heard = await page.evaluate(
    () => (window as unknown as { arcadePitches: number[] }).arcadePitches,
  );
  expect(
    saved.patterns[0]!.notes.map((n) => n.pitch + saved.clips[0]!.transpose),
  ).toEqual(heard);
  expect(
    saved.patches.find((p) => p.id === saved.tracks[0]!.patchId)?.waveform,
  ).toBe("sawtooth");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".pattern-tools")).toContainText("0 notes");
});

test("canceling Keep then discarding leaves no stale snapshot blocking navigation", async ({
  page,
}) => {
  await openArcade(page);
  await page
    .getByRole("button", { name: "Strike · motif & reply", exact: true })
    .click();
  await page.getByRole("button", { name: "Keep 2 notes", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Discard take", exact: true }).click();
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page.getByRole("button", { name: "＋ New song", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByLabel("Song title")).toHaveValue("Untitled cue");
});
