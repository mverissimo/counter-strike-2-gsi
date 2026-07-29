import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it, vi } from "vitest";

import { createNodeHandler } from "../http";
import { createFakeManager } from "../../core/__tests__/helpers/fake-manager";

/**
 * Minimal `IncomingMessage` stand-in: an async-iterable stream of Buffers,
 * which is exactly the surface the handler consumes.
 */
function createRequest(chunks: Buffer[], method = "POST") {
  return {
    method,
    socket: {
      remoteAddress: "127.0.0.1",
    },
    destroy: vi.fn(),
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield chunk;
      }
    },
  } as unknown as IncomingMessage;
}

function createResponse() {
  const recorded = {
    status: 0,
    body: "",
  };

  const res = {
    writeHead(status: number) {
      recorded.status = status;
    },
    end(body?: string) {
      recorded.body = body ?? "";
    },
  } as unknown as ServerResponse;

  return {
    res,
    recorded,
  };
}

describe("createNodeHandler: body accumulation", () => {
  it("reassembles a body split across chunks", async () => {
    const { fake, manager } = createFakeManager();
    const updates: unknown[] = [];

    fake.state = {};
    (manager as unknown as { update: (p: unknown) => void }).update = (p) => updates.push(p);

    const json = JSON.stringify({ round: { phase: "live" } });
    const request = createRequest([
      Buffer.from(json.slice(0, 10), "utf8"),
      Buffer.from(json.slice(10), "utf8"),
    ]);
    const { res, recorded } = createResponse();

    await createNodeHandler({ manager })(request, res);

    expect(recorded.status).toBe(200);
    expect(updates).toEqual([{ round: { phase: "live" } }]);
  });

  // Decoding per chunk (`body += chunk`) splits multi-byte UTF-8 sequences on
  // the boundary and substitutes replacement characters, which then either
  // corrupts a map/player name or breaks JSON.parse outright.
  it("keeps multi-byte characters intact when a chunk boundary splits them", async () => {
    const { manager } = createFakeManager();
    const updates: Array<{ map?: { name?: string } }> = [];

    (manager as unknown as { update: (p: unknown) => void }).update = (p) =>
      updates.push(p as { map?: { name?: string } });

    const name = "de_вертиго🎯";
    const buffer = Buffer.from(JSON.stringify({ map: { name } }), "utf8");

    // Cut inside the multi-byte run rather than between characters.
    const split = buffer.indexOf(Buffer.from("вертиго", "utf8")) + 3;
    const request = createRequest([buffer.subarray(0, split), buffer.subarray(split)]);
    const { res, recorded } = createResponse();

    await createNodeHandler({ manager })(request, res);

    expect(recorded.status).toBe(200);
    expect(updates[0]?.map?.name).toBe(name);
  });

  it("rejects an empty body with a 400", async () => {
    const { manager } = createFakeManager();
    const request = createRequest([]);
    const { res, recorded } = createResponse();

    vi.spyOn(console, "error").mockImplementation(() => {});

    await createNodeHandler({ manager })(request, res);

    expect(recorded.status).toBe(400);
    expect(JSON.parse(recorded.body).error).toContain("Empty payload");

    vi.restoreAllMocks();
  });

  it("rejects a request whose token does not match", async () => {
    const { manager } = createFakeManager();
    const update = vi.fn();

    (manager as unknown as { update: unknown }).update = update;

    const request = createRequest([
      Buffer.from(JSON.stringify({ auth: { token: "wrong" }, round: { phase: "live" } }), "utf8"),
    ]);
    const { res, recorded } = createResponse();

    vi.spyOn(console, "warn").mockImplementation(() => {});

    await createNodeHandler({ manager, token: "right" })(request, res);

    expect(recorded.status).toBe(401);
    expect(update).not.toHaveBeenCalled();

    vi.restoreAllMocks();
  });
});
