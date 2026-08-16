import type { EventMap, EventPayload } from "@counter-strike-2-gsi/types";
import type { SSEOptions } from "./types";
import { createBackpressureQueue } from "./backpressure";

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

/** A connection slot acquired before an adapter commits its SSE response. */
export interface SSEConnectionReservation {
  release(): void;
}

/**
 * Optional per-connection write error callback. Fires when writer
 * methods throw/reject — useful for observability and for adapters
 * that need to react to a dead connection.
 */
export type SSEWriteErrorHandler = (error: unknown, context: "event" | "heartbeat") => void;

/**
 * Thrown by `connect` when `maxConnections` is already reached. Adapters catch
 * it and answer `503` rather than opening a stream they cannot serve.
 */
export class SSEConnectionLimitError extends Error {
  readonly limit: number;

  constructor(limit: number) {
    super(`SSE connection limit reached (${limit})`);

    this.name = "SSEConnectionLimitError";
    this.limit = limit;
  }
}

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
    maxPendingWrites = 256,
    maxConnections = 0,
    onBackpressure,
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

  // Slots held by `connect` calls that have passed the limit check but have
  // not finished replaying yet. Without it, N concurrent reconnects (what a
  // server restart actually looks like) all see the same pre-connect count and
  // sail past the cap together.
  let reserved = 0;
  const reservations = new Set<SSEConnectionReservation>();

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

  /** Atomically holds a connection slot before an adapter commits a response. */
  function reserve(): SSEConnectionReservation | undefined {
    if (maxConnections > 0 && connections.size + reserved >= maxConnections) {
      return undefined;
    }

    reserved++;

    const reservation: SSEConnectionReservation = {
      release() {
        if (!reservations.delete(reservation)) {
          return;
        }

        reserved--;
      },
    };

    reservations.add(reservation);

    return reservation;
  }

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
   * must call on client disconnect. Throws {@link SSEConnectionLimitError}
   * when `maxConnections` is already reached. Adapters should pass a slot
   * from {@link reserve} so admission happens before response headers commit.
   */
  async function connect(
    writer: SSEWriter,
    lastEventId?: string,
    onWriteError?: SSEWriteErrorHandler,
    reservation?: SSEConnectionReservation,
  ): Promise<SSESession> {
    const slot = reservation ?? reserve();

    if (!slot || !reservations.has(slot)) {
      throw new SSEConnectionLimitError(maxConnections);
    }

    try {
      return await openConnection(writer, lastEventId, onWriteError);
    } finally {
      slot.release();
    }
  }

  async function openConnection(
    writer: SSEWriter,
    lastEventId?: string,
    onWriteError?: SSEWriteErrorHandler,
  ): Promise<SSESession> {
    const clientId = `sse-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    logger(`[SSE] Client connected: ${clientId}`);

    let closed = false;

    // Serialize writes so async writers (e.g. Hono) can't interleave or
    // drop events under 64 Hz GSI load, bounded by `maxPendingWrites` so a
    // writer slower than the event rate can't retain an unbounded backlog
    // for the life of the connection. See {@link createBackpressureQueue}.
    const queue = createBackpressureQueue({
      clientId,
      maxPendingWrites,
      logger,
      onBackpressure,
      label: "SSE",
      unit: "writes",
    });

    const enqueueWrite = (fn: () => void | Promise<void>, context: "event" | "heartbeat") =>
      queue.enqueue(fn, (err) => onWriteError?.(err, context));

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
        queue.close();

        logger(`[SSE] Client disconnected: ${clientId}`);

        clearInterval(heartbeatInterval);

        connections.delete(connection);

        if (connections.size === 0) {
          unsubscribeFromManager();
        }
      },
    };
  }

  /**
   * Whether a further `connect` would be refused.
   *
   * Adapters check this *before* committing to a stream: SSE responses start
   * with a `200` and event-stream headers, and once those are on the wire
   * there is no status left to say "full" with. `connect` still throws on its
   * own, so this racing under a burst costs a late rejection, not an
   * over-admitted connection.
   */
  const isFull = () => maxConnections > 0 && connections.size + reserved >= maxConnections;

  return {
    connect,
    reserve,
    isFull,
  };
}

export type SSECore = ReturnType<typeof createSSECore>;
