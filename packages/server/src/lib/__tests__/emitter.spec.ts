import { describe, it, expect, vi } from "vitest";

import { createEmitter } from "../emitter";

describe("@server/lib: createEmitter", () => {
  describe("on", () => {
    it("delivers the emitted payload to the registered listener", () => {
      const emitter = createEmitter<{
        ping: number;
      }>();

      const listener = vi.fn();

      emitter.on("ping", listener);
      emitter.emit("ping", 42);

      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith(42);
    });

    it("returns an unsubscribe function that removes the listener", () => {
      const emitter = createEmitter<{ ping: number }>();
      const listener = vi.fn();
      const unsub = emitter.on("ping", listener);

      unsub();

      emitter.emit("ping", 1);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("off", () => {
    it("removes only the targeted listener", () => {
      const emitter = createEmitter<{ ping: number }>();
      const a = vi.fn();
      const b = vi.fn();

      emitter.on("ping", a);
      emitter.on("ping", b);
      emitter.off("ping", a);
      emitter.emit("ping", 1);

      expect(a).not.toHaveBeenCalled();
      expect(b).toHaveBeenCalledOnce();
    });

    it("without a handler removes ALL listeners for that event", () => {
      const emitter = createEmitter<{ ping: number }>();
      const a = vi.fn();
      const b = vi.fn();

      emitter.on("ping", a);
      emitter.on("ping", b);
      emitter.off("ping");
      emitter.emit("ping", 1);

      expect(a).not.toHaveBeenCalled();
      expect(b).not.toHaveBeenCalled();
    });

    it("unsub on a non-existent event is a safe no-op", () => {
      const emitter = createEmitter<{ ping: number }>();

      expect(() => emitter.off("ping")).not.toThrow();
    });

    it("unsub a handler not in the list is a safe no-op", () => {
      const emitter = createEmitter<{ ping: number }>();
      const a = vi.fn();
      const unregistered = vi.fn();

      emitter.on("ping", a);

      expect(() => emitter.off("ping", unregistered)).not.toThrow();

      emitter.emit("ping", 1);

      expect(a).toHaveBeenCalledOnce();
    });
  });

  describe("once", () => {
    it("fires exactly once and then self-removes", () => {
      const emitter = createEmitter<{ ping: number }>();
      const listener = vi.fn();

      emitter.once("ping", listener);
      emitter.emit("ping", 1);
      emitter.emit("ping", 2);
      emitter.emit("ping", 3);

      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith(1);
    });

    it("returns an unsubscribe function that prevents the listener from ever firing", () => {
      const emitter = createEmitter<{ ping: number }>();
      const listener = vi.fn();
      const unsub = emitter.once("ping", listener);

      unsub();

      emitter.emit("ping", 1);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("emit", () => {
    it("is a safe no-op when there are no listeners for the event", () => {
      const emitter = createEmitter<{ ping: number }>();

      expect(() => emitter.emit("ping", 1)).not.toThrow();
    });

    it("calls multiple listeners in registration order", () => {
      const emitter = createEmitter<{ ping: number }>();
      const order: string[] = [];

      emitter.on("ping", () => order.push("first"));
      emitter.on("ping", () => order.push("second"));
      emitter.on("ping", () => order.push("third"));
      emitter.emit("ping", 0);

      expect(order).toEqual(["first", "second", "third"]);
    });

    it("events on different keys do not interfere with each other", () => {
      const emitter = createEmitter<{ ping: number; pong: string }>();
      const pingSpy = vi.fn();
      const pongSpy = vi.fn();

      emitter.on("ping", pingSpy);
      emitter.on("pong", pongSpy);
      emitter.emit("ping", 42);

      expect(pingSpy).toHaveBeenCalledOnce();
      expect(pongSpy).not.toHaveBeenCalled();
    });

    it("a listener added during emit is not called in the same emit cycle", () => {
      const emitter = createEmitter<{
        ping: number;
      }>();
      const late = vi.fn();

      emitter.on("ping", () => {
        emitter.on("ping", late); // register mid-emit
      });

      emitter.emit("ping", 1);

      // The snapshot (`[...set]`) taken at emit-time means late-registered
      // handlers are not included in the current cycle.
      expect(late).not.toHaveBeenCalled();

      // But it fires in the next cycle.
      emitter.emit("ping", 2);

      expect(late).toHaveBeenCalledOnce();
    });
  });
});
