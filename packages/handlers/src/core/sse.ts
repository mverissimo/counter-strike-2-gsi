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

/**
 * Optional per-connection write error callback. Fires when writer
 * methods throw/reject — useful for observability and for adapters
 * that need to react to a dead connection.
 */
export type SSEWriteErrorHandler = (error: unknown, context: "event" | "heartbeat") => void;

interface Connection {
  writer: SSEWriter;
  enqueueWrite(fn: () => void | Promise<void>, context: "event" | "heartbeat"): Promise<void>;
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
  let lastTimestamp = 0;

  /**
   * `Date.now()` clamped to a monotonic high-water mark.
   *
   * Every ordering decision in here — which buffered events a reconnecting
   * client still needs, which ones have aged out — is a comparison of wall
   * clock readings. A backwards step (NTP correction, VM resume, manual clock
   * change) breaks both at once: new events get IDs that sort *before* ones
   * the client already saw, and freshly buffered events look older than
   * `maxReplayAgeMs` and get dropped on the spot. Reading the clock through
   * here instead keeps the buffer internally consistent; the event counter
   * breaks ties inside a frozen millisecond.
   *
   * The cost is that a backwards jump freezes the *ages* in the buffer until
   * the real clock catches up, which at worst holds events slightly past
   * their nominal expiry — cheap next to replaying or losing them.
   */
  const monotonicNow = () => {
    const now = Date.now();

    if (now > lastTimestamp) {
      lastTimestamp = now;
    }

    return lastTimestamp;
  };

  const generateId = () => `${monotonicNow()}-${(++eventCounter).toString(36)}`;

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
    const now = monotonicNow();

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
      timestamp: monotonicNow(),
    });

    if (replayBuffer.length > maxReplayEvents) {
      replayBuffer.shift();
    }
  };

  // One manager subscription per event, shared by every connection. The
  // replay buffer is core-level state, so it must be populated exactly once
  // per GSI event — never per connection — or reconnecting clients replay
  // duplicates.
  const connections = new Set<Connection>();
  let managerUnsubs: Array<() => void> = [];

  const subscribeToManager = () => {
    for (const eventName of events) {
      const handler = (payload: EventPayload<typeof eventName>) => {
        const id = generateId();

        addToReplayBuffer(eventName, payload, id);

        const data = JSON.stringify(payload);

        for (const connection of connections) {
          void connection.enqueueWrite(
            () => connection.writer.writeSSE(id, String(eventName), data),
            "event",
          );
        }
      };

      managerUnsubs.push(manager.on(eventName, handler));
    }
  };

  const unsubscribeFromManager = () => {
    managerUnsubs.forEach((unsub) => unsub());
    managerUnsubs = [];
  };

  /**
   * Connect a client. The adapter provides the writer and Last-Event-ID;
   * the core handles replay, subscriptions, and heartbeat.
   *
   * Write order is fixed: buffered events newer than `Last-Event-ID` first,
   * then the initial state snapshot, then live events. See
   * {@link SSEOptions.sendInitialState} for the redundancy that replay +
   * snapshot implies and how to opt out of it.
   *
   * Returns a session with an `unsubscribe` callback the adapter
   * must call on client disconnect.
   */
  async function connect(
    writer: SSEWriter,
    lastEventId?: string,
    onWriteError?: SSEWriteErrorHandler,
  ): Promise<SSESession> {
    const clientId = `sse-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    logger(`[SSE] Client connected: ${clientId}`);

    let closed = false;
    let writeChain: Promise<void> = Promise.resolve();

    // Serialize writes so async writers (e.g. Hono) can't interleave or
    // drop events under 64 Hz GSI load. The chain never rejects — errors
    // are surfaced via onWriteError.
    const enqueueWrite = (fn: () => void | Promise<void>, context: "event" | "heartbeat") => {
      writeChain = writeChain.then(async () => {
        if (closed) {
          return;
        }

        try {
          await fn();
        } catch (err) {
          onWriteError?.(err, context);
        }
      });

      return writeChain;
    };

    let replayed = 0;

    if (lastEventId) {
      const now = monotonicNow();
      const eventsToReplay = replayBuffer.filter(
        (e) => isAfter(e.id, lastEventId) && now - e.timestamp < maxReplayAgeMs,
      );

      for (const re of eventsToReplay) {
        await enqueueWrite(
          () => writer.writeSSE(re.id, String(re.event), JSON.stringify(re.data)),
          "event",
        );
      }

      replayed = eventsToReplay.length;

      if (replayed > 0) {
        logger(`[SSE] Replayed ${replayed} events to ${clientId}`);
      }
    }

    const wantsInitialState =
      sendInitialState === "only-if-no-replay" ? replayed === 0 : sendInitialState;

    if (wantsInitialState) {
      const id = generateId();

      await enqueueWrite(
        () => writer.writeSSE(id, "update", JSON.stringify(manager.state)),
        "event",
      );
    }

    const connection: Connection = {
      writer,
      enqueueWrite,
    };

    if (connections.size === 0) {
      subscribeToManager();
    }

    connections.add(connection);

    const heartbeatInterval = setInterval(() => {
      void enqueueWrite(() => writer.writeComment("heartbeat"), "heartbeat");
    }, heartbeatMs);

    return {
      unsubscribe() {
        if (closed) return;

        closed = true;

        logger(`[SSE] Client disconnected: ${clientId}`);

        clearInterval(heartbeatInterval);

        connections.delete(connection);

        if (connections.size === 0) {
          unsubscribeFromManager();
        }
      },
    };
  }

  return {
    connect,
  };
}

export type SSECore = ReturnType<typeof createSSECore>;
