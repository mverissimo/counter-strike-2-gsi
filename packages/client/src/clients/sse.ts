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
}

type Handler<E extends keyof EventMap> = (data: EventPayload<E>) => void;

export function createSSEClient(options: SSEClientOptions) {
  const { url, onStatusChange, onError } = options;

  let source: EventSource | null = null;

  const handlers = new Map<keyof EventMap, Set<Handler<keyof EventMap>>>();
  const dispatchers = new Map<keyof EventMap, EventListener>();

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

    onStatusChange?.("connecting");

    source = new EventSource(url);

    source.onopen = () => onStatusChange?.("connected");

    source.onerror = (e) => {
      onError?.({
        type: "transport",
        cause: e,
      });

      if (source?.readyState === 0) {
        onStatusChange?.("connecting");
      } else if (source?.readyState === 2) {
        onStatusChange?.("disconnected");
      }
    };

    for (const event of handlers.keys()) {
      attach(event);
    }
  }

  function disconnect() {
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
      set!.delete(handler as Handler<keyof EventMap>);

      if (set!.size === 0) {
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
