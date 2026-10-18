import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import {
  evaluateScene,
  sceneDuration,
} from "../../packages/director-core/src/index";
import type { SceneDocument } from "../../packages/director-core/src/types";

async function open(page: Page) {
  await page.goto("/");
  await expect(
    page.getByText("Saved in this browser", { exact: true }),
  ).toBeVisible();
}
async function exportedScene(page: Page): Promise<SceneDocument> {
  await page.getByRole("button", { name: /Use in game/ }).click();
  const event = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download scene pack", exact: true })
    .click();
  const download = await event;
  const data = JSON.parse(await readFile((await download.path())!, "utf8"));
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  return data.scene ?? data;
}
async function drag(page: Page, locator: Locator, dx: number, dy = 0) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width / 2,
    y = box!.y + box!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 6 });
  await page.mouse.up();
}
const undo = (page: Page) => page.getByRole("button", { name: /↶ Undo/ });

test("blank scene has no station content and Recent scenes restores the saved draft", async ({
  page,
}) => {
  await open(page);
  const original = await exportedScene(page);
  await page.getByRole("button", { name: /New scene/ }).click();
  const dialog = page.getByRole("dialog", { name: "New scene", exact: true });
  await dialog
    .getByLabel("New scene title", { exact: true })
    .fill("Regression blank scene");
  await dialog
    .getByRole("button", { name: "Start blank scene", exact: true })
    .click();
  await expect(page.locator(".pd-title")).toHaveText("Regression blank scene");
  const blank = await exportedScene(page);
  expect(blank.actors).toEqual([]);
  expect(blank.layers).toEqual([]);
  expect(blank.motions).toEqual([]);
  expect(blank.dialogue).toEqual([]);
  expect(blank.camera).toEqual([]);
  await page.getByRole("button", { name: /New scene/ }).click();
  await page
    .getByRole("dialog", { name: "New scene", exact: true })
    .getByRole("button")
    .filter({ hasText: original.title + " · revision" })
    .click();
  await expect(page.locator(".pd-title")).toHaveText(original.title);
  const restored = await exportedScene(page);
  expect(restored.actors).toEqual(original.actors);
  expect(restored.shots).toEqual(original.shots);
  expect(restored.dialogue).toEqual(original.dialogue);
});

for (const viewport of [
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
  { width: 1280, height: 800 },
]) {
  test(`workspace bounds the canvas and exposes timeline at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await open(page);
    const stage = await page.locator("canvas").first().boundingBox();
    const timeline = page.getByRole("region", { name: "Scene timeline" });
    const bounds = await timeline.boundingBox();
    expect(stage).not.toBeNull();
    expect(bounds).not.toBeNull();
    expect(stage!.width).toBeLessThanOrEqual(768);
    expect(stage!.height).toBeLessThanOrEqual(529);
    if (viewport.height >= 1080)
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
    else {
      expect(bounds!.y).toBeLessThan(viewport.height);
      await timeline.scrollIntoViewIfNeeded();
      await expect(timeline).toBeInViewport();
    }
    const size = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      width: innerWidth,
    }));
    expect(size.scroll).toBeLessThanOrEqual(size.width);
  });
}

test("selecting a keeper motion preserves its identity and drag grab offset", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page
    .getByRole("button", { name: "Select or move Keeper · walk", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Keeper", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Stage operation", exact: true })
    .selectOption("Starting pose");
  const before = await exportedScene(page);
  const motion = before.motions.find((m) => m.id === "keeper-approaches")!;
  const shot = before.shots.find((s) => s.id === motion.shotId)!;
  const frame = evaluateScene(before, shot.start + motion.start);
  const canvas = page.locator("canvas").first();
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  const project = (x: number, y: number) => ({
    x:
      box.x +
      (((x - frame.camera.x) * frame.camera.zoom + before.width / 2) /
        before.width) *
        box.width,
    y:
      box.y +
      (((y - frame.camera.y) * frame.camera.zoom + before.height / 2) /
        before.height) *
        box.height,
  });
  // Grab inside the body, away from its origin. The body offset must survive the drag.
  const start = project(motion.from.x + 3, motion.from.y - 10);
  const end = project(motion.from.x + 10, motion.from.y - 13);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 6 });
  await page.mouse.up();
  const after = await exportedScene(page);
  const changed = after.motions.find((m) => m.id === motion.id)!;
  expect(changed.from).toEqual({ x: motion.from.x + 7, y: motion.from.y - 3 });
  expect(after.motions.find((m) => m.id === "courier-arrives")).toEqual(
    before.motions.find((m) => m.id === "courier-arrives"),
  );
  await expect(
    page.getByRole("heading", { name: "Keeper", exact: true }),
  ).toBeVisible();
});

test("timeline move and edge resize each commit one undo transaction", async ({
  page,
}) => {
  await open(page);
  const before = await exportedScene(page);
  const clip = before.motions.find((m) => m.id === "courier-arrives")!;
  const total = sceneDuration(before);
  const rail = page.locator(".pd-timing-motion .pd-timing-rail");
  await rail.scrollIntoViewIfNeeded();
  const railWidth = (await rail.boundingBox())!.width;
  await drag(
    page,
    page
      .getByRole("button", {
        name: "Select or move Courier · walk",
        exact: true,
      })
      .first(),
    (railWidth * 30) / total,
  );
  const moved = await exportedScene(page);
  expect(moved.motions.find((m) => m.id === clip.id)!.start).toBe(
    clip.start + 30,
  );
  expect(moved.motions.find((m) => m.id === clip.id)!.duration).toBe(
    clip.duration,
  );
  await undo(page).click();
  expect((await exportedScene(page)).motions).toEqual(before.motions);
  await expect(undo(page)).toBeDisabled();
  await drag(
    page,
    page
      .getByRole("button", {
        name: "Resize end of Courier · walk",
        exact: true,
      })
      .first(),
    (railWidth * 30) / total,
  );
  const resized = await exportedScene(page);
  expect(resized.motions.find((m) => m.id === clip.id)!.duration).toBe(
    clip.duration + 30,
  );
  await undo(page).click();
  expect((await exportedScene(page)).motions).toEqual(before.motions);
  await expect(undo(page)).toBeDisabled();
});

test("camera push animates zoom while style changes remain explicitly preview only", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: /Camera & framing/ }).click();
  await page.getByRole("button", { name: "Push in", exact: true }).click();
  await expect(page.getByLabel("Start zoom", { exact: true })).toHaveValue("1");
  await expect(page.getByLabel("End zoom", { exact: true })).toHaveValue("1.5");
  const scene = await exportedScene(page);
  const key = scene.camera.find((c) => c.shotId === scene.shots[0].id)!;
  const start = evaluateScene(scene, key.start + scene.shots[0].start);
  const end = evaluateScene(
    scene,
    key.start + scene.shots[0].start + key.duration - 1,
  );
  expect(start.camera.zoom).toBe(1);
  expect(end.camera.zoom).toBeGreaterThan(1.49);
  await page
    .getByRole("combobox", { name: "Look", exact: true })
    .selectOption("16-bit");
  await expect(page.locator(".pd-preview-banner")).toContainText(
    "Preview only · 16-bit",
  );
  expect((await exportedScene(page)).style).toBe("8-bit");
  await page
    .getByRole("button", { name: "Discard candidate", exact: true })
    .click();
  await expect(page.locator(".pd-preview-banner")).toHaveCount(0);
});

test("disconnected prompt creation retains the new title and brief in an empty scene", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: /New scene/ }).click();
  const dialog = page.getByRole("dialog", { name: "New scene", exact: true });
  const title = "A quiet pier";
  const brief =
    "An empty moonlit pier, then a title announces the final ferry.";
  await dialog.getByLabel("New scene title", { exact: true }).fill(title);
  await dialog.getByLabel("Scene brief", { exact: true }).fill(brief);
  await dialog
    .getByRole("checkbox", {
      name: "Offer starter asset library to the agent",
      exact: true,
    })
    .uncheck();
  await dialog
    .getByRole("button", { name: "Create from prompt", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Agents & services", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.locator(".pd-title")).toHaveText(title);
  const scene = await exportedScene(page);
  expect(scene.title).toBe(title);
  expect(scene.brief).toBe(brief);
  expect(scene.actors).toEqual([]);
  expect(scene.layers).toEqual([]);
  expect(scene.assets).toEqual([]);
});

test("a blank scene can be authored with a starter character, walk and title and exported", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: /New scene/ }).click();
  const dialog = page.getByRole("dialog", { name: "New scene", exact: true });
  await dialog
    .getByLabel("New scene title", { exact: true })
    .fill("Manual opening");
  await dialog
    .getByRole("button", { name: "Start blank scene", exact: true })
    .click();
  await page.getByRole("button", { name: "Assets", exact: true }).click();
  await page
    .getByRole("button", { name: "Add starter library", exact: true })
    .click();
  const courier = page.locator(".pd-assets article").filter({
    has: page.getByRole("heading", { name: "Courier", exact: true }),
  });
  await courier
    .getByRole("button", { name: "Add character to stage", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Courier", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "＋ Walk action", exact: true })
    .click();
  await page
    .getByRole("button", { name: "＋ Title card", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Line text", exact: true })
    .fill("The last ferry");
  const scene = await exportedScene(page);
  expect(scene.title).toBe("Manual opening");
  expect(scene.actors).toHaveLength(1);
  expect(scene.actors[0].familyId).toBe("lantern:courier");
  expect(scene.motions).toHaveLength(1);
  expect(scene.motions[0].actorId).toBe(scene.actors[0].id);
  expect(scene.motions[0].action).toBe("walk");
  expect(scene.motions[0].to.x).toBeGreaterThan(scene.motions[0].from.x);
  expect(scene.dialogue).toHaveLength(1);
  expect(scene.dialogue[0].style).toBe("title");
  expect(scene.dialogue[0].text).toBe("The last ferry");
  expect(scene.assets.some((a) => a.id === "lantern:courier")).toBe(true);
});
