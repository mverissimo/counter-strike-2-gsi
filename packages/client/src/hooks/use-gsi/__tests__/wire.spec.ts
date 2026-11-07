import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSSEClient } from "../clients/sse";
import { createWSClient } from "../clients/ws";
import { MockEventSource } from "./helpers/mock-event-source";
import { MockWebSocket } from "./helpers/mock-web-socket";

beforeEach(() => {
  MockEventSource.reset();
  MockWebSocket.reset();
  vi.stubGlobal("EventSource", MockEventSource);
  vi.stubGlobal("WebSocket", MockWebSocket);
});

afterEach(() => vi.unstubAllGlobals());

describe("@client: wire decoding", () => {
  it.each([
    "not json",
    "null",
    "[]",
    "1",
    '"frame"',
    "{}",
    '{"event":1,"data":{}}',
    '{"event":"update"}',
  ])("reports malformed WS envelopes without throwing: %s", (raw) => {
    const onError = vi.fn();
    const client = createWSClient({ url: "ws://gsi.test", onError });

    client.connect();
    expect(() => MockWebSocket.latest().emitRaw(raw)).not.toThrow();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ type: "parse", raw }));
    client.disconnect();
  });

  for (const transport of ["ws", "sse"] as const) {
    it(`${transport} rejects non-object payloads and continues dispatching`, () => {
      const onError = vi.fn();
      const client =
        transport === "ws"
          ? createWSClient({ url: "ws://gsi.test", onError })
          : createSSEClient({ url: "http://gsi.test", onError });
      const update = vi.fn();
      const emit = (event: string, data: unknown) =>
        transport === "ws"
          ? MockWebSocket.latest().emit(event, data)
          : MockEventSource.latest().emit(event, data);

      client.subscribe("update", update);
      client.connect();

      for (const value of [null, [], 1, "payload"]) {
        emit("update", value);
      }

      expect(onError).toHaveBeenCalledTimes(4);
      expect(update).not.toHaveBeenCalled();

      emit("update", {});

      expect(update).toHaveBeenCalledWith({});
      expect(update).toHaveBeenCalledOnce();
      client.disconnect();
    });

    it(`${transport} leaves event-specific fields to the server contract`, () => {
      const onError = vi.fn();
      const client =
        transport === "ws"
          ? createWSClient({ url: "ws://gsi.test", onError })
          : createSSEClient({ url: "http://gsi.test", onError });
      const handler = vi.fn();
      const payload = { player: { state: { health: 80 } } };

      client.subscribe("update", handler);
      client.connect();

      if (transport === "ws") MockWebSocket.latest().emit("update", payload);
      else MockEventSource.latest().emit("update", payload);

      expect(handler).toHaveBeenCalledWith(payload);
      expect(onError).not.toHaveBeenCalled();
      client.disconnect();
    });

    it(`${transport} does not report subscriber exceptions as parse errors`, () => {
      const onError = vi.fn();
      const client =
        transport === "ws"
          ? createWSClient({ url: "ws://gsi.test", onError })
          : createSSEClient({ url: "http://gsi.test", onError });
      const failure = new Error("Subscriber failed");

      client.subscribe("update", () => {
        throw failure;
      });
      client.connect();

      expect(() => {
        if (transport === "ws") MockWebSocket.latest().emit("update", {});
        else MockEventSource.latest().emit("update", {});
      }).toThrow(failure);
      expect(onError).not.toHaveBeenCalled();
      client.disconnect();
    });

    it(`${transport} decodes remote errors into real Error instances`, () => {
      const client =
        transport === "ws"
          ? createWSClient({ url: "ws://gsi.test" })
          : createSSEClient({ url: "http://gsi.test" });
      const handler = vi.fn();

      client.subscribe("error", handler);
      client.connect();
      const value = { context: "update", error: { message: "failed", name: "TypeError" } };

      if (transport === "ws") MockWebSocket.latest().emit("error", value);
      else MockEventSource.latest().emit("error", value);

      expect(handler).toHaveBeenCalledWith({ context: "update", error: expect.any(Error) });
      expect(handler.mock.calls[0]?.[0].error.message).toBe("failed");
      client.disconnect();
    });
  }
});
