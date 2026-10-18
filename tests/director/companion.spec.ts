import { test, expect } from "@playwright/test";
import { createCompanion } from "../../packages/director-service/src/server";
test("loopback companion requires pairing and rejects untrusted origins and malformed requests", async ({
  request,
}) => {
  const { server } = createCompanion({
    mode: "anthropic-api",
    budget: 1,
    token: "test-pairing-token",
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("No local address");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    expect((await request.get(base + "/status")).status()).toBe(401);
    expect(
      (
        await request.get(base + "/status", {
          headers: {
            Authorization: "Bearer test-pairing-token",
            Origin: "https://untrusted.example",
          },
        })
      ).status(),
    ).toBe(403);
    const status = await request.get(base + "/status", {
      headers: {
        Authorization: "Bearer test-pairing-token",
        Origin: "http://127.0.0.1:4174",
      },
    });
    expect(status.status()).toBe(200);
    expect((await status.json()).available).toBe(false);
    const bad = await request.post(base + "/propose", {
      headers: { Authorization: "Bearer test-pairing-token" },
      data: { prompt: "Change it" },
    });
    expect(bad.status()).toBe(400);
    expect(await bad.text()).toContain("Invalid run request");
    const unsupported = await request.post(base + "/install", {
      headers: { Authorization: "Bearer test-pairing-token" },
      data: {},
    });
    expect(unsupported.status()).toBe(400);
    expect(await unsupported.text()).toContain("No game project");
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
