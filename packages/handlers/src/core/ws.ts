import type { EventPayload } from "@counter-strike-2-gsi/types";
import type { WSOptions } from "./types";

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
 * Frame format sent to the client. Mirrors the SSE `event`/`data` pair
 * so client code can share payload types.
 */
export interface WSFrame<E extends string = string> {
  event: E;
  data: unknown;
}

export function createWSCore(options: WSOptions) {
  const { manager, events = ["update"], sendInitialState = true, logger = console.log } = options;

  let clientCounter = 0;

  async function connect(writer: WSWriter): Promise<WSSession> {
    const clientId = `ws-${Date.now()}-${++clientCounter}`;

    logger(`[WS] Client connected: ${clientId}`);

    const sendFrame = (event: string, data: unknown) => {
      try {
        return writer.send(JSON.stringify({ event, data }));
      } catch {}
    };

    if (sendInitialState) {
      await sendFrame("update", { ...manager.state });
    }

    const unsubscribers: Array<() => void> = [];

    for (const eventName of events) {
      const handler = (payload: EventPayload<typeof eventName>) => {
        sendFrame(String(eventName), payload);
      };

      unsubscribers.push(manager.on(eventName, handler));
    }

    return {
      unsubscribe() {
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
