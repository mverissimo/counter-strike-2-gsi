import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSSEClient } from "../clients/sse";
import { MockEventSource } from "./helpers/mock-event-source";

beforeEach(() => {
  MockEventSource.reset();
  vi.stubGlobal("EventSource", MockEventSource);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("@client: createSSEClient", () => {
  describe("connect / disconnect", () => {
    it("emits 'connecting' then 'connected' on successful open", () => {
      const onStatusChange = vi.fn();
      const client = createSSEClient({
        url: "http://x",
        onStatusChange,
      });

      client.connect();

      expect(onStatusChange).toHaveBeenNthCalledWith(1, "connecting");

      MockEventSource.latest().open();

      expect(onStatusChange).toHaveBeenNthCalledWith(2, "connected");
    });

    it("is idempotent — repeat connect() does not create a second EventSource", () => {
      const client = createSSEClient({
        url: "http://x",
      });

      client.connect();
      client.connect();
      client.connect();

      expect(MockEventSource.instances).toHaveLength(1);
    });

    it("disconnect() closes the source and emits 'disconnected'", () => {
      const onStatusChange = vi.fn();
      const client = createSSEClient({
        url: "http://x",
        onStatusChange,
      });

      client.connect();

      MockEventSource.latest().open();

      client.disconnect();

      expect(MockEventSource.latest().readyState).toBe(MockEventSource.CLOSED);
      expect(onStatusChange).toHaveBeenLastCalledWith("disconnected");
    });

    it("disconnect() is a no-op when not connected", () => {
      const onStatusChange = vi.fn();
      const client = createSSEClient({
        url: "http://x",
        onStatusChange,
      });

      client.disconnect();

      expect(MockEventSource.instances).toHaveLength(0);
      expect(onStatusChange).not.toHaveBeenCalled();
    });

    it("can reconnect after a disconnect", () => {
      const client = createSSEClient({
        url: "http://x",
      });

      client.connect();
      client.disconnect();
      client.connect();

      expect(MockEventSource.instances).toHaveLength(2);
    });
  });

  describe("status transitions on error", () => {
    it("emits 'connecting' when EventSource is retrying (readyState=0)", () => {
      const onStatusChange = vi.fn();
      const client = createSSEClient({
        url: "http://x",
        onStatusChange,
      });

      client.connect();

      MockEventSource.latest().open();
      onStatusChange.mockClear();

      MockEventSource.latest().error(MockEventSource.CONNECTING);

      expect(onStatusChange).toHaveBeenCalledWith("connecting");
    });

    it("emits 'disconnected' when EventSource is terminally closed (readyState=2)", () => {
      const onStatusChange = vi.fn();
      const client = createSSEClient({
        url: "http://x",
        onStatusChange,
      });

      client.connect();

      MockEventSource.latest().open();
      onStatusChange.mockClear();

      MockEventSource.latest().error(MockEventSource.CLOSED);

      expect(onStatusChange).toHaveBeenCalledWith("disconnected");
    });

    it("forwards the raw Event to onError", () => {
      const onError = vi.fn();
      const client = createSSEClient({
        url: "http://x",
        onError,
      });

      client.connect();

      MockEventSource.latest().error();

      expect(onError).toHaveBeenCalledWith({
        type: "transport",
        cause: expect.any(Event),
      });
    });
  });

  describe("subscribe", () => {
    it("fires the handler with parsed JSON payloads", () => {
      const client = createSSEClient({
        url: "http://x",
      });
      const handler = vi.fn();

      client.connect();
      client.subscribe("player:state:health", handler);

      MockEventSource.latest().emit("player:state:health", {
        previous: 100,
        current: 80,
      });

      expect(handler).toHaveBeenCalledWith({ previous: 100, current: 80 });
    });

    it("subscribing before connect still delivers events after connect", () => {
      const client = createSSEClient({
        url: "http://x",
      });
      const handler = vi.fn();

      client.subscribe("player:state:health", handler);
      client.connect();

      MockEventSource.latest().emit("player:state:health", {
        previous: 100,
        current: 80,
      });

      expect(handler).toHaveBeenCalledWith({ previous: 100, current: 80 });
    });

    it("attaches one native listener per event name, regardless of handler count", () => {
      const client = createSSEClient({
        url: "http://x",
      });

      client.connect();
      client.subscribe("player:state:health", vi.fn());
      client.subscribe("player:state:health", vi.fn());
      client.subscribe("player:state:health", vi.fn());

      expect(MockEventSource.latest().listenerCount("player:state:health")).toBe(1);
    });

    it("fans a single native event out to every handler", () => {
      const client = createSSEClient({
        url: "http://x",
      });
      const h1 = vi.fn();
      const h2 = vi.fn();

      client.connect();
      client.subscribe("player:state:health", h1);
      client.subscribe("player:state:health", h2);

      MockEventSource.latest().emit("player:state:health", { current: 50 });

      expect(h1).toHaveBeenCalledOnce();
      expect(h2).toHaveBeenCalledOnce();
    });

    it("events on other names do not wake handlers for this event", () => {
      const client = createSSEClient({
        url: "http://x",
      });
      const handler = vi.fn();

      client.connect();
      client.subscribe("player:state:health", handler);

      MockEventSource.latest().emit("round:phase", { current: "live" });

      expect(handler).not.toHaveBeenCalled();
    });

    it("unsubscribe removes only that handler", () => {
      const client = createSSEClient({
        url: "http://x",
      });
      const h1 = vi.fn();
      const h2 = vi.fn();

      client.connect();
      const unsub = client.subscribe("player:state:health", h1);
      client.subscribe("player:state:health", h2);

      unsub();

      MockEventSource.latest().emit("player:state:health", { current: 50 });

      expect(h1).not.toHaveBeenCalled();
      expect(h2).toHaveBeenCalledOnce();
    });

    it("detaches the native listener when the last handler unsubscribes", () => {
      const client = createSSEClient({
        url: "http://x",
      });

      client.connect();
      const unsub = client.subscribe("player:state:health", vi.fn());

      expect(MockEventSource.latest().listenerCount("player:state:health")).toBe(1);

      unsub();

      expect(MockEventSource.latest().listenerCount("player:state:health")).toBe(0);
    });

    it("does not deliver events after the handler unsubscribes", () => {
      const client = createSSEClient({
        url: "http://x",
      });
      const handler = vi.fn();

      client.connect();
      const unsub = client.subscribe("player:state:health", handler);

      unsub();

      MockEventSource.latest().emit("player:state:health", { current: 50 });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("parse errors", () => {
    it("reports malformed JSON via onError and skips the handler", () => {
      const onError = vi.fn();
      const handler = vi.fn();
      const client = createSSEClient({
        url: "http://x",
        onError,
      });

      client.connect();
      client.subscribe("player:state:health", handler);

      MockEventSource.latest().emit("player:state:health", null, "not-json");

      expect(handler).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith({
        type: "parse",
        event: "player:state:health",
        cause: expect.any(SyntaxError),
      });
    });

    it("a parse error for one event does not break subsequent valid events", () => {
      const client = createSSEClient({
        url: "http://x",
        onError: vi.fn(),
      });
      const handler = vi.fn();

      client.connect();
      client.subscribe("player:state:health", handler);

      MockEventSource.latest().emit("player:state:health", null, "broken");
      MockEventSource.latest().emit("player:state:health", { current: 42 });

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith({ current: 42 });
    });
  });

  describe("reconnect preserves subscriptions", () => {
    it("re-attaches dispatchers for existing handlers after reconnect", () => {
      const client = createSSEClient({
        url: "http://x",
      });
      const handler = vi.fn();

      client.connect();
      client.subscribe("player:state:health", handler);
      client.disconnect();
      client.connect();

      MockEventSource.latest().emit("player:state:health", { current: 1 });

      expect(handler).toHaveBeenCalledWith({ current: 1 });
    });

    it("reconnects after a terminal error without an explicit disconnect", () => {
      const client = createSSEClient({
        url: "http://x",
      });

      client.connect();

      MockEventSource.latest().open();
      MockEventSource.latest().error(MockEventSource.CLOSED);

      client.connect();

      expect(MockEventSource.instances).toHaveLength(2);
    });

    it("re-delivers events through a fresh EventSource after error-then-reconnect", () => {
      const client = createSSEClient({
        url: "http://x",
      });
      const handler = vi.fn();

      client.subscribe("player:state:health", handler);
      client.connect();

      MockEventSource.latest().open();
      MockEventSource.latest().error(MockEventSource.CLOSED);

      client.connect();

      MockEventSource.latest().emit("player:state:health", { current: 77 });

      expect(handler).toHaveBeenCalledWith({ current: 77 });
    });
  });
});
