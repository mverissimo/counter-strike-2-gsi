import type {
  Delta,
  EventMap,
  EventPayload,
  GeneratedEventMap,
  PathValue,
  SchemaPayload,
} from "@counter-strike-2-gsi/types";

import { createSSEClient, type SSEError, type SSEStatus } from "./clients/sse";
import { createWSClient, type WSError } from "./clients/ws";

export interface CreateStoreOptions {
  url: string;
  onError?: (error: SSEError | WSError) => void;
}

type Listeners = Map<keyof EventMap, Set<() => void>>;

function readPath(state: unknown, event: string): unknown {
  let value = state;

  for (const segment of event.split(":")) {
    if (value === null || typeof value !== "object" || !Object.hasOwn(value, segment)) {
      return undefined;
    }

    value = (value as Record<string, unknown>)[segment];
  }

  return value;
}

function writePath(state: unknown, segments: string[], value: unknown): Record<string, unknown> {
  const [key, ...remaining] = segments;
  const next: Record<string, unknown> =
    state !== null && typeof state === "object" ? { ...state } : {};

  if (remaining.length > 0) {
    return {
      ...next,
      [key]: writePath(Object.hasOwn(next, key) ? next[key] : undefined, remaining, value),
    };
  } else if (value === undefined) {
    delete next[key];
  } else {
    return { ...next, [key]: value };
  }

  return next;
}

export function createStore({ url, onError }: CreateStoreOptions) {
  let state: SchemaPayload | undefined;
  let status: SSEStatus = "disconnected";
  let refCount = 0;
  let mounted = false;
  let mode: "auto" | "manual" | "paused" = "auto";

  const snapshot = new Map<keyof EventMap, unknown>();
  const eventListeners: Listeners = new Map();
  const valueListeners: Listeners = new Map();
  const statusListeners = new Set<() => void>();
  const clientUnsubs = new Map<keyof EventMap, () => void>();
  const clientRefs = new Map<keyof EventMap, number>();
  const factory =
    url.startsWith("ws://") || url.startsWith("wss://") ? createWSClient : createSSEClient;
  const client = factory({
    url,
    onError,
    onStatusChange(next) {
      if (next !== status) {
        status = next;
        statusListeners.forEach((listener) => listener());
      }
    },
  });

  function notifyValues(previous: SchemaPayload | undefined) {
    for (const [event, listeners] of valueListeners) {
      if (!Object.is(readPath(previous, event), readPath(state, event))) {
        listeners.forEach((listener) => listener());
      }
    }
  }

  client.subscribe("update", (data) => {
    const previous = state;
    state = data;
    snapshot.set("update", data);
    notifyValues(previous);
    eventListeners.get("update")?.forEach((listener) => listener());
  });

  function reconcile() {
    if (mounted && (mode === "manual" || (mode === "auto" && refCount > 0))) {
      client.connect();
    } else {
      client.disconnect();
    }
  }

  function subscribe(listeners: Listeners, event: keyof EventMap, listener: () => void) {
    let set = listeners.get(event);
    if (!set) {
      set = new Set();
      listeners.set(event, set);
    }
    set.add(listener);

    const segments = event.split(":");
    const transportEvents =
      listeners === valueListeners
        ? segments.map((_, index) => segments.slice(0, index + 1).join(":") as keyof EventMap)
        : [event];

    for (const transportEvent of transportEvents) {
      if (transportEvent === "update") continue;
      clientRefs.set(transportEvent, (clientRefs.get(transportEvent) ?? 0) + 1);
      if (clientUnsubs.has(transportEvent)) continue;

      clientUnsubs.set(
        transportEvent,
        client.subscribe(transportEvent, (data) => {
          const previous = state;
          state = writePath(
            state,
            transportEvent.split(":"),
            (data as Delta<unknown>).current,
          ) as SchemaPayload;
          snapshot.set(transportEvent, data);
          notifyValues(previous);
          eventListeners.get(transportEvent)?.forEach((callback) => callback());
        }),
      );
    }

    refCount += 1;
    reconcile();
    let subscribed = true;

    return () => {
      if (!subscribed) return;
      subscribed = false;
      set.delete(listener);
      if (set.size === 0) listeners.delete(event);

      for (const transportEvent of transportEvents) {
        if (transportEvent === "update") continue;
        const remaining = (clientRefs.get(transportEvent) ?? 1) - 1;
        if (remaining > 0) {
          clientRefs.set(transportEvent, remaining);
        } else {
          clientRefs.delete(transportEvent);
          clientUnsubs.get(transportEvent)?.();
          clientUnsubs.delete(transportEvent);
        }
      }
      refCount -= 1;
      reconcile();
    };
  }

  return {
    getStatus: () => status,
    getEvent: <K extends keyof EventMap>(event: K) =>
      snapshot.get(event) as EventPayload<K> | undefined,
    getValue: <K extends keyof GeneratedEventMap>(event: K) =>
      readPath(state, event) as PathValue<SchemaPayload, K> | undefined,
    subscribeEvent: (event: keyof EventMap, listener: () => void) =>
      subscribe(eventListeners, event, listener),
    subscribeValue: (event: keyof GeneratedEventMap, listener: () => void) =>
      subscribe(valueListeners, event, listener),
    subscribeStatus: (listener: () => void) => {
      statusListeners.add(listener);
      refCount += 1;
      reconcile();
      let subscribed = true;

      return () => {
        if (!subscribed) return;
        subscribed = false;
        statusListeners.delete(listener);
        refCount -= 1;
        reconcile();
      };
    },
    connect: () => {
      mode = "manual";
      reconcile();
    },
    disconnect: () => {
      mode = "paused";
      reconcile();
    },
    mount: () => {
      mounted = true;
      reconcile();
    },
    unmount: () => {
      mounted = false;
      reconcile();
    },
    clear: () => {
      const previous = state;
      state = undefined;
      snapshot.clear();
      notifyValues(previous);
      for (const listeners of eventListeners.values()) {
        listeners.forEach((listener) => listener());
      }
    },
  };
}

export type Store = ReturnType<typeof createStore>;
