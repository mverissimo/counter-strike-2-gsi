import type { EventMap, EventPayload } from "@counter-strike-2-gsi/types";

export type SSEStatus = "connecting" | "connected" | "disconnected";

export type SSEError =
  | {
      type: "transport";
      cause: Event;
    }
  | {
      type: "parse";
      event: string;
      cause: unknown;
    };

export interface SSEClientOptions {
  /**
   * SSE endpoint URL
   */
  url: string;

  /**
   * Called on connection state changes
   */
  onStatusChange?: (status: SSEStatus) => void;

  /**
   * Called on transport or parse errors
   */
  onError?: (error: SSEError) => void;

  /**
   * Auto-reconnect when the EventSource reaches its terminal `CLOSED` state.
   * EventSource's built-in retry only runs while it's in `CONNECTING`;
   * once it goes to `CLOSED` (e.g. after a non-retryable HTTP error) it
   * stays there, so we re-open it ourselves with exponential backoff.
   * @default true
   */
  reconnect?: boolean;

  /**
   * @default 500
   */
  reconnectMinDelayMs?: number;

  /**
   * @default 10_000
   */
  reconnectMaxDelayMs?: number;
}

type Handler<E extends keyof EventMap> = (data: EventPayload<E>) => void;

export function createSSEClient(options: SSEClientOptions) {
  const {
    url,
    onStatusChange,
    onError,
    reconnect = true,
    reconnectMinDelayMs = 500,
    reconnectMaxDelayMs = 10_000,
  } = options;

  let source: EventSource | null = null;
  let userClosed = false;
  let attempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const handlers = new Map<keyof EventMap, Set<Handler<keyof EventMap>>>();
  const dispatchers = new Map<keyof EventMap, EventListener>();

  function scheduleReconnect() {
    if (!reconnect || userClosed || reconnectTimer !== null) {
      return;
    }

    const base = Math.min(reconnectMaxDelayMs, reconnectMinDelayMs * 2 ** attempt);
    const delay = base / 2 + Math.random() * (base / 2);

    attempt += 1;

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;

      if (!userClosed && !source) {
        connect();
      }
    }, delay);
  }

  function makeDispatcher(event: keyof EventMap): EventListener {
    return (e) => {
      let data: EventPayload<typeof event>;

      try {
        data = JSON.parse((e as MessageEvent).data);
      } catch (cause) {
        onError?.({
          type: "parse",
          event: String(event),
          cause,
        });

        return;
      }

      handlers.get(event)?.forEach((h) => h(data));
    };
  }

  function attach(event: keyof EventMap) {
    if (!source || dispatchers.has(event)) {
      return;
    }

    const d = makeDispatcher(event);

    source.addEventListener(String(event), d);

    dispatchers.set(event, d);
  }

  function detach(event: keyof EventMap) {
    const d = dispatchers.get(event);

    if (d && source) {
      source.removeEventListener(String(event), d);
    }

    dispatchers.delete(event);
  }

  function connect() {
    if (source) return;

    userClosed = false;

    onStatusChange?.("connecting");

    source = new EventSource(url);

    source.onopen = () => {
      attempt = 0;

      onStatusChange?.("connected");
    };

    source.onerror = (e) => {
      onError?.({
        type: "transport",
        cause: e,
      });

      if (source?.readyState === 0) {
        onStatusChange?.("connecting");
      } else if (source?.readyState === 2) {
        source = null;

        dispatchers.clear();
        onStatusChange?.("disconnected");
        scheduleReconnect();
      }
    };

    for (const event of handlers.keys()) {
      attach(event);
    }
  }

  function disconnect() {
    userClosed = true;

    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);

      reconnectTimer = null;
    }

    if (!source) {
      return;
    }

    source.close();
    source = null;

    dispatchers.clear();

    onStatusChange?.("disconnected");
  }

  function subscribe<E extends keyof EventMap>(event: E, handler: Handler<E>): () => void {
    let set = handlers.get(event);

    if (!set) {
      set = new Set();

      handlers.set(event, set);

      attach(event);
    }

    set.add(handler as Handler<keyof EventMap>);

    return () => {
      set.delete(handler as Handler<keyof EventMap>);

      if (set.size === 0) {
        handlers.delete(event);

        detach(event);
      }
    };
  }

  return {
    connect,
    disconnect,
    subscribe,
  };
}

export type SSEClient = ReturnType<typeof createSSEClient>;
