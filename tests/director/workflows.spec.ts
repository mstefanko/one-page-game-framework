import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("manual edits, prepared candidate, one-step undo and persistence", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByText("Saved in this browser", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /02.*The warning/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: /▧.*lamp/ }).click();
  await page.getByLabel("X position", { exact: true }).fill("12");
  await page.getByRole("button", { name: "Direct", exact: true }).click();
  await page.getByRole("button", { name: "Direction", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Appearance", exact: true })
    .selectOption("16-bit");
  await expect(
    page.getByRole("heading", { name: "16-bit appearance" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Keep revision", exact: true })
    .click();
  await page.getByRole("button", { name: "Inspect", exact: true }).click();
  await expect(page.getByLabel("X position", { exact: true })).toHaveValue(
    "12",
  );
  await page.getByRole("button", { name: /Undo/ }).click();
  await page.getByRole("button", { name: "Direction", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Appearance", exact: true }),
  ).toHaveValue("8-bit");
  await expect(
    page.getByText("Saved in this browser", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /▧.*lamp/ }).click();
  await expect(page.getByLabel("X position", { exact: true })).toHaveValue(
    "12",
  );
  expect(errors).toEqual([]);
  await page.screenshot({
    path: test.info().outputPath("director-desktop.png"),
    fullPage: true,
  });
});

test("scene-pack and offline HTML download are usable without a network", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await expect(
    page.getByText("Saved in this browser", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Use in game/ }).click();
  const packEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: /Download scene pack/ }).click();
  const pack = await packEvent;
  const packData = JSON.parse(await readFile((await pack.path())!, "utf8"));
  expect(JSON.stringify(packData)).toContain("lantern-courier");
  const htmlEvent = page.waitForEvent("download");
  await page
    .getByRole("button", {
      name: /Standalone HTML|Download.*HTML|Export.*HTML/,
    })
    .click();
  const html = await htmlEvent;
  const output = test.info().outputPath("scene.html");
  await html.saveAs(output);
  const offline = await browser.newContext({
    offline: true,
    viewport: { width: 390, height: 844 },
  });
  const player = await offline.newPage();
  const errors: string[] = [];
  player.on("pageerror", (e) => errors.push(e.message));
  const external: string[] = [];
  player.on("request", (r) => {
    if (/^https?:/.test(r.url())) external.push(r.url());
  });
  await player.goto("file://" + output);
  await expect(player.locator("canvas")).toBeVisible();
  await player.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(player.getByRole("status")).toContainText("Skipped");
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
  await player.screenshot({
    path: test.info().outputPath("offline-phone.png"),
  });
  await offline.close();
});

test("connection status is honest, companion token never becomes a scene asset", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Not connected/ }).click();
  await expect(
    page.getByRole("heading", { name: "Agents & services" }),
  ).toBeVisible();
  await expect(page.getByText(/Image creation: not connected/)).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.locator("canvas").first()).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    width: innerWidth,
  }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width);
  await page.screenshot({
    path: test.info().outputPath("director-compact.png"),
    fullPage: true,
  });
});

test("incomplete looks cannot be kept as ready output", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByText("Saved in this browser", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Appearance", exact: true })
    .selectOption("realistic");
  await expect(
    page.getByRole("heading", { name: "realistic appearance" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Keep revision", exact: true }),
  ).toBeDisabled();
  await expect(page.getByText(/walk frames/).first()).toBeVisible();
  await page
    .getByRole("button", { name: "Discard candidate", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Look", exact: true }),
  ).toHaveValue("8-bit");
});

test("pack import lets the author choose families and keeps pack provenance", async ({
  page,
}) => {
  const { createDemoScene } = await import(
    "../../packages/director-core/src/index"
  );
  const original = createDemoScene().assets[0];
  const pack = {
    schemaVersion: 1,
    id: "training-fighters",
    name: "Training fighters",
    version: "1",
    author: "Original artist",
    source: "Original test fixture",
    license: "MIT",
    assets: [
      {
        ...original,
        id: "training:fighter",
        name: "Training fighter",
        variants: original.variants.map((v) => ({
          ...v,
          id: "training:" + v.id,
        })),
      },
      {
        ...original,
        id: "unused:fighter",
        name: "Unused fighter",
        variants: original.variants.map((v) => ({
          ...v,
          id: "unused:" + v.id,
        })),
      },
    ],
    media: [],
  };
  await page.goto("/");
  await expect(
    page.getByText("Saved in this browser", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Assets", exact: true }).click();
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "fighters.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(pack)),
    });
  const dialog = page.getByRole("dialog", { name: "Import pack", exact: true });
  await expect(dialog.getByText(/Original artist/)).toBeVisible();
  await dialog.getByRole("checkbox").nth(1).uncheck();
  await dialog
    .getByRole("button", { name: "Import 1 selected families", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Training fighter", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Unused fighter", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Packs", exact: true }).click();
  await expect(
    page.getByText("Training fighters · 1", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Saved in this browser", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Assets", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Training fighter", exact: true }),
  ).toBeVisible();
});
