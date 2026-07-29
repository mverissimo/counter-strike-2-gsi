import { afterEach, describe, expect, it, vi } from "vitest";

import { createSSECore } from "../sse";
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
