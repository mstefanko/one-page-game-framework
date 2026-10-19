import { chromium, expect, test, type Page } from "@playwright/test";
const devUrl = "http://127.0.0.1:4182";
async function ready(page: Page) {
  await page.goto(devUrl);
  await page.waitForFunction(() => (window as any).__GAME_DEV__?.ready);
}
async function tick(page: Page) {
  return page.evaluate(() => (window as any).__GAME_DEV__.observe().tick);
}

test("denied gamepads pause once and keyboard retry remains playable", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    (window as any).__padCalls = 0;
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () => {
        (window as any).__padCalls++;
        throw new DOMException(
          "Gamepad denied by Permissions Policy",
          "SecurityError",
        );
      },
    });
  });
  await ready(page);
  await expect(page.locator("[data-status]")).toContainText(
    "Player paused (input)",
  );
  expect(
    await page.evaluate(() => (window as any).__GAME_DEV__.counters().raf),
  ).toBe(0);
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => (window as any).__padCalls)).toBe(1);
  await page.locator("[data-pause]").click();
  await page.keyboard.down("ArrowRight");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse((window as any).__GAME_DEV__.checkpoint()).decoder.slots[0]
            .held.right,
      ),
    )
    .toBe(true);
  await page.keyboard.up("ArrowRight");
  expect(errors).toEqual([]);
});

test("invalid RAF time reports a stopped fault and explicit retry starts a fresh clock", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const request = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) =>
      request((time) => {
        if ((window as any).__badClock) {
          callback(NaN);
        } else callback(time);
      });
  });
  await ready(page);
  await page.evaluate(() => ((window as any).__badClock = true));
  await expect(page.locator("[data-status]")).toContainText(
    "Player paused (clock)",
  );
  await page.evaluate(() => ((window as any).__badClock = false));
  const before = await tick(page);
  await page.waitForTimeout(100);
  expect(await tick(page)).toBe(before);
  expect(
    await page.evaluate(() => (window as any).__GAME_DEV__.counters().raf),
  ).toBe(0);
  await page.locator("[data-pause]").click();
  await expect.poll(() => tick(page)).toBeGreaterThan(before);
  expect(errors).toEqual([]);
});

test("render exceptions stop retry loops and recover after explicit retry", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    for (const Context of [
      window.WebGLRenderingContext,
      window.WebGL2RenderingContext,
    ]) {
      for (const method of [
        "drawElements",
        "drawArrays",
        "drawElementsInstanced",
        "drawArraysInstanced",
      ]) {
        const prototype = Context?.prototype as any;
        const original = prototype?.[method];
        if (!original) continue;
        prototype[method] = function (...args: any[]) {
          if ((window as any).__failDraw) {
            (window as any).__failDraw = false;
            throw new Error("Injected GPU submission fault");
          }
          return original.apply(this, args);
        };
      }
    }
  });
  await ready(page);
  await page.evaluate(() => ((window as any).__failDraw = true));
  await expect(page.locator("[data-status]")).toContainText(
    "Player paused (render)",
  );
  expect(
    await page.evaluate(() => (window as any).__GAME_DEV__.counters().raf),
  ).toBe(0);
  await page.locator("[data-pause]").click();
  await expect.poll(() => tick(page)).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("step faults require restart and cannot export uncertain state", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  await page.evaluate(() =>
    (window as any).__GAME_DEV__.step({ slots: [{ slot: 0 }] }),
  );
  await expect(page.locator("[data-status]")).toContainText(
    "Player paused (simulation)",
  );
  expect(
    await page.evaluate(() => (window as any).__GAME_DEV__.counters().raf),
  ).toBe(0);
  expect(
    await page.evaluate(() => {
      try {
        (window as any).__GAME_DEV__.checkpoint();
        return false;
      } catch {
        return true;
      }
    }),
  ).toBe(true);
  await page.evaluate(() => (window as any).__GAME_DEV__.resume());
  await expect(page.locator("[data-status]")).toContainText(
    "Restart or restore",
  );
  await page.locator("[data-restart]").click();
  await expect.poll(() => tick(page)).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("persisted page transitions preserve checkpoint and pause; final pagehide disposes", async ({
  page,
}) => {
  await ready(page);
  await page.locator("[data-pause]").click();
  await expect.poll(() => tick(page)).toBeGreaterThan(0);
  await page.evaluate(() =>
    window.dispatchEvent(
      new PageTransitionEvent("pagehide", { persisted: true }),
    ),
  );
  const saved = await page.evaluate(() =>
    (window as any).__GAME_DEV__.checkpoint(),
  );
  expect(
    await page.evaluate(() => (window as any).__GAME_DEV__.counters().raf),
  ).toBe(0);
  expect(await page.locator(".stage canvas").count()).toBe(1);
  await page.evaluate(() =>
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true }),
    ),
  );
  expect(
    await page.evaluate(() => (window as any).__GAME_DEV__.checkpoint()),
  ).toBe(saved);
  await expect(page.locator("[data-status]")).toContainText("Returned");
  await page.locator("[data-pause]").click();
  await expect.poll(() => tick(page)).toBeGreaterThan(JSON.parse(saved).tick);
  await page.evaluate(() =>
    window.dispatchEvent(
      new PageTransitionEvent("pagehide", { persisted: false }),
    ),
  );
  expect(await page.locator(".stage canvas").count()).toBe(0);
  expect(
    await page.evaluate(() => (window as any).__GAME_DEV__.counters().raf),
  ).toBe(0);
});

test("Command shortcuts preserve native handling and cannot retain missing-keyup actions", async ({
  page,
}) => {
  await ready(page);
  await page.locator("[data-pause]").click();
  await page.keyboard.down("KeyX");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse((window as any).__GAME_DEV__.checkpoint()).decoder.slots[0]
            .held.attack,
      ),
    )
    .toBe(true);
  await page.evaluate(() => {
    (window as any).__shortcutPrevented = [];
    window.addEventListener("keydown", (event) => {
      if (event.metaKey)
        (window as any).__shortcutPrevented.push(event.defaultPrevented);
    });
  });
  await page.keyboard.down("Meta");
  await page.keyboard.press("KeyC");
  await page.keyboard.up("Meta");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse((window as any).__GAME_DEV__.checkpoint()).decoder.slots[0]
            .held.attack,
      ),
    )
    .toBe(false);
  expect(
    await page.evaluate(() =>
      (window as any).__shortcutPrevented.every(
        (value: boolean) => value === false,
      ),
    ),
  ).toBe(true);
  expect(
    await page.evaluate(
      () =>
        JSON.parse((window as any).__GAME_DEV__.checkpoint()).decoder.slots[0]
          .held.heavy,
    ),
  ).toBe(false);
  await page.keyboard.up("KeyX");
});

test("newest in-memory checkpoint wins when persistent storage quota fails", async ({
  page,
}) => {
  await ready(page);
  await page.locator("[data-save]").click();
  await page.evaluate(() => {
    for (let i = 0; i < 5; i++) (window as any).__GAME_DEV__.step();
    Storage.prototype.setItem = function () {
      throw new DOMException("Quota full", "QuotaExceededError");
    };
  });
  await page.locator("[data-save]").click();
  await expect(page.locator("[data-status]")).toContainText("kept in memory");
  const newest = await page.evaluate(() =>
    (window as any).__GAME_DEV__.checkpoint(),
  );
  await page.evaluate(() => {
    for (let i = 0; i < 3; i++) (window as any).__GAME_DEV__.step();
  });
  await page.locator("[data-restore]").click();
  expect(
    await page.evaluate(() => (window as any).__GAME_DEV__.checkpoint()),
  ).toBe(newest);
});

test("restore synchronizes scenario restart identity and early controls remain disabled", async ({
  page,
}) => {
  await ready(page);
  const disabled = await page.evaluate(() => {
    (window as any).__mount = (window as any).__GAME_DEV__.remount();
    return [...document.querySelectorAll<HTMLButtonElement>("button")].every(
      (button) => button.disabled,
    );
  });
  expect(disabled).toBe(true);
  await page.evaluate(() => (window as any).__mount);
  await page.waitForFunction(() => (window as any).__GAME_DEV__.ready);
  await page.evaluate(async () => {
    await (window as any).__GAME_DEV__.restart("second-room");
    (window as any).__GAME_DEV__.pause();
  });
  const saved = await page.evaluate(() =>
    (window as any).__GAME_DEV__.checkpoint(),
  );
  await page.evaluate(async () => {
    await (window as any).__GAME_DEV__.restart("start");
    (window as any).__GAME_DEV__.pause();
  });
  await page.evaluate(
    (bytes) => (window as any).__GAME_DEV__.restore(bytes),
    saved,
  );
  await expect(page.locator("[data-scenario]")).toHaveValue("second-room");
  await page.locator("[data-restart]").click();
  expect(
    await page.evaluate(() => (window as any).__GAME_DEV__.observe().levelId),
  ).toBe("room-2");
});

test("real Chromium back navigation restores the cached player operably", async ({
  browserName,
}, testInfo) => {
  test.skip(
    browserName !== "chromium",
    "Explicit Chromium launch enables BFCache instead of Playwright's default disabling flag.",
  );
  const browser = await chromium.launch({
    channel: "chromium",
    headless: Boolean(process.env.CI) || process.platform !== "darwin",
    ignoreDefaultArgs: ["--disable-back-forward-cache"],
  });
  try {
    const page = await browser.newPage();
    const cdp = await page.context().newCDPSession(page);
    const notRestored: unknown[] = [];
    await cdp.send("Page.enable");
    cdp.on("Page.backForwardCacheNotUsed", (event) => notRestored.push(event));
    await page.addInitScript(() => {
      window.addEventListener(
        "pageshow",
        (event) => ((window as any).__restoredFromCache = event.persisted),
      );
    });
    await page.goto("http://127.0.0.1:4181/");
    await page.locator(".stage canvas").waitFor();
    await page.locator("[data-pause]").click();
    await page.waitForTimeout(100);
    await page.goto("http://127.0.0.1:4181/fixture/");
    const history = await cdp.send("Page.getNavigationHistory");
    await cdp.send("Page.navigateToHistoryEntry", {
      entryId: history.entries[history.currentIndex - 1].id,
    });
    await expect(page).toHaveURL("http://127.0.0.1:4181/");
    await page.locator(".stage canvas").waitFor();
    const persisted = await page.evaluate(
      () => (window as any).__restoredFromCache,
    );
    await testInfo.attach("bfcache-navigation.json", {
      body: JSON.stringify({ persisted, notRestored }),
      contentType: "application/json",
    });
    expect(persisted, "The navigation must actually exercise BFCache").toBe(
      true,
    );
    await expect(page.locator("[data-status]")).toContainText("Returned");
    await page.locator("[data-pause]").click();
    await expect(page.locator("[data-pause]")).toHaveText("Pause");
  } finally {
    await browser.close();
  }
});

test("denied storage reads remain visible and do not crash the player", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await ready(page);
  await page.evaluate(() => {
    Storage.prototype.getItem = function () {
      throw new DOMException("Storage denied", "SecurityError");
    };
  });
  await page.locator("[data-restore]").click();
  await expect(page.locator("[data-status]")).toContainText(
    "Storage unavailable",
  );
  await page.locator("[data-pause]").click();
  await expect.poll(() => tick(page)).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("Escape cannot resume an ended run or advance it by an extra tick", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(() => {
    const game = (window as any).__GAME_DEV__;
    for (let i = 0; i < 1000 && game.observe().status === "playing"; i++)
      game.step();
  });
  expect(
    await page.evaluate(() => (window as any).__GAME_DEV__.observe().status),
  ).toBe("lost");
  const endedAt = await tick(page);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(80);
  expect(await tick(page)).toBe(endedAt);
  await expect(page.locator("[data-status]")).toContainText("run has ended");
});
