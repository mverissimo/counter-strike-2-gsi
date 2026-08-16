import type { EventPayload } from "@counter-strike-2-gsi/types";
import type { WSOptions } from "./types";
import { createBackpressureQueue } from "./backpressure";

/**
 * Transport-agnostic bridge that WS adapters implement. Each method
 * can be sync or async — the core awaits them either way.
 */
export interface WSWriter {
  send(data: string): void | Promise<void>;
  close(): void | Promise<void>;
}

export interface WSSession {
  unsubscribe: () => void;
}

/**
 * Optional per-connection write error callback. Fires when writer
 * methods throw/reject.
 */
export type WSWriteErrorHandler = (error: unknown) => void;

/**
 * Frame format sent to the client. Mirrors the SSE `event`/`data` pair
 * so client code can share payload types.
 */
export interface WSFrame<E extends string = string> {
  event: E;
  data: unknown;
}

export function createWSCore(options: WSOptions) {
  const {
    manager,
    events = ["update"],
    sendInitialState = true,
    maxPendingWrites = 256,
    onBackpressure,
    logger = console.log,
  } = options;

  let clientCounter = 0;

  async function connect(writer: WSWriter, onWriteError?: WSWriteErrorHandler): Promise<WSSession> {
    const clientId = `ws-${Date.now()}-${++clientCounter}`;

    logger(`[WS] Client connected: ${clientId}`);

    let closed = false;

    // Bounded for the same reason as the SSE chain: a socket that reads
    // slower than CS2 produces would otherwise retain one frame per tick for
    // the life of the connection. See {@link createBackpressureQueue}.
    const queue = createBackpressureQueue({
      clientId,
      maxPendingWrites,
      logger,
      onBackpressure,
      label: "WS",
      unit: "frames",
    });

    const sendFrame = (event: string, data: unknown) => {
      // Stringify inside the enqueued closure, not here: `enqueue` skips
      // calling it at all once the queue is saturated, so a dropped frame
      // never pays to serialize state nobody will read.
      return queue.enqueue(
        () => writer.send(JSON.stringify({ event, data })),
        (err) => onWriteError?.(err),
      );
    };

    if (sendInitialState) {
      await sendFrame("update", { ...manager.state });
    }

    const unsubscribers: Array<() => void> = [];

    for (const eventName of events) {
      const handler = (payload: EventPayload<typeof eventName>) => {
        void sendFrame(String(eventName), payload);
      };

      unsubscribers.push(manager.on(eventName, handler));
    }

    return {
      unsubscribe() {
        if (closed) {
          return;
        }

        closed = true;
        queue.close();

        logger(`[WS] Client disconnected: ${clientId}`);

        unsubscribers.forEach((unsub) => unsub());
      },
    };
  }

  return {
    connect,
  };
}

export type WSCore = ReturnType<typeof createWSCore>;
