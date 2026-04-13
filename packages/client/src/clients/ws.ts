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
}

type Handler<E extends keyof EventMap> = (data: EventPayload<E>) => void;

interface Payload {
  event: keyof EventMap;
  data: unknown;
}

export function createWSClient(options: WSClientOptions) {
  const { url, onStatusChange, onError } = options;

  let socket: WebSocket | null = null;

  const handlers = new Map<keyof EventMap, Set<Handler<keyof EventMap>>>();

  function connect() {
    if (socket) {
      return;
    }

    onStatusChange?.("connecting");

    socket = new WebSocket(url);

    socket.onopen = () => onStatusChange?.("connected");
    socket.onerror = (e) => {
      onError?.({
        type: "transport",
        cause: e,
      });
    };

    socket.onclose = () => {
      socket = null;

      onStatusChange?.("disconnected");
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
      set!.delete(handler as Handler<keyof EventMap>);

      if (set!.size === 0) {
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
