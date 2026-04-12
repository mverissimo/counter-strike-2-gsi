import type { EventMap, EventPayload } from "@counter-strike-2-gsi/types";
import type { SSEOptions } from "./types";

interface ReplayEvent<E extends keyof EventMap = keyof EventMap> {
  id: string;
  event: E;
  data: EventPayload<E>;
  timestamp: number;
}

/**
 * The transport-agnostic bridge that adapters implement.
 * Each method can be sync or async — the core awaits them either way.
 */
export interface SSEWriter {
  writeSSE(id: string, event: string, data: string): void | Promise<void>;
  writeComment(text: string): void | Promise<void>;
}

export interface SSESession {
  unsubscribe: () => void;
}

export function createSSECore(options: SSEOptions) {
  const {
    manager,
    events = ["update"],
    sendInitialState = true,
    heartbeatMs = 30_000,
    maxReplayEvents = 50,
    maxReplayAgeMs = 60_000,
    logger = console.log,
  } = options;

  const replayBuffer: ReplayEvent[] = [];
  let eventCounter = 0;

  const generateId = () => `${Date.now()}-${(++eventCounter).toString(36)}`;

  const parseEventId = (s: string): [number, number] => {
    const dash = s.lastIndexOf("-");

    if (dash === -1) {
      return [parseInt(s, 10) || 0, 0];
    }

    return [parseInt(s.slice(0, dash), 10) || 0, parseInt(s.slice(dash + 1), 36) || 0];
  };

  const isAfter = (id: string, since: string) => {
    const [ts1, ctr1] = parseEventId(id);
    const [ts2, ctr2] = parseEventId(since);

    return ts1 !== ts2 ? ts1 > ts2 : ctr1 > ctr2;
  };

  const trimStaleEvents = () => {
    const now = Date.now();

    while (replayBuffer.length && now - replayBuffer[0].timestamp > maxReplayAgeMs) {
      replayBuffer.shift();
    }
  };

  const addToReplayBuffer = <E extends keyof EventMap>(
    eventName: E,
    payload: EventPayload<E>,
    id: string,
  ) => {
    trimStaleEvents();

    replayBuffer.push({
      id,
      event: eventName,
      data: payload,
      timestamp: Date.now(),
    });

    if (replayBuffer.length > maxReplayEvents) {
      replayBuffer.shift();
    }
  };

  /**
   * Connect a client. The adapter provides the writer and Last-Event-ID;
   * the core handles replay, subscriptions, and heartbeat.
   *
   * Returns a session with an `unsubscribe` callback the adapter
   * must call on client disconnect.
   */
  async function connect(writer: SSEWriter, lastEventId?: string): Promise<SSESession> {
    const clientId = `sse-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    logger(`[SSE] Client connected: ${clientId}`);

    if (lastEventId) {
      const now = Date.now();
      const eventsToReplay = replayBuffer.filter(
        (e) => isAfter(e.id, lastEventId) && now - e.timestamp < maxReplayAgeMs,
      );

      for (const re of eventsToReplay) {
        await writer.writeSSE(re.id, String(re.event), JSON.stringify(re.data));
      }

      if (eventsToReplay.length > 0) {
        logger(`[SSE] Replayed ${eventsToReplay.length} events to ${clientId}`);
      }
    }

    // Initial state
    if (sendInitialState) {
      const id = generateId();

      await writer.writeSSE(id, "update", JSON.stringify({ ...manager.state }));
    }

    // Subscribe to GSI events
    const unsubscribers: (() => void)[] = [];

    for (const eventName of events) {
      const handler = (payload: EventPayload<typeof eventName>) => {
        const id = generateId();

        writer.writeSSE(id, String(eventName), JSON.stringify(payload));
        addToReplayBuffer(eventName, payload, id);
      };

      unsubscribers.push(manager.on(eventName, handler));
    }

    // Heartbeat
    const heartbeatInterval = setInterval(() => {
      try {
        writer.writeComment("heartbeat");
      } catch {}
    }, heartbeatMs);

    return {
      unsubscribe() {
        logger(`[SSE] Client disconnected: ${clientId}`);

        clearInterval(heartbeatInterval);

        unsubscribers.forEach((unsub) => unsub());
      },
    };
  }

  return {
    connect,
  };
}

export type SSECore = ReturnType<typeof createSSECore>;
