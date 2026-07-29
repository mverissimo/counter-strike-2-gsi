import type { EventMap, EventPayload } from "@counter-strike-2-gsi/types";

export type WSStatus = "connecting" | "connected" | "disconnected";
export type WSError =
  | {
      type: "transport";
      cause: Event;
    }
  | {
      type: "parse";
      cause: unknown;
      raw: string;
    };

export interface WSClientOptions {
  /**
   * WebSocket endpoint URL (`ws://` or `wss://`).
   */
  url: string;

  /**
   * Called on connection state changes.
   */
  onStatusChange?: (status: WSStatus) => void;

  /**
   * Called on transport or parse errors.
   */
  onError?: (error: WSError) => void;

  /**
   * Auto-reconnect when the socket closes unexpectedly. Uses exponential
   * backoff with jitter between `reconnectMinDelayMs` and `reconnectMaxDelayMs`.
   * @default true
   */
  reconnect?: boolean;

  /**
   * Also reconnect when the server closes the socket *cleanly* — close code
   * 1000 (normal) or 1001 (going away).
   *
   * A clean close is the server stating it is done with this connection: a
   * shutdown, a deploy, a deliberate kick. Retrying into it produces a
   * backoff loop against an endpoint that has no intention of serving, so by
   * default only unexpected closes (1006 and friends) are retried. Turn this
   * on when the server closes cleanly for reasons the client should ride out,
   * e.g. a rolling restart behind a load balancer.
   * @default false
   */
  reconnectOnCleanClose?: boolean;

  /** @default 500 */
  reconnectMinDelayMs?: number;

  /** @default 10_000 */
  reconnectMaxDelayMs?: number;
}

/**
 * Close codes that mean "the server meant to do this". 1005 (no status) is
 * deliberately absent: it's what a socket reports when no code was sent at
 * all, which is indistinguishable from a connection that simply went away.
 */
const CLEAN_CLOSE_CODES = new Set([1000, 1001]);

type Handler<E extends keyof EventMap> = (data: EventPayload<E>) => void;

interface Payload {
  event: keyof EventMap;
  data: unknown;
}

export function createWSClient(options: WSClientOptions) {
  const {
    url,
    onStatusChange,
    onError,
    reconnect = true,
    reconnectOnCleanClose = false,
    reconnectMinDelayMs = 500,
    reconnectMaxDelayMs = 10_000,
  } = options;

  let socket: WebSocket | null = null;
  let userClosed = false;
  let attempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const handlers = new Map<keyof EventMap, Set<Handler<keyof EventMap>>>();

  function scheduleReconnect() {
    if (!reconnect || userClosed || reconnectTimer !== null) {
      return;
    }

    const base = Math.min(reconnectMaxDelayMs, reconnectMinDelayMs * 2 ** attempt);
    const delay = base / 2 + Math.random() * (base / 2);

    attempt += 1;

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;

      if (!userClosed) {
        connect();
      }
    }, delay);
  }

  function connect() {
    if (socket) {
      return;
    }

    userClosed = false;

    onStatusChange?.("connecting");

    socket = new WebSocket(url);

    socket.onopen = () => {
      attempt = 0;

      onStatusChange?.("connected");
    };

    socket.onerror = (e) => {
      onError?.({
        type: "transport",
        cause: e,
      });
    };

    socket.onclose = (e) => {
      socket = null;

      onStatusChange?.("disconnected");

      if (!reconnectOnCleanClose && CLEAN_CLOSE_CODES.has(e.code)) {
        return;
      }

      scheduleReconnect();
    };

    socket.onmessage = (e) => {
      const raw = typeof e.data === "string" ? e.data : String(e.data);

      let frame: Payload;

      try {
        frame = JSON.parse(raw);
      } catch (cause) {
        onError?.({
          type: "parse",
          cause,
          raw,
        });

        return;
      }

      handlers.get(frame.event)?.forEach((h) => h(frame.data as EventPayload<keyof EventMap>));
    };
  }

  function disconnect() {
    userClosed = true;

    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);

      reconnectTimer = null;
    }

    if (!socket) {
      return;
    }

    const s = socket;

    socket = null;

    s.onclose = null;
    s.close();
    onStatusChange?.("disconnected");
  }

  function subscribe<E extends keyof EventMap>(event: E, handler: Handler<E>): () => void {
    let set = handlers.get(event);

    if (!set) {
      set = new Set();

      handlers.set(event, set);
    }

    set.add(handler as Handler<keyof EventMap>);

    return () => {
      set.delete(handler as Handler<keyof EventMap>);

      if (set.size === 0) {
        handlers.delete(event);
      }
    };
  }

  return {
    connect,
    disconnect,
    subscribe,
  };
}

export type WSClient = ReturnType<typeof createWSClient>;
