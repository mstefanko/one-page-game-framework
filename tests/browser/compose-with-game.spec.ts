import { expect, test } from "@playwright/test";

test("compose an original and fresh music while the same playable fixture keeps running", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/local-games/terminator/catalog.json", (route) =>
    route.fulfill({ status: 404, body: "missing" }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "New song / live pad" }).click();
  await page.getByLabel("Song title").fill("My preserved draft");
  await expect(page.locator(".save-status")).toContainText(
    "Saved in this browser",
  );
  await page.getByLabel("Game preview project").selectOption("fixture");
  // These actions are available in the compact dock, without visiting Game audio.
  await page
    .getByRole("button", { name: "Edit original", exact: true })
    .click();
  await expect(page.getByLabel("Song title")).toHaveValue(
    "Midnight Delivery (game snapshot copy)",
  );
  await expect(page.getByLabel("Game music source")).toHaveValue("working");
  await expect(
    page
      .locator(".transport")
      .getByRole("button", { name: "■ Stop", exact: true }),
  ).toBeEnabled();
  const viewport = page.getByLabel("Lantern Courier playable preview");
  await viewport.evaluate((el) => el.setAttribute("data-mounted-once", "same"));
  await page
    .getByRole("button", { name: "Begin journey", exact: true })
    .click();
  await page.getByRole("button", { name: "Walk →", exact: true }).click();
  const courier = await page.locator(".ga-courier").getAttribute("style");
  await page.getByLabel("Song title").fill("Working path cue");
  await expect(page.locator(".transport")).toContainText(
    "Changes queued for next loop",
  );
  await page
    .getByRole("button", { name: "Hear edits now", exact: true })
    .click();
  await expect(page.locator(".transport")).not.toContainText(
    "Changes queued for next loop",
  );
  await expect(page.locator(".ga-courier")).toHaveAttribute("style", courier!);
  await expect(viewport).toHaveAttribute("data-mounted-once", "same");
  await page.getByRole("button", { name: "Studio", exact: true }).click();
  await expect(viewport).toHaveAttribute("data-mounted-once", "same");
  await page.getByRole("button", { name: "Game audio", exact: true }).click();
  await expect(viewport).toHaveAttribute("data-mounted-once", "same");
  await expect(page.locator(".ga-courier")).toHaveAttribute("style", courier!);
  await page.getByRole("button", { name: "Sketch", exact: true }).click();
  await page.getByRole("button", { name: "Live pad", exact: true }).click();
  await expect(
    page.getByRole("application", { name: /Live pad for/ }),
  ).toBeVisible();
  await page
    .locator(".transport")
    .getByRole("button", { name: "■ Stop", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Walk →", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Start fresh with game", exact: true })
    .click();
  await expect(page.getByLabel("Song title")).toHaveValue(/^New music ·/);
  await expect(page.locator(".pattern-tools")).toContainText("0 notes");
  await expect(viewport).toHaveAttribute("data-mounted-once", "same");
  await expect(page.locator(".ga-viewport")).toHaveClass(/ga-explore/);
  await page
    .getByRole("button", { name: "Collapse game preview", exact: true })
    .click();
  await expect(viewport).toBeHidden();
  await page
    .getByRole("button", { name: "Preview game beside editor", exact: true })
    .click();
  await expect(viewport).toHaveAttribute("data-mounted-once", "same");
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await expect(
    page.locator(".library-entry").filter({ hasText: "My preserved draft" }),
  ).toHaveCount(1);
  await expect(
    page.locator(".library-entry").filter({ hasText: "Working path cue" }),
  ).toHaveCount(1);
  expect(errors).toEqual([]);
});
