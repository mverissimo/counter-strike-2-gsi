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
});
