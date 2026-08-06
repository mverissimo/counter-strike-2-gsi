import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";
import type {
  Delta,
  EventMap,
  EventPayload,
  GeneratedEventMap,
  PathValue,
  SchemaPayload,
} from "@counter-strike-2-gsi/types";

import { createSSEClient } from "./clients/sse";
import type { SSEError, SSEStatus } from "./clients/sse";
import { createWSClient } from "./clients/ws";
import type { WSError } from "./clients/ws";

export type GSIStatus = SSEStatus;
export type GSIError = SSEError | WSError;

const UNDEFINED_SERVER_SNAPSHOT = () => undefined;
const DISCONNECTED_SERVER_SNAPSHOT = () => "disconnected" as const;

function isWSUrl(url: string) {
  return url.startsWith("ws://") || url.startsWith("wss://");
}

interface Store {
  getStatus: () => GSIStatus;
  getEvent: <K extends keyof EventMap>(event: K) => EventPayload<K> | undefined;
  subscribeStatus: (listener: () => void) => () => void;
  subscribeEvent: <K extends keyof EventMap>(event: K, listener: () => void) => () => void;
  connect: () => void;
  disconnect: () => void;
  clear: () => void;
}

interface CreateStoreOptions {
  /**
   * URL of the GSI endpoint. `ws://`/`wss://` selects the WebSocket
   * transport; anything else uses SSE.
   */
  url: string;

  onError?: (error: GSIError) => void;
}

function createStore(props: CreateStoreOptions): Store {
  const { url, onError } = props;

  // Last known value per event. Deliberately *not* wiped on disconnect: a
  // HUD should keep showing the last frame through a reconnect blip rather
  // than blanking out and flashing back. Consumers that need the distinction
  // read it from `useGSIStatus`, and anything that must start from empty
  // (map change, demo switch) calls `clear()`.
  const snapshot: Partial<Record<keyof EventMap, unknown>> = {};
  let status: GSIStatus = "disconnected";

  const eventListeners = new Map<keyof EventMap, Set<() => void>>();
  const statusListeners = new Set<() => void>();
  const clientUnsubs = new Map<keyof EventMap, () => void>();

  const factory = isWSUrl(url) ? createWSClient : createSSEClient;

  const client = factory({
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

  function clear() {
    const events = Object.keys(snapshot) as Array<keyof EventMap>;

    for (const event of events) {
      delete snapshot[event];
    }

    // Notify every event that had a value — subscribers to events that were
    // never populated have nothing to re-read.
    for (const event of events) {
      eventListeners.get(event)?.forEach((l) => l());
    }
  }

  return {
    getStatus: () => status,
    getEvent: <K extends keyof EventMap>(event: K) =>
      snapshot[event] as EventPayload<K> | undefined,
    subscribeStatus,
    subscribeEvent,
    connect: client.connect,
    disconnect: client.disconnect,
    clear,
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
 * Subscribe to a single GSI event and derive a value from its `current`
 * snapshot. The component only re-renders when `isEqual` reports a change —
 * so you can subscribe to a high-frequency event (e.g. `"allplayers"`) and
 * still render only when a projection of it (e.g. the sorted steamid list)
 * actually moves.
 *
 * The selector is read through a ref, so it does not need to be memoized.
 * `isEqual` defaults to `Object.is`; pass a shallow/deep comparator when
 * selecting arrays or objects.
 */
export function useGSISelector<K extends keyof GeneratedEventMap, T>(
  event: K,
  selector: (value: GeneratedEventMap[K]["current"] | undefined) => T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): T {
  const store = useStore();

  const selectorRef = useRef(selector);
  const isEqualRef = useRef(isEqual);
  const cacheRef = useRef<{ value: T; hasValue: boolean }>({
    value: undefined as T,
    hasValue: false,
  });

  selectorRef.current = selector;
  isEqualRef.current = isEqual;

  const subscribe = useCallback(
    (listener: () => void) => store.subscribeEvent(event, listener),
    [store, event],
  );

  const getSnapshot = useCallback(() => {
    const delta = store.getEvent(event) as GeneratedEventMap[K] | undefined;
    const next = selectorRef.current(delta?.current);
    const cache = cacheRef.current;

    if (cache.hasValue && isEqualRef.current(cache.value, next)) {
      return cache.value;
    }

    cache.value = next;
    cache.hasValue = true;
    return next;
  }, [store, event]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Subscribe to a single GSI event and receive its full delta
 * (`{ previous?, current }`). Use this when you need to react to transitions
 * (e.g. a kill-feed, round phase changes).
 *
 * The return type is resolved from the schema via {@link PathValue}, so
 * template-literal keys like `` `allplayers:${string}:name` `` narrow to the
 * correct value type instead of widening to the full event-value union.
 */
export function useGSIDelta<K extends keyof GeneratedEventMap>(
  event: K,
): Delta<PathValue<SchemaPayload, K>> | undefined {
  const store = useStore();

  const subscribe = useCallback(
    (listener: () => void) => store.subscribeEvent(event, listener),
    [store, event],
  );

  const getSnapshot = useCallback(
    () => store.getEvent(event) as Delta<PathValue<SchemaPayload, K>> | undefined,
    [store, event],
  );

  return useSyncExternalStore(subscribe, getSnapshot, UNDEFINED_SERVER_SNAPSHOT);
}

/**
 * Subscribe to a single GSI event and receive just its `current` value.
 * The preferred hook for HUD-style displays.
 */
export function useGSIEvent<K extends keyof GeneratedEventMap>(
  event: K,
): PathValue<SchemaPayload, K> | undefined {
  return useGSIDelta(event)?.current;
}

/**
 * Subscribe to several GSI events at once and receive their `current` values
 * as one object keyed by event name.
 *
 * Saves a hook call per event when a component reads a handful of unrelated
 * paths. The returned object is referentially stable until one of the
 * subscribed events actually fires, so it is safe as a `useMemo`/`useEffect`
 * dependency.
 *
 * `events` is compared by content, not identity — pass an inline array
 * literal freely; only changing the *set* of events rebuilds the
 * subscription.
 *
 * @example
 * ```tsx
 * const { "player:state:health": health, "round:phase": phase } =
 *   useGSIEvents(["player:state:health", "round:phase"]);
 * ```
 */
export function useGSIEvents<K extends keyof GeneratedEventMap>(
  events: readonly K[],
): { [P in K]: PathValue<SchemaPayload, P> | undefined } {
  type Result = { [P in K]: PathValue<SchemaPayload, P> | undefined };

  const store = useStore();

  // The array literal is a fresh reference every render; its contents are
  // what decide whether anything has to be rebuilt.
  const key = events.join(" ");
  const eventsRef = useRef(events);

  eventsRef.current = events;

  const cacheRef = useRef<{
    deltas: Array<unknown>;
    value: Result;
  } | null>(null);

  const subscribe = useCallback(
    (listener: () => void) => {
      const unsubs = eventsRef.current.map((event) => store.subscribeEvent(event, listener));

      return () => unsubs.forEach((unsub) => unsub());
    },
    [store, key],
  );

  const getSnapshot = useCallback(() => {
    const list = eventsRef.current;
    const deltas = list.map((event) => store.getEvent(event));
    const cache = cacheRef.current;

    if (cache && cache.deltas.length === deltas.length) {
      const unchanged = deltas.every((delta, i) => delta === cache.deltas[i]);

      if (unchanged) {
        return cache.value;
      }
    }

    const value = {} as Result;

    list.forEach((event, i) => {
      value[event] = (deltas[i] as Delta<PathValue<SchemaPayload, K>> | undefined)?.current;
    });

    cacheRef.current = {
      deltas,
      value,
    };

    return value;
  }, [store, key]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * The last full `"update"` payload — the whole merged state as the server
 * sees it.
 *
 * Re-renders on every GSI tick (64 Hz with a live game), so reach for
 * {@link useGSIEvent} or {@link useGSISelector} for anything that renders
 * often. This is for the cases that genuinely need the whole tree: debug
 * overlays, state dumps, custom derivations that span blocks.
 */
export function useGSIState(): SchemaPayload | undefined {
  const store = useStore();

  const subscribe = useCallback(
    (listener: () => void) => store.subscribeEvent("update", listener),
    [store],
  );

  const getSnapshot = useCallback(
    () => store.getEvent("update") as SchemaPayload | undefined,
    [store],
  );

  return useSyncExternalStore(subscribe, getSnapshot, UNDEFINED_SERVER_SNAPSHOT);
}

/**
 * Subscribe to connection status. Decoupled from event state — changes here
 * do not re-render components that only consume events.
 */
export function useGSIStatus() {
  const store = useStore();

  return useSyncExternalStore(store.subscribeStatus, store.getStatus, DISCONNECTED_SERVER_SNAPSHOT);
}

/**
 * Escape hatch for manual lifecycle control. Normally the connection is
 * ref-counted against live subscribers; use this if you want to keep it open
 * between subscriptions or force-close it.
 *
 * `clear()` drops every cached event value and re-renders the subscribers
 * that had one. Disconnecting on its own keeps the last known values (so the
 * UI holds its last frame through a reconnect) — call `clear()` when the
 * retained state would be misleading rather than merely stale, e.g. after
 * switching servers or ending a match.
 */
export function useGSIClient() {
  const store = useStore();

  return useMemo(
    () => ({
      connect: store.connect,
      disconnect: store.disconnect,
      clear: store.clear,
    }),
    [store],
  );
}
