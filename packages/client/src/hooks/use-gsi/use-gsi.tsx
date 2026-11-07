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
  GeneratedEventMap,
  PathValue,
  SchemaPayload,
} from "@counter-strike-2-gsi/types";

import type { SSEError, SSEStatus } from "./clients/sse";
import type { WSError } from "./clients/ws";
import { createStore, type CreateStoreOptions, type Store } from "./store";

export type GSIStatus = SSEStatus;
export type GSIError = SSEError | WSError;

const UNDEFINED_SERVER_SNAPSHOT = () => undefined;
const DISCONNECTED_SERVER_SNAPSHOT = () => "disconnected" as const;

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
    store.mount();
    return () => store.unmount();
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
    (listener: () => void) => store.subscribeValue(event, listener),
    [store, event],
  );

  const getSnapshot = useCallback(() => {
    const next = selectorRef.current(
      store.getValue(event) as GeneratedEventMap[K]["current"] | undefined,
    );
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
  const store = useStore();
  const subscribe = useCallback(
    (listener: () => void) => store.subscribeValue(event, listener),
    [store, event],
  );
  const getSnapshot = useCallback(() => store.getValue(event), [store, event]);

  return useSyncExternalStore(subscribe, getSnapshot, UNDEFINED_SERVER_SNAPSHOT);
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
  const key = events.join("\0");
  const eventsRef = useRef(events);

  eventsRef.current = events;

  const cacheRef = useRef<{
    key: string;
    values: Array<unknown>;
    value: Result;
  } | null>(null);

  const subscribe = useCallback(
    (listener: () => void) => {
      const unsubs = eventsRef.current.map((event) => store.subscribeValue(event, listener));

      return () => unsubs.forEach((unsub) => unsub());
    },
    [store, key],
  );

  const getSnapshot = useCallback(() => {
    const list = eventsRef.current;
    const values = list.map((event) => store.getValue(event));
    const cache = cacheRef.current;

    if (cache && cache.key === key && cache.values.length === values.length) {
      const unchanged = values.every((value, index) => Object.is(value, cache.values[index]));

      if (unchanged) {
        return cache.value;
      }
    }

    const value = {} as Result;

    list.forEach((event, i) => {
      value[event] = values[i] as PathValue<SchemaPayload, K> | undefined;
    });

    cacheRef.current = {
      key,
      values,
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
