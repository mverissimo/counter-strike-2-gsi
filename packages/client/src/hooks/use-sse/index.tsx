import { createContext, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import type { EventMap, EventPayload, GeneratedEventMap } from "@counter-strike-2-gsi/types";

import { createSSEClient } from "./client";
import type { SSEError, SSEStatus } from "./client";

interface Store {
  /**
   * Snapshot getter for the current connection status,
   * used by `useSyncExternalStore`.
   */
  getStatus: () => SSEStatus;

  /**
   * Snapshot getter for the latest payload of a given event,
   * or `undefined` if none has arrived yet.
   */
  getEvent: <K extends keyof EventMap>(event: K) => EventPayload<K> | undefined;

  /**
   * Register a listener for connection status changes;
   * returns an unsubscribe function. Acquires a ref-count slot.
   */
  subscribeStatus: (listener: () => void) => () => void;

  /**
   * Register a listener for a specific event;
   * returns an unsubscribe function. Opens the underlying SSE subscription on first listener and closes it on last.
   */
  subscribeEvent: <K extends keyof EventMap>(event: K, listener: () => void) => () => void;

  /**
   * Force-open the SSE connection, bypassing ref-counting.
   * Escape hatch for manual lifecycle control.
   */
  connect: () => void;

  /**
   * Force-close the SSE connection, bypassing ref-counting.
   * Escape hatch for manual lifecycle control.
   */
  disconnect: () => void;
}

interface CreateStoreOptions {
  /**
   * URL of the SSE endpoint exposed by a GSI handler.
   */
  url: string;

  /**
   * Optional callback invoked when the underlying SSE client surfaces an error.
   */
  onError?: (error: SSEError) => void;
}

function createStore(props: CreateStoreOptions) {
  const { url, onError } = props;

  const snapshot: Partial<Record<keyof EventMap, unknown>> = {};
  let status: SSEStatus = "disconnected";

  const eventListeners = new Map<keyof EventMap, Set<() => void>>();
  const statusListeners = new Set<() => void>();
  const clientUnsubs = new Map<keyof EventMap, () => void>();

  const client = createSSEClient({
    url,
    onError,
    onStatusChange(next) {
      if (next === status) {
        return;
      }

      status = next;

      statusListeners.forEach((l) => l());
    },
  });

  let refCount = 0;

  const increase = () => {
    if (refCount++ === 0) {
      client.connect();
    }
  };

  const decrease = () => {
    if (--refCount === 0) {
      client.disconnect();
    }
  };

  function subscribeEvent<K extends keyof EventMap>(event: K, listener: () => void) {
    let set = eventListeners.get(event);

    if (!set) {
      set = new Set();

      eventListeners.set(event, set);

      const unsub = client.subscribe(event, (data) => {
        snapshot[event] = data;
        eventListeners.get(event)?.forEach((l) => l());
      });

      clientUnsubs.set(event, unsub);
    }

    set.add(listener);

    increase();

    return () => {
      set!.delete(listener);

      if (set!.size === 0) {
        eventListeners.delete(event);
        clientUnsubs.get(event)?.();
        clientUnsubs.delete(event);
      }

      decrease();
    };
  }

  function subscribeStatus(listener: () => void) {
    statusListeners.add(listener);

    increase();

    return () => {
      statusListeners.delete(listener);

      decrease();
    };
  }

  return {
    getStatus: () => status,
    getEvent: <K extends keyof EventMap>(event: K) =>
      snapshot[event] as EventPayload<K> | undefined,
    subscribeStatus,
    subscribeEvent,
    connect: client.connect,
    disconnect: client.disconnect,
  };
}

const GSIContext = createContext<Store | null>(null);

export interface GSIProviderProps extends CreateStoreOptions {
  children: ReactNode;
}

export function GSIProvider(props: GSIProviderProps) {
  const { url, children, onError } = props;

  const onErrorRef = useRef(onError);

  onErrorRef.current = onError;

  const store = useMemo(
    () =>
      createStore({
        url,
        onError: (err) => onErrorRef.current?.(err),
      }),
    [url],
  );

  useEffect(() => {
    return () => store.disconnect();
  }, [store]);

  return <GSIContext.Provider value={store}>{children}</GSIContext.Provider>;
}

function useStore() {
  const store = useContext(GSIContext);

  if (!store) {
    throw new Error("GSI hooks must be used inside <GSIProvider>");
  }

  return store;
}

/**
 * Subscribe to a single GSI event and receive its full delta
 * (`{ previous?, current }`). Use this when you need to react to transitions
 * (e.g. a kill-feed, round phase changes).
 */
export function useGSIDelta<K extends keyof GeneratedEventMap>(event: K) {
  const store = useStore();

  return useSyncExternalStore(
    (l) => store.subscribeEvent(event, l),
    () => store.getEvent(event) as GeneratedEventMap[K] | undefined,
    () => undefined,
  );
}

/**
 * Subscribe to a single GSI event and receive just its `current` value.
 * The preferred hook for HUD-style displays.
 */
export function useGSIEvent<K extends keyof GeneratedEventMap>(event: K) {
  return useGSIDelta(event)?.current;
}

/**
 * Subscribe to connection status. Decoupled from event state — changes here
 * do not re-render components that only consume events.
 */
export function useGSIStatus() {
  const store = useStore();

  return useSyncExternalStore(
    store.subscribeStatus,
    store.getStatus,
    () => "disconnected" as const,
  );
}

/**
 * Escape hatch for manual lifecycle control. Normally the connection is
 * ref-counted against live subscribers; use this if you want to keep it open
 * between subscriptions or force-close it.
 */
export function useGSIClient() {
  const store = useStore();

  return {
    connect: store.connect,
    disconnect: store.disconnect,
  };
}
