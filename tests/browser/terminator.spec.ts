import { test, expect } from "@playwright/test";
import { existsSync } from "node:fs";
const imported = existsSync(
  "apps/composer/public/local-games/terminator/index.html",
);
test("missing game source gives local import instructions and an explicit fixture", async ({
  page,
}) => {
  await page.route("**/local-games/terminator/catalog.json", (route) =>
    route.fulfill({ status: 404, body: "missing" }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "New song / live pad" }).click();
  await page.getByRole("button", { name: "Game audio", exact: true }).click();
  await expect(page.locator(".game-audio")).toContainText(
    "Import your local game source",
  );
  await page.getByLabel("Game preview project").selectOption("fixture");
  await expect(
    page.getByLabel("Lantern Courier playable preview"),
  ).toBeVisible();
});
test("actual imported game loads checkpoints, owns audio, accepts drafts and resets", async ({
  page,
}) => {
  test.skip(
    !imported,
    "Run import:terminator with a local source for this integration check",
  );
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "New song / live pad" }).click();
  await page.getByRole("button", { name: "Game audio", exact: true }).click();
  await expect(page.locator(".game-audio [role=status]")).toContainText(
    "Actual game connected",
  );
  const frame = page.frameLocator(
    'iframe[title="Terminator: Liquid Metal playable preview"]',
  );
  await expect(frame.locator("#game")).toBeVisible();
  const game = page
    .frames()
    .find((f) => f.url().includes("local-games/terminator/index.html"))!;
  const contexts = await page
    .getByLabel("Game scene checkpoint")
    .locator("option")
    .evaluateAll((options) =>
      options.map((o) => (o as HTMLOptionElement).value),
    );
  for (const id of contexts) {
    await page.getByLabel("Game scene checkpoint").selectOption(id);
    await expect
      .poll(() =>
        game.evaluate(() => (window as any).__TERMINATOR_PREVIEW__.contextId),
      )
      .toBe(id);
    await page
      .locator(".ga-toolbar")
      .getByRole("button", { name: "Play", exact: true })
      .click();
    await page.waitForTimeout(100);
    await page
      .locator(".ga-toolbar")
      .getByRole("button", { name: "Pause sound", exact: true })
      .click();
  }
  await page.getByLabel("Game scene checkpoint").selectOption("title");
  await page
    .locator(".ga-layout > aside")
    .first()
    .getByRole("button", { name: /^title/ })
    .click();
  await page
    .getByRole("button", { name: "Preview current draft", exact: true })
    .click();
  await page
    .locator(".ga-toolbar")
    .getByRole("button", { name: "Play", exact: true })
    .click();
  await expect
    .poll(() =>
      game.evaluate(() => (window as any).__TERMINATOR_PREVIEW__.draftAssetId),
    )
    .toBe("title");
  await expect
    .poll(() =>
      game.evaluate(
        () => (window as any).__TERMINATOR_PREVIEW__.canonicalPlaying,
      ),
    )
    .toBe(true);
  await game.evaluate(() =>
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "n" })),
  );
  await expect
    .poll(() => game.evaluate(() => (window as any).AUDIO.muted))
    .toBe(true);
  await expect
    .poll(() =>
      game.evaluate(
        () => (window as any).__TERMINATOR_PREVIEW__.canonicalPlaying,
      ),
    )
    .toBe(false);
  await game.evaluate(() =>
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "n" })),
  );
  await expect
    .poll(() =>
      game.evaluate(
        () => (window as any).__TERMINATOR_PREVIEW__.canonicalPlaying,
      ),
    )
    .toBe(true);
  await page
    .locator(".ga-toolbar")
    .getByRole("button", { name: "Pause sound", exact: true })
    .click();
  await expect
    .poll(() =>
      game.evaluate(
        () => (window as any).__TERMINATOR_PREVIEW__.canonicalPlaying,
      ),
    )
    .toBe(false);
  await page
    .getByRole("button", { name: "Reset checkpoint", exact: true })
    .click();
  await expect.poll(() => game.evaluate(() => (window as any).G.tick)).toBe(0);
  await page
    .locator(".ga-layout > aside")
    .first()
    .getByRole("button", { name: /^shotgun/ })
    .click();
  await page
    .getByRole("button", { name: "Audition sound effect", exact: true })
    .click();
  await expect(page.locator(".ga-observed")).toContainText("sfx-shotgun");
  await page
    .locator(".ga-layout > aside")
    .first()
    .getByRole("button", { name: /^title/ })
    .click();
  await page
    .getByRole("button", { name: "Edit pinned snapshot as draft", exact: true })
    .click();
  await expect(page.getByLabel("Song title")).toHaveValue(/^title/);
  await page.getByLabel("Song title").fill("Terminator title revised");
  await expect(
    page.getByTitle("Terminator: Liquid Metal playable preview"),
  ).toBeVisible();
  await page.screenshot({
    path: ".local/terminator-validation.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Game audio", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Save snapshot & apply current draft",
      exact: true,
    })
    .click();
  await expect(page.locator(".game-audio [role=status]")).toContainText(
    "Project assignments saved",
  );
  const saved = await game.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("pocket-score-projects");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return await new Promise<any>((resolve, reject) => {
      const request = db
        .transaction("projects")
        .objectStore("projects")
        .get("terminator-liquid-metal");
      request.onsuccess = () => {
        db.close();
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
    });
  });
  expect(saved.manifest.overrides.title.title).toBe("Terminator title revised");
  expect(
    (
      await (
        await page.request.get("/local-games/terminator/catalog.json")
      ).json()
    ).scores.title.title,
  ).toBe("title");
  expect(errors).toEqual([]);
});
