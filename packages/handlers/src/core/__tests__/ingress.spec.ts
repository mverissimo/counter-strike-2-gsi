import { createServer } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { GSI, GSIPayloadError, silentLogger } from "@counter-strike-2-gsi/server";

import { createBunHandler } from "../../bun/http";
import { createHonoHandler } from "../../hono/http";
import { createNodeHandler } from "../../node/http";
import { createIngress, readRequestBody } from "../http";
import type { GSIHandlerOptions } from "../types";

type Options = Pick<GSIHandlerOptions, "manager" | "token" | "maxBodyBytes"> & {
  onError?: (error: Error) => void;
};
type Send = (body: string, method?: string) => Promise<Response>;

const cleanup: Array<() => Promise<void>> = [];

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(async () => {
  for (const close of cleanup.splice(0)) await close();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

const adapters: Array<{ name: string; start: (options: Options) => Send | Promise<Send> }> = [
  {
    name: "Bun fetch",
    start(options) {
      const handler = createBunHandler(options);
      return (body, method = "POST") =>
        handler(
          new Request("http://gsi.test/gsi", {
            method,
            ...(method === "GET" ? {} : { body }),
          }),
        );
    },
  },
  {
    name: "Hono",
    start(options) {
      const app = new Hono();
      app.all("/gsi", createHonoHandler(options));
      return async (body, method = "POST") =>
        app.request("http://gsi.test/gsi", {
          method,
          ...(method === "GET" ? {} : { body }),
        });
    },
  },
  {
    name: "Node HTTP",
    async start(options) {
      const handler = createNodeHandler(options);
      const server = createServer((req, res) => {
        void handler(req, res);
      });
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      cleanup.push(
        () =>
          new Promise<void>((resolve, reject) => {
            server.closeAllConnections();
            server.close((error) => (error ? reject(error) : resolve()));
          }),
      );
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Missing server address");
      return (body, method = "POST") =>
        fetch(`http://127.0.0.1:${address.port}/gsi`, {
          method,
          ...(method === "GET" ? {} : { body }),
        });
    },
  },
];

describe.each(adapters)("ingress policy: $name", ({ start }) => {
  it("accepts authenticated payloads and only requires an update capability", async () => {
    const manager = { update: vi.fn() };
    const send = await start({ manager, token: "secret" });
    const payload = { auth: { token: "secret" }, round: { phase: "live" } };
    const response = await send(JSON.stringify(payload));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ message: "OK" });
    expect(manager.update).toHaveBeenCalledExactlyOnceWith(payload);
  });

  it.each(["", "{", "null", "[]", '"text"', "42"])("rejects invalid input %j", async (body) => {
    const manager = { update: vi.fn() };
    const onError = vi.fn();
    const send = await start({ manager, onError });
    const response = await send(body);

    expect(response.status).toBe(400);
    expect(manager.update).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledOnce();
  });

  it.each([{}, { auth: null }, { auth: { token: "wrong" } }, { auth: { token: 123 } }])(
    "rejects invalid authentication %j",
    async (payload) => {
      const manager = { update: vi.fn() };
      const send = await start({ manager, token: "secret" });
      const response = await send(JSON.stringify(payload));

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "Invalid auth token" });
      expect(manager.update).not.toHaveBeenCalled();
    },
  );

  it("returns the same method rejection", async () => {
    const manager = { update: vi.fn() };
    const send = await start({ manager });
    const response = await send("", "GET");

    expect(response.status).toBe(405);
    expect(await response.json()).toEqual({ error: "Method Not Allowed" });
    expect(manager.update).not.toHaveBeenCalled();
  });

  it("enforces the default 1 MiB body limit", async () => {
    const manager = { update: vi.fn() };
    const send = await start({ manager });
    const response = await send(" ".repeat(1024 * 1024 + 1));

    expect(response.status).toBe(413);
    expect(manager.update).not.toHaveBeenCalled();
  });

  it("measures custom limits in UTF-8 bytes and accepts the exact limit", async () => {
    const body = JSON.stringify({ name: "🎯" });
    const manager = { update: vi.fn() };
    const send = await start({ manager, maxBodyBytes: new TextEncoder().encode(body).byteLength });

    expect((await send(body)).status).toBe(200);
    expect((await send(`${body} `)).status).toBe(413);
    expect(manager.update).toHaveBeenCalledOnce();
  });

  it("classifies real strict validation failures as client errors", async () => {
    const manager = new GSI({ strictValidation: true, logger: silentLogger });
    const onError = vi.fn();
    const send = await start({ manager, onError });
    const response = await send(JSON.stringify({ round: { phase: "invalid" } }));

    expect(response.status).toBe(400);
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(GSIPayloadError);
    expect(manager.state).toEqual({});
  });

  it("does not infer client errors from internal error messages", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const manager = {
      update: () => {
        throw new Error("Internal validation cache is too large");
      },
    };
    const send = await start({ manager });
    const response = await send("{}");

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Internal server error" });
  });
});

describe("streaming admission", () => {
  it("stops reading and closes the iterator as soon as the byte limit is exceeded", async () => {
    const closed = vi.fn();
    const readMore = vi.fn();
    async function* chunks() {
      try {
        yield new Uint8Array(9);
        readMore();
        yield new Uint8Array(9);
      } finally {
        closed();
      }
    }
    const manager = { update: vi.fn() };

    await expect(createIngress({ manager, maxBodyBytes: 8 })("POST", chunks())).rejects.toThrow(
      "Payload too large",
    );
    expect(readMore).not.toHaveBeenCalled();
    expect(closed).toHaveBeenCalledOnce();
    expect(manager.update).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "cancels a fetch reader without masking admission errors (cancel rejects: %s)",
    async (rejectCancel) => {
      const cancel = vi.fn(() =>
        rejectCancel ? Promise.reject(new Error("Cancellation failed")) : undefined,
      );
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(9));
        },
        cancel,
      });
      const init = {
        method: "POST",
        body: stream,
        duplex: "half",
      } satisfies RequestInit & { duplex: "half" };
      const request = new Request("http://gsi.test/gsi", init);

      await expect(
        createIngress({ manager: { update() {} }, maxBodyBytes: 8 })(
          "POST",
          readRequestBody(request),
        ),
      ).rejects.toThrow("Payload too large");
      expect(cancel).toHaveBeenCalledOnce();
      expect(stream.locked).toBe(false);
    },
  );

  it.each([0, -1, 1.5, NaN, Infinity])("rejects invalid byte limit %s", (maxBodyBytes) => {
    expect(() => createIngress({ manager: { update() {} }, maxBodyBytes })).toThrow(RangeError);
  });
});
