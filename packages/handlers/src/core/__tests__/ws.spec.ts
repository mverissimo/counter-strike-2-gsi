import { describe, expect, it, vi } from "vitest";

import { createWSCore } from "../ws";
import type { WSWriter } from "../ws";
import { createFakeManager, flush } from "./helpers/fake-manager";

function createRecordingWriter() {
  const frames: Array<{ event: string; data: unknown }> = [];

  const writer: WSWriter = {
    send(data) {
      frames.push(JSON.parse(data));
    },
    close() {},
  };

  return {
    writer,
    frames,
  };
}

const silent = () => {};

describe("createWSCore", () => {
  it("sends the current manager state as the first frame", async () => {
    const { manager } = createFakeManager({ round: { phase: "live" } });
    const core = createWSCore({
      manager,
      logger: silent,
    });

    const { writer, frames } = createRecordingWriter();
    const session = await core.connect(writer);

    await flush();

    expect(frames).toEqual([
      {
        event: "update",
        data: { round: { phase: "live" } },
      },
    ]);

    session.unsubscribe();
  });

  it("forwards subscribed events as frames", async () => {
    const { fake, manager } = createFakeManager();
    const core = createWSCore({
      manager,
      sendInitialState: false,
      logger: silent,
    });

    const { writer, frames } = createRecordingWriter();
    const session = await core.connect(writer);

    fake.emit("update", { round: { phase: "over" } });

    await flush();

    expect(frames).toEqual([
      {
        event: "update",
        data: { round: { phase: "over" } },
      },
    ]);

    session.unsubscribe();
  });

  it("removes manager listeners on unsubscribe and stops sending", async () => {
    const { fake, manager } = createFakeManager();
    const core = createWSCore({
      manager,
      sendInitialState: false,
      logger: silent,
    });

    const { writer, frames } = createRecordingWriter();
    const session = await core.connect(writer);

    expect(fake.listenerCount("update")).toBe(1);

    session.unsubscribe();

    expect(fake.listenerCount("update")).toBe(0);

    fake.emit("update", {});

    await flush();

    expect(frames).toHaveLength(0);
  });

  it("surfaces writer failures through onWriteError", async () => {
    const { fake, manager } = createFakeManager();
    const core = createWSCore({
      manager,
      sendInitialState: false,
      logger: silent,
    });

    const failure = new Error("boom");
    const writer: WSWriter = {
      send() {
        throw failure;
      },
      close() {},
    };

    const onWriteError = vi.fn();
    const session = await core.connect(writer, onWriteError);

    fake.emit("update", {});

    await flush();

    expect(onWriteError).toHaveBeenCalledWith(failure);

    session.unsubscribe();
  });

  describe("backpressure", () => {
    /** A writer whose every frame parks until the test releases it. */
    function createStalledWriter() {
      const gates: Array<() => void> = [];
      let accepted = 0;

      const writer: WSWriter = {
        send() {
          accepted++;

          return new Promise<void>((resolve) => gates.push(resolve));
        },
        close() {},
      };

      return {
        writer,
        async drain() {
          while (gates.length > 0) {
            gates.splice(0).forEach((resolve) => resolve());

            await flush();
          }
        },
        get accepted() {
          return accepted;
        },
      };
    }

    it("drops frames past maxPendingWrites instead of queueing them", async () => {
      const { fake, manager } = createFakeManager();
      const onBackpressure = vi.fn();
      const core = createWSCore({
        manager,
        sendInitialState: false,
        maxPendingWrites: 3,
        onBackpressure,
        logger: silent,
      });

      const stalled = createStalledWriter();
      const session = await core.connect(stalled.writer);

      for (let i = 0; i < 20; i++) {
        fake.emit("update", { round: { phase: "live" } });
      }

      await flush();

      expect(onBackpressure).toHaveBeenCalledTimes(17);

      await stalled.drain();

      expect(stalled.accepted).toBe(3);

      session.unsubscribe();
    });

    it("queues without limit when maxPendingWrites is 0", async () => {
      const { fake, manager } = createFakeManager();
      const onBackpressure = vi.fn();
      const core = createWSCore({
        manager,
        sendInitialState: false,
        maxPendingWrites: 0,
        onBackpressure,
        logger: silent,
      });

      const stalled = createStalledWriter();
      const session = await core.connect(stalled.writer);

      for (let i = 0; i < 20; i++) {
        fake.emit("update", { round: { phase: "live" } });
      }

      await flush();

      expect(onBackpressure).not.toHaveBeenCalled();

      await stalled.drain();

      expect(stalled.accepted).toBe(20);

      session.unsubscribe();
    });

    it("does not serialize a frame it is going to drop", async () => {
      const { fake, manager } = createFakeManager();
      const core = createWSCore({
        manager,
        sendInitialState: false,
        maxPendingWrites: 1,
        logger: silent,
      });

      const stalled = createStalledWriter();
      const session = await core.connect(stalled.writer);

      let serialized = 0;
      const payload = {
        get round() {
          serialized++;

          return { phase: "live" };
        },
      };

      for (let i = 0; i < 10; i++) {
        fake.emit("update", payload);
      }

      await flush();

      // JSON.stringify runs after the limit check, so a saturated connection
      // stops paying to encode state nobody will read.
      expect(serialized).toBe(1);

      await stalled.drain();

      session.unsubscribe();
    });
  });
});
