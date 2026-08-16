import { afterEach, describe, expect, it, vi } from "vitest";

import { createSSECore, SSEConnectionLimitError } from "../sse";
import type { SSEWriter } from "../sse";
import { createFakeManager, flush } from "./helpers/fake-manager";

interface RecordedWrite {
  id: string;
  event: string;
  data: string;
}

function createRecordingWriter() {
  const writes: RecordedWrite[] = [];
  const comments: string[] = [];

  const writer: SSEWriter = {
    writeSSE(id, event, data) {
      writes.push({
        id,
        event,
        data,
      });
    },
    writeComment(text) {
      comments.push(text);
    },
  };

  return {
    writer,
    writes,
    comments,
  };
}

const silent = () => {};

describe("createSSECore", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends the current manager state on connect", async () => {
    const { manager } = createFakeManager({ round: { phase: "live" } });
    const core = createSSECore({
      manager,
      logger: silent,
    });

    const { writer, writes } = createRecordingWriter();
    const session = await core.connect(writer);

    await flush();

    expect(writes).toHaveLength(1);
    expect(writes[0].event).toBe("update");
    expect(JSON.parse(writes[0].data)).toEqual({ round: { phase: "live" } });

    session.unsubscribe();
  });

  it("fans one event out to every connection", async () => {
    const { fake, manager } = createFakeManager();
    const core = createSSECore({
      manager,
      sendInitialState: false,
      logger: silent,
    });

    const a = createRecordingWriter();
    const b = createRecordingWriter();
    const sessionA = await core.connect(a.writer);
    const sessionB = await core.connect(b.writer);

    fake.emit("update", { round: { phase: "over" } });

    await flush();

    expect(a.writes).toHaveLength(1);
    expect(b.writes).toHaveLength(1);
    expect(a.writes[0].id).toBe(b.writes[0].id);

    sessionA.unsubscribe();
    sessionB.unsubscribe();
  });

  it("buffers each event once regardless of connection count (replay dedup)", async () => {
    const { fake, manager } = createFakeManager();
    const core = createSSECore({
      manager,
      sendInitialState: false,
      logger: silent,
    });

    const a = createRecordingWriter();
    const b = createRecordingWriter();
    const sessionA = await core.connect(a.writer);
    const sessionB = await core.connect(b.writer);

    fake.emit("update", { round: { phase: "over" } });

    await flush();

    // Reconnect from before the event: exactly one replayed event, even
    // though two clients were connected when it was buffered.
    const late = createRecordingWriter();
    const sessionLate = await core.connect(late.writer, "0-0");

    await flush();

    expect(late.writes).toHaveLength(1);
    expect(late.writes[0].event).toBe("update");

    sessionA.unsubscribe();
    sessionB.unsubscribe();
    sessionLate.unsubscribe();
  });

  it("subscribes to the manager once per event, not per connection", async () => {
    const { fake, manager } = createFakeManager();
    const core = createSSECore({
      manager,
      sendInitialState: false,
      logger: silent,
    });

    const a = createRecordingWriter();
    const b = createRecordingWriter();
    const sessionA = await core.connect(a.writer);
    const sessionB = await core.connect(b.writer);

    expect(fake.listenerCount("update")).toBe(1);

    sessionA.unsubscribe();

    expect(fake.listenerCount("update")).toBe(1);

    sessionB.unsubscribe();

    expect(fake.listenerCount("update")).toBe(0);
  });

  it("stops delivering to an unsubscribed connection", async () => {
    const { fake, manager } = createFakeManager();
    const core = createSSECore({
      manager,
      sendInitialState: false,
      logger: silent,
    });

    const a = createRecordingWriter();
    const session = await core.connect(a.writer);

    session.unsubscribe();

    fake.emit("update", { round: { phase: "over" } });

    await flush();

    expect(a.writes).toHaveLength(0);
  });

  it("emits heartbeat comments on the configured interval", async () => {
    vi.useFakeTimers();

    const { manager } = createFakeManager();
    const core = createSSECore({
      manager,
      sendInitialState: false,
      heartbeatMs: 1000,
      logger: silent,
    });

    const a = createRecordingWriter();
    const session = await core.connect(a.writer);

    await vi.advanceTimersByTimeAsync(3000);

    expect(a.comments).toEqual(["heartbeat", "heartbeat", "heartbeat"]);

    session.unsubscribe();

    await vi.advanceTimersByTimeAsync(3000);

    expect(a.comments).toHaveLength(3);
  });

  describe("replay and initial state", () => {
    it("replays first, then sends the state snapshot", async () => {
      const { fake, manager } = createFakeManager({ round: { phase: "over" } });
      const core = createSSECore({
        manager,
        logger: silent,
      });

      const first = createRecordingWriter();
      const sessionFirst = await core.connect(first.writer);

      await flush();

      fake.emit("update", { round: { phase: "live" } });

      await flush();

      const late = createRecordingWriter();
      const sessionLate = await core.connect(late.writer, "0-0");

      await flush();

      // Replayed event, then the snapshot — state always wins, so the client
      // can never end up behind whatever it replayed.
      expect(late.writes).toHaveLength(2);
      expect(JSON.parse(late.writes[0].data)).toEqual({ round: { phase: "live" } });
      expect(JSON.parse(late.writes[1].data)).toEqual({ round: { phase: "over" } });

      sessionFirst.unsubscribe();
      sessionLate.unsubscribe();
    });

    it("'only-if-no-replay' skips the snapshot when events were replayed", async () => {
      const { fake, manager } = createFakeManager();
      const core = createSSECore({
        manager,
        sendInitialState: "only-if-no-replay",
        logger: silent,
      });

      const first = createRecordingWriter();
      const sessionFirst = await core.connect(first.writer);

      fake.emit("update", { round: { phase: "live" } });

      await flush();

      const late = createRecordingWriter();
      const sessionLate = await core.connect(late.writer, "0-0");

      await flush();

      expect(late.writes).toHaveLength(1);
      expect(JSON.parse(late.writes[0].data)).toEqual({ round: { phase: "live" } });

      sessionFirst.unsubscribe();
      sessionLate.unsubscribe();
    });

    it("'only-if-no-replay' still sends the snapshot to a brand-new client", async () => {
      const { manager } = createFakeManager({ round: { phase: "live" } });
      const core = createSSECore({
        manager,
        sendInitialState: "only-if-no-replay",
        logger: silent,
      });

      const { writer, writes } = createRecordingWriter();
      const session = await core.connect(writer);

      await flush();

      expect(writes).toHaveLength(1);
      expect(JSON.parse(writes[0].data)).toEqual({ round: { phase: "live" } });

      session.unsubscribe();
    });

    it("'only-if-no-replay' sends the snapshot when Last-Event-ID matches nothing stale", async () => {
      const { fake, manager } = createFakeManager({ round: { phase: "over" } });
      const core = createSSECore({
        manager,
        sendInitialState: "only-if-no-replay",
        logger: silent,
      });

      const first = createRecordingWriter();
      const sessionFirst = await core.connect(first.writer);

      fake.emit("update", { round: { phase: "live" } });

      await flush();

      const lastId = first.writes.at(-1)!.id;

      // Reconnecting from the newest id: nothing to replay, so the client is
      // resynced from state instead of being left with nothing.
      const late = createRecordingWriter();
      const sessionLate = await core.connect(late.writer, lastId);

      await flush();

      expect(late.writes).toHaveLength(1);
      expect(JSON.parse(late.writes[0].data)).toEqual({ round: { phase: "over" } });

      sessionFirst.unsubscribe();
      sessionLate.unsubscribe();
    });

    it("keeps event ids increasing when the wall clock steps backwards", async () => {
      const { fake, manager } = createFakeManager();
      const core = createSSECore({
        manager,
        sendInitialState: false,
        logger: silent,
      });

      const { writer, writes } = createRecordingWriter();
      const session = await core.connect(writer);

      const now = Date.now();
      const clock = vi.spyOn(Date, "now");

      clock.mockReturnValue(now);
      fake.emit("update", { round: { phase: "live" } });

      // NTP correction / VM resume: the clock jumps a minute into the past.
      clock.mockReturnValue(now - 60_000);
      fake.emit("update", { round: { phase: "over" } });

      await flush();

      clock.mockRestore();

      const [first, second] = writes.map((w) => w.id);

      expect(writes).toHaveLength(2);
      // Same timestamp component (clamped), counter breaks the tie.
      expect(second.split("-")[0]).toBe(first.split("-")[0]);
      expect(parseInt(second.split("-")[1], 36)).toBeGreaterThan(parseInt(first.split("-")[1], 36));

      // And the second event is still replayable to a client sitting on the
      // first id — the whole point of the monotonic clamp.
      const late = createRecordingWriter();
      const sessionLate = await core.connect(late.writer, first);

      await flush();

      expect(late.writes).toHaveLength(1);
      expect(JSON.parse(late.writes[0].data)).toEqual({ round: { phase: "over" } });

      session.unsubscribe();
      sessionLate.unsubscribe();
    });
  });

  // A writer slower than the event rate used to grow `writeChain` forever:
  // one retained payload per tick, 64 per second, for the life of the socket.
  describe("backpressure", () => {
    /** A writer whose every write parks until the test releases it. */
    function createStalledWriter() {
      const gates: Array<() => void> = [];
      let accepted = 0;

      const writer: SSEWriter = {
        writeSSE() {
          accepted++;

          return new Promise<void>((resolve) => gates.push(resolve));
        },
        writeComment() {
          return new Promise<void>((resolve) => gates.push(resolve));
        },
      };

      return {
        writer,
        /**
         * Writes are serialized, so only one is ever parked at a time and the
         * next appears only once its predecessor resolves. Releasing has to
         * repeat until the chain stops producing gates.
         */
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

    it("drops writes past maxPendingWrites instead of queueing them", async () => {
      const { fake, manager } = createFakeManager();
      const onBackpressure = vi.fn();
      const core = createSSECore({
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
      expect(onBackpressure.mock.calls.at(-1)![0]).toMatchObject({
        pending: 3,
        dropped: 17,
      });

      await stalled.drain();

      // The queue is bounded, so the client gets the 3 it had room for and
      // skips the rest — not 20 frames retained in memory on its behalf.
      expect(stalled.accepted).toBe(3);

      session.unsubscribe();
    });

    it("accepts writes again once the queue drains", async () => {
      const { fake, manager } = createFakeManager();
      const core = createSSECore({
        manager,
        sendInitialState: false,
        maxPendingWrites: 2,
        logger: silent,
      });

      const stalled = createStalledWriter();
      const session = await core.connect(stalled.writer);

      for (let i = 0; i < 5; i++) {
        fake.emit("update", { round: { phase: "live" } });
      }

      await flush();
      await stalled.drain();

      expect(stalled.accepted).toBe(2);

      // Drained means back under the limit: the connection is not written off
      // for the rest of its life just because it once fell behind.
      fake.emit("update", { round: { phase: "over" } });

      await flush();
      await stalled.drain();

      expect(stalled.accepted).toBe(3);

      session.unsubscribe();
    });

    it("leaves other connections unaffected by one slow client", async () => {
      const { fake, manager } = createFakeManager();
      const core = createSSECore({
        manager,
        sendInitialState: false,
        maxPendingWrites: 2,
        logger: silent,
      });

      const stalled = createStalledWriter();
      const healthy = createRecordingWriter();
      const stalledSession = await core.connect(stalled.writer);
      const healthySession = await core.connect(healthy.writer);

      // One event per tick, as CS2 delivers them: the healthy connection
      // drains between ticks and never approaches the limit, while the stalled
      // one saturates immediately.
      for (let i = 0; i < 10; i++) {
        fake.emit("update", { round: { phase: "live" } });

        await flush();
      }

      expect(healthy.writes).toHaveLength(10);
      expect(stalled.accepted).toBe(1);

      await stalled.drain();

      stalledSession.unsubscribe();
      healthySession.unsubscribe();
    });

    it("queues without limit when maxPendingWrites is 0", async () => {
      const { fake, manager } = createFakeManager();
      const onBackpressure = vi.fn();
      const core = createSSECore({
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
  });

  describe("connection limit", () => {
    it("refuses connections past maxConnections", async () => {
      const { manager } = createFakeManager();
      const core = createSSECore({
        manager,
        sendInitialState: false,
        maxConnections: 2,
        logger: silent,
      });

      const first = await core.connect(createRecordingWriter().writer);
      const second = await core.connect(createRecordingWriter().writer);

      expect(core.isFull()).toBe(true);
      await expect(core.connect(createRecordingWriter().writer)).rejects.toThrow(
        SSEConnectionLimitError,
      );

      first.unsubscribe();

      expect(core.isFull()).toBe(false);

      const third = await core.connect(createRecordingWriter().writer);

      second.unsubscribe();
      third.unsubscribe();
    });

    it("counts in-flight connects so a burst cannot slip past the cap", async () => {
      const { manager } = createFakeManager();
      const core = createSSECore({
        manager,
        // Forces every connect to await a write before it registers, which is
        // the window a plain `connections.size` check misses.
        sendInitialState: true,
        maxConnections: 1,
        logger: silent,
      });

      const results = await Promise.allSettled([
        core.connect(createRecordingWriter().writer),
        core.connect(createRecordingWriter().writer),
        core.connect(createRecordingWriter().writer),
      ]);

      const accepted = results.filter((r) => r.status === "fulfilled");

      expect(accepted).toHaveLength(1);

      for (const result of accepted) {
        (
          result as PromiseFulfilledResult<Awaited<ReturnType<typeof core.connect>>>
        ).value.unsubscribe();
      }
    });

    it("reserves a slot before an adapter commits its response", async () => {
      const { manager } = createFakeManager();
      const core = createSSECore({
        manager,
        sendInitialState: false,
        maxConnections: 1,
        logger: silent,
      });

      const reservation = core.reserve();

      expect(reservation).toBeDefined();
      expect(core.isFull()).toBe(true);
      expect(core.reserve()).toBeUndefined();

      const session = await core.connect(
        createRecordingWriter().writer,
        undefined,
        undefined,
        reservation,
      );

      expect(core.isFull()).toBe(true);

      session.unsubscribe();

      expect(core.isFull()).toBe(false);
    });

    it("releases an unused reservation explicitly", () => {
      const { manager } = createFakeManager();
      const core = createSSECore({
        manager,
        maxConnections: 1,
        logger: silent,
      });

      const reservation = core.reserve();

      expect(core.isFull()).toBe(true);

      reservation?.release();

      expect(core.isFull()).toBe(false);
    });

    it("is unlimited by default", async () => {
      const { manager } = createFakeManager();
      const core = createSSECore({
        manager,
        sendInitialState: false,
        logger: silent,
      });

      const sessions = [];

      for (let i = 0; i < 50; i++) {
        sessions.push(await core.connect(createRecordingWriter().writer));
      }

      expect(core.isFull()).toBe(false);

      sessions.forEach((session) => session.unsubscribe());
    });
  });

  it("surfaces writer failures through onWriteError", async () => {
    const { fake, manager } = createFakeManager();
    const core = createSSECore({
      manager,
      sendInitialState: false,
      logger: silent,
    });

    const failure = new Error("boom");
    const writer: SSEWriter = {
      writeSSE() {
        throw failure;
      },
      writeComment() {},
    };

    const onWriteError = vi.fn();
    const session = await core.connect(writer, undefined, onWriteError);

    fake.emit("update", {});

    await flush();

    expect(onWriteError).toHaveBeenCalledWith(failure, "event");

    session.unsubscribe();
  });
});
