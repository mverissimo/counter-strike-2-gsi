import { createServer } from "node:http";
import { beforeEach, describe, expect, it } from "vitest";
import type { Configuration } from "../config";
import { verifyConnection } from "../verify";

let config: Configuration;

beforeEach(async () => {
  // Select an available destination port without allowing ephemeral ports in real CFGs.
  const server = createServer();

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  try {
    const address = server.address();

    if (!address || typeof address === "string") {
      throw new Error("Missing address");
    }

    config = {
      uri: `http://127.0.0.1:${address.port}/gsi`,
      token: "test-secret",
      data: ["provider"],
    } satisfies Configuration;
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

describe("connection verification", () => {
  it("ignores invalid requests and completes on an authenticated CS2 payload", async () => {
    let listening!: (port: number) => void;

    const ready = new Promise<number>((resolve) => {
      listening = resolve;
    });
    const verification = verifyConnection(config, 5000, listening);
    const port = await ready;
    const url = `http://127.0.0.1:${port}/gsi`;

    try {
      expect((await fetch(url)).status).toBe(404);
      expect((await fetch(url, { method: "POST", body: "invalid" })).status).toBe(400);
      expect(
        (await fetch(url, { method: "POST", body: JSON.stringify({ auth: { token: "wrong" } }) }))
          .status,
      ).toBe(403);
      expect(
        (
          await fetch(url, {
            method: "POST",
            body: JSON.stringify({ auth: { token: config.token } }),
          })
        ).status,
      ).toBe(400);

      for (const payload of [null, [], 42, { auth: null }, { auth: [] }]) {
        expect((await fetch(url, { method: "POST", body: JSON.stringify(payload) })).status).toBe(
          403,
        );
      }

      for (const provider of [
        null,
        [],
        "invalid",
        { appid: 730, timestamp: "123" },
        { appid: 440, timestamp: 123 },
      ]) {
        expect(
          (
            await fetch(url, {
              method: "POST",
              body: JSON.stringify({ auth: { token: config.token }, provider }),
            })
          ).status,
        ).toBe(400);
      }
      expect(
        (
          await fetch(url, {
            method: "POST",
            body: JSON.stringify({
              auth: { token: config.token },
              provider: { appid: 730, timestamp: 123 },
            }),
          })
        ).status,
      ).toBe(200);
    } finally {
      await verification;
    }
  });

  it("times out and releases the listening port", async () => {
    let port = 0;

    await expect(
      verifyConnection(config, 50, (value) => {
        port = value;
      }),
    ).rejects.toThrow("No authenticated");

    const server = createServer();

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, "127.0.0.1", resolve);
    });
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("explains occupied ports", async () => {
    const server = createServer();

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

    const address = server.address();

    try {
      if (!address || typeof address === "string") {
        throw new Error("Missing address");
      }

      await expect(
        verifyConnection({ ...config, uri: `http://127.0.0.1:${address.port}/gsi` }, 1000),
      ).rejects.toThrow("already in use");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("rejects port zero", async () => {
    await expect(
      verifyConnection({ ...config, uri: "http://127.0.0.1:0/gsi" }, 1000),
    ).rejects.toThrow("port");
  });

  it("rejects remote endpoints, invalid timeouts, and missing provider data", async () => {
    await expect(
      verifyConnection({ ...config, uri: "https://example.com/gsi" }, 1000),
    ).rejects.toThrow("local HTTP");
    await expect(verifyConnection(config, NaN)).rejects.toThrow("timeout");
    await expect(verifyConnection({ ...config, data: ["map"] }, 1000)).rejects.toThrow("provider");
  });
});
