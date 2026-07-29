import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createWSClient } from "../clients/ws";
import { MockWebSocket } from "./helpers/mock-web-socket";

beforeEach(() => {
  MockWebSocket.reset();

  vi.stubGlobal("WebSocket", MockWebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("@client: createWSClient", () => {
  describe("connect / disconnect", () => {
    it("emits 'connecting' then 'connected' on successful open", () => {
      const onStatusChange = vi.fn();
      const client = createWSClient({
        url: "ws://x",
        onStatusChange,
      });

      client.connect();

      expect(onStatusChange).toHaveBeenNthCalledWith(1, "connecting");

      MockWebSocket.latest().open();

      expect(onStatusChange).toHaveBeenNthCalledWith(2, "connected");
    });

    it("is idempotent — repeat connect() does not create a second WebSocket", () => {
      const client = createWSClient({
        url: "ws://x",
      });

      client.connect();
      client.connect();
      client.connect();

      expect(MockWebSocket.instances).toHaveLength(1);
    });

    it("disconnect() closes the socket and emits 'disconnected'", () => {
      const onStatusChange = vi.fn();
      const client = createWSClient({
        url: "ws://x",
        onStatusChange,
      });

      client.connect();

      MockWebSocket.latest().open();

      client.disconnect();

      expect(MockWebSocket.latest().readyState).toBe(MockWebSocket.CLOSED);
      expect(onStatusChange).toHaveBeenLastCalledWith("disconnected");
    });

    it("disconnect() is a no-op when not connected", () => {
      const onStatusChange = vi.fn();
      const client = createWSClient({
        url: "ws://x",
        onStatusChange,
      });

      client.disconnect();

      expect(MockWebSocket.instances).toHaveLength(0);
      expect(onStatusChange).not.toHaveBeenCalled();
    });

    it("can reconnect after a disconnect", () => {
      const client = createWSClient({
        url: "ws://x",
      });

      client.connect();
      client.disconnect();
      client.connect();

      expect(MockWebSocket.instances).toHaveLength(2);
    });

    it("emits 'disconnected' when the socket closes server-side", () => {
      const onStatusChange = vi.fn();
      const client = createWSClient({
        url: "ws://x",
        onStatusChange,
      });

      client.connect();

      MockWebSocket.latest().open();
      onStatusChange.mockClear();

      MockWebSocket.latest().serverClose();

      expect(onStatusChange).toHaveBeenCalledWith("disconnected");
    });

    it("disconnect() does not double-fire 'disconnected' via onclose", () => {
      const onStatusChange = vi.fn();
      const client = createWSClient({
        url: "ws://x",
        onStatusChange,
      });

      client.connect();

      MockWebSocket.latest().open();
      onStatusChange.mockClear();

      const socket = MockWebSocket.latest();
      client.disconnect();
      socket.onclose?.(new Event("close"));

      expect(onStatusChange).toHaveBeenCalledTimes(1);
      expect(onStatusChange).toHaveBeenCalledWith("disconnected");
    });
  });

  describe("reconnect on close", () => {
    const connectAndClose = (code: number, options: Record<string, unknown> = {}) => {
      const client = createWSClient({
        url: "ws://x",
        reconnectMinDelayMs: 10,
        reconnectMaxDelayMs: 10,
        ...options,
      });

      client.connect();
      MockWebSocket.latest().open();
      MockWebSocket.latest().serverClose(code);

      return client;
    };

    it("reconnects after an abnormal close (1006)", async () => {
      vi.useFakeTimers();

      connectAndClose(1006);

      await vi.advanceTimersByTimeAsync(50);

      expect(MockWebSocket.instances).toHaveLength(2);

      vi.useRealTimers();
    });

    it.each([1000, 1001])("does not reconnect after a clean close (%i)", async (code) => {
      vi.useFakeTimers();

      connectAndClose(code);

      await vi.advanceTimersByTimeAsync(1000);

      expect(MockWebSocket.instances).toHaveLength(1);

      vi.useRealTimers();
    });

    it.each([1000, 1001])(
      "reconnects after a clean close (%i) when reconnectOnCleanClose is set",
      async (code) => {
        vi.useFakeTimers();

        connectAndClose(code, { reconnectOnCleanClose: true });

        await vi.advanceTimersByTimeAsync(50);

        expect(MockWebSocket.instances).toHaveLength(2);

        vi.useRealTimers();
      },
    );

    it("still reports 'disconnected' on a clean close even though it stays down", () => {
      const onStatusChange = vi.fn();
      const client = createWSClient({
        url: "ws://x",
        onStatusChange,
      });

      client.connect();
      MockWebSocket.latest().open();
      onStatusChange.mockClear();

      MockWebSocket.latest().serverClose(1000);

      expect(onStatusChange).toHaveBeenCalledWith("disconnected");
    });

    it("does not reconnect at all when reconnect is disabled", async () => {
      vi.useFakeTimers();

      connectAndClose(1006, { reconnect: false });

      await vi.advanceTimersByTimeAsync(1000);

      expect(MockWebSocket.instances).toHaveLength(1);

      vi.useRealTimers();
    });
  });

  describe("errors", () => {
    it("forwards transport errors to onError", () => {
      const onError = vi.fn();
      const client = createWSClient({
        url: "ws://x",
        onError,
      });

      client.connect();

      MockWebSocket.latest().error();

      expect(onError).toHaveBeenCalledWith({
        type: "transport",
        cause: expect.any(Event),
      });
    });
  });

  describe("subscribe", () => {
    it("fires the handler with parsed JSON payloads", () => {
      const client = createWSClient({
        url: "ws://x",
      });
      const handler = vi.fn();

      client.connect();
      client.subscribe("player:state:health", handler);

      MockWebSocket.latest().emit("player:state:health", {
        previous: 100,
        current: 80,
      });

      expect(handler).toHaveBeenCalledWith({
        previous: 100,
        current: 80,
      });
    });

    it("subscribing before connect still delivers events after connect", () => {
      const client = createWSClient({
        url: "ws://x",
      });
      const handler = vi.fn();

      client.subscribe("player:state:health", handler);
      client.connect();

      MockWebSocket.latest().emit("player:state:health", {
        previous: 100,
        current: 80,
      });

      expect(handler).toHaveBeenCalledWith({
        previous: 100,
        current: 80,
      });
    });

    it("fans a single frame out to every handler", () => {
      const client = createWSClient({
        url: "ws://x",
      });
      const h1 = vi.fn();
      const h2 = vi.fn();

      client.connect();
      client.subscribe("player:state:health", h1);
      client.subscribe("player:state:health", h2);

      MockWebSocket.latest().emit("player:state:health", { current: 50 });

      expect(h1).toHaveBeenCalledOnce();
      expect(h2).toHaveBeenCalledOnce();
    });

    it("frames for other events do not wake handlers for this event", () => {
      const client = createWSClient({
        url: "ws://x",
      });
      const handler = vi.fn();

      client.connect();
      client.subscribe("player:state:health", handler);

      MockWebSocket.latest().emit("round:phase", { current: "live" });

      expect(handler).not.toHaveBeenCalled();
    });

    it("unsubscribe removes only that handler", () => {
      const client = createWSClient({
        url: "ws://x",
      });
      const h1 = vi.fn();
      const h2 = vi.fn();

      client.connect();
      const unsub = client.subscribe("player:state:health", h1);
      client.subscribe("player:state:health", h2);

      unsub();

      MockWebSocket.latest().emit("player:state:health", { current: 50 });

      expect(h1).not.toHaveBeenCalled();
      expect(h2).toHaveBeenCalledOnce();
    });

    it("does not deliver events after the handler unsubscribes", () => {
      const client = createWSClient({
        url: "ws://x",
      });
      const handler = vi.fn();

      client.connect();
      const unsub = client.subscribe("player:state:health", handler);

      unsub();

      MockWebSocket.latest().emit("player:state:health", { current: 50 });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("parse errors", () => {
    it("reports malformed JSON via onError and skips the handler", () => {
      const onError = vi.fn();
      const handler = vi.fn();
      const client = createWSClient({
        url: "ws://x",
        onError,
      });

      client.connect();
      client.subscribe("player:state:health", handler);

      MockWebSocket.latest().emitRaw("not-json");

      expect(handler).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith({
        type: "parse",
        cause: expect.any(SyntaxError),
        raw: "not-json",
      });
    });

    it("a parse error for one frame does not break subsequent valid frames", () => {
      const client = createWSClient({
        url: "ws://x",
        onError: vi.fn(),
      });
      const handler = vi.fn();

      client.connect();
      client.subscribe("player:state:health", handler);

      MockWebSocket.latest().emitRaw("broken");
      MockWebSocket.latest().emit("player:state:health", {
        current: 42,
      });

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith({
        current: 42,
      });
    });
  });

  describe("reconnect preserves subscriptions", () => {
    it("delivers events to existing handlers after reconnect", () => {
      const client = createWSClient({
        url: "ws://x",
      });
      const handler = vi.fn();

      client.connect();
      client.subscribe("player:state:health", handler);
      client.disconnect();
      client.connect();

      MockWebSocket.latest().emit("player:state:health", {
        current: 1,
      });

      expect(handler).toHaveBeenCalledWith({
        current: 1,
      });
    });
  });
});
