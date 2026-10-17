import { test, expect } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { readFile, access } from "node:fs/promises";
import { resolve, extname } from "node:path";
let server: Server, origin: string;
test.beforeAll(async () => {
  server = createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url!, "http://localhost").pathname;
      if (!pathname.startsWith("/pocket-score/")) {
        res.writeHead(404).end();
        return;
      }
      const name = pathname.slice("/pocket-score/".length) || "index.html";
      const file = resolve("dist", name);
      if (!file.startsWith(resolve("dist") + "/")) {
        res.writeHead(403).end();
        return;
      }
      res.setHeader(
        "Content-Type",
        (
          {
            ".html": "text/html",
            ".js": "text/javascript",
            ".css": "text/css",
          } as Record<string, string>
        )[extname(file)] ?? "application/octet-stream",
      );
      res.end(await readFile(file));
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
test.afterAll(async () => {
  if (server)
    await new Promise<void>((done, reject) =>
      server.close((e) => (e ? reject(e) : done())),
    );
});
test("production app works under a Pages-style repository path without CDN requests", async ({
  page,
}) => {
  const failures: string[] = [],
    external: string[] = [];
  page.on("pageerror", (e) => failures.push(e.message));
  page.on("request", (r) => {
    if (/^https?:/.test(r.url()) && !r.url().startsWith(origin))
      external.push(r.url());
  });
  await page.goto(`${origin}/pocket-score/`);
  await page.getByRole("button", { name: "New song / live pad" }).click();
  await expect(page.getByLabel("Song title")).toHaveValue("Untitled cue");
  await expect(page.locator(".save-status")).toContainText(
    "Saved in this browser",
  );
  expect(failures).toEqual([]);
  expect(external).toEqual([]);
});

test("release build includes notices and excludes imported personal game files", async () => {
  expect(await readFile("dist/THIRD_PARTY_NOTICES.txt", "utf8")).toContain(
    "MIT",
  );
  await expect(access("dist/local-games")).rejects.toThrow();
});
