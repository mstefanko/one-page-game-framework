import { test, expect } from "@playwright/test";

test("a starter has its own metadata; edits, undo, version and reload preserve notes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page
    .locator(".starter")
    .filter({ hasText: "Pocket Sunrise" })
    .getByText("Make it yours")
    .click();
  await expect(page.getByLabel("Song title")).toHaveValue("Pocket Sunrise");
  await expect(page.getByRole("button", { name: "112 BPM" })).toBeVisible();
  await page.getByRole("button", { name: "Notes", exact: true }).click();
  const before = await page.locator(".pattern-tools").textContent();
  await page.getByRole("button", { name: "＋ Note", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Delete note", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".pattern-tools")).toHaveText(before!);
  await page.getByLabel("Song title").fill("Sunrise browser check");
  await expect(page.locator(".save-status")).toContainText(
    "Saved in this browser",
  );
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page.getByRole("button", { name: "Save version", exact: true }).click();
  await expect(page.locator(".version")).toHaveCount(1);
  await page.reload();
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page
    .locator(".library-entry")
    .getByRole("button")
    .filter({ hasText: "Sunrise browser check" })
    .click();
  await expect(page.getByLabel("Song title")).toHaveValue(
    "Sunrise browser check",
  );
  await expect(page.getByRole("button", { name: "112 BPM" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("Arcade keeps editable notes; game catalog loads music and SFX contexts", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "New song / live pad" }).click();
  await page.getByRole("button", { name: "Arcade · lab", exact: true }).click();
  await page
    .getByRole("button", { name: "Start fixed-tempo loop", exact: true })
    .click();
  await page.getByLabel("Phrase intensity").selectOption("1");
  const target = page.getByRole("button", {
    name: "Leap · rising phrase",
    exact: true,
  });
  await target.click();
  await expect(
    page.getByRole("button", { name: "Keep 2 notes", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Keep 2 notes", exact: true }).click();
  await page.getByRole("button", { name: /Add as a new part/ }).click();
  await expect(page.locator(".pattern-tools")).toContainText("2 notes");
  await page.getByRole("button", { name: "Game audio", exact: true }).click();
  await page.getByLabel("Game preview project").selectOption("fixture");
  await expect(
    page.getByLabel("Lantern Courier playable preview"),
  ).toBeVisible();
  await page.getByRole("button", { name: /Lantern step/ }).click();
  await page.getByRole("button", { name: /Moonlit path.*move/ }).click();
  await expect(page.locator(".ga-viewport")).toHaveClass(/ga-explore/);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.getByRole("button", { name: "Walk →", exact: true }).click();
  await page.getByRole("button", { name: "Pause sound", exact: true }).click();
  expect(errors).toEqual([]);
});

test("simultaneous drafts reject a stale write and preserve a recovery copy", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New song / live pad" }).click();
  await page.getByLabel("Song title").fill("Two tabs");
  await expect(page.locator(".save-status")).toContainText(
    "Saved in this browser",
  );
  const other = await context.newPage();
  await other.goto("/");
  await other.getByRole("button", { name: "Library", exact: true }).click();
  await other
    .locator(".library-entry")
    .getByRole("button")
    .filter({ hasText: "Two tabs" })
    .click();
  await page.getByLabel("Song title").fill("First tab saved");
  await expect(page.locator(".save-status")).toContainText(
    "Saved in this browser",
  );
  await other.getByLabel("Song title").fill("Second tab local");
  await expect(other.locator(".save-status")).toContainText("Unsaved");
  await expect(other.getByLabel("Song title")).toHaveValue("Second tab local");
  await other
    .getByRole("button", { name: "Preserve as a copy", exact: true })
    .click();
  await expect(other.locator(".save-status")).toContainText(
    "Saved in this browser",
  );
  await expect(other.getByLabel("Song title")).toHaveValue(
    "Second tab local (recovered copy)",
  );
});

test("phone keeps controls reachable without page-wide horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "New song / live pad" }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Studio", exact: true }).click();
  await page.getByRole("button", { name: "Notes", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test("a game checkpoint stays visible while editing; assignments update only explicitly", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator(".starter")
    .filter({ hasText: "Moss Lantern" })
    .getByText("Make it yours")
    .click();
  await page
    .getByRole("button", { name: "Preview game beside editor", exact: true })
    .click();
  await page.getByLabel("Game preview project").selectOption("fixture");
  await page.getByRole("button", { name: "combat", exact: true }).click();
  await page
    .getByRole("button", { name: "Preview current draft", exact: true })
    .click();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.getByLabel("Song title").fill("Moss Lantern revised");
  await expect(page.locator(".ga-viewport")).toHaveClass(/ga-combat/);
  await expect(page.locator(".ga-source")).toContainText(
    "Previewing current working draft",
  );
  await expect(page.locator(".transport button").first()).toBeDisabled();
  await page.getByRole("button", { name: "Game audio", exact: true }).click();
  await expect(page.locator(".ga-viewport")).toHaveClass(/ga-combat/);
  await expect(page.locator(".ga-layout > aside").first()).toContainText(
    "Moss Lantern",
  );
  await expect(page.locator(".ga-layout > aside").first()).not.toContainText(
    "Moss Lantern revised",
  );
  await page
    .getByRole("button", {
      name: "Save snapshot & apply current draft",
      exact: true,
    })
    .click();
  await expect(page.locator(".ga-layout > aside").first()).toContainText(
    "Moss Lantern revised",
  );
  await expect(page.locator(".game-audio [role=status]")).toContainText(
    "Project assignments saved",
  );
  await page.reload();
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page
    .locator(".library-entry")
    .getByRole("button")
    .filter({ hasText: "Moss Lantern revised" })
    .click();
  await page.getByRole("button", { name: "Game audio", exact: true }).click();
  await page.getByLabel("Game preview project").selectOption("fixture");
  await expect(page.locator(".ga-layout > aside").first()).toContainText(
    "Moss Lantern revised",
  );
  await page
    .getByRole("button", { name: "Edit pinned snapshot as draft", exact: true })
    .click();
  await expect(page.getByLabel("Song title")).toHaveValue(
    "Moss Lantern revised",
  );
  await expect(page.locator(".workspace")).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("foreground dialogs trap focus, dismiss with Escape and restore the trigger", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New song / live pad" }).click();
  const trigger = page.getByRole("button", { name: "120 BPM" });
  await trigger.click();
  const modal = page.getByRole("dialog", { name: "Song settings" });
  for (let i = 0; i < 18; i++) await page.keyboard.press("Tab");
  expect(
    await modal.evaluate((el) => el.contains(document.activeElement)),
  ).toBeTruthy();
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("live pad captures an actual pointer gesture and preserves it as a separate part", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New song / live pad" }).click();
  const pad = page.locator(".live-pad"),
    box = await pad.boundingBox();
  if (!box) throw new Error("pad not visible");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.6);
  await page.mouse.down();
  await expect(pad).toHaveClass(/recording/);
  await page.waitForTimeout(150);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.3);
  await page.waitForTimeout(100);
  await page.mouse.up();
  await page
    .getByRole("button", { name: "Keep take → notes", exact: true })
    .click();
  await page.getByRole("button", { name: /Add as a new part/ }).click();
  await expect(page.locator(".part")).toHaveCount(2);
  await expect(page.locator(".pattern-tools")).toContainText("2 notes");
  await expect(page.locator(".save-status")).toContainText(
    "Saved in this browser",
  );
});
