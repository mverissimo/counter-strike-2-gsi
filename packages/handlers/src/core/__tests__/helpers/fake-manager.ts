import type { EventMap, EventPayload, SchemaPayload } from "@counter-strike-2-gsi/types";

/**
 * Minimal stand-in for the GSI manager: just enough of `state`/`on` for
 * the SSE/WS cores, plus test-only `emit`/`listenerCount` introspection.
 */
export function createFakeManager(initialState: SchemaPayload = { round: { phase: "live" } }) {
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  const updates: unknown[] = [];

  const fake = {
    state: initialState,

    update(payload: unknown) {
      updates.push(payload);
    },

    on<E extends keyof EventMap>(event: E, handler: (payload: EventPayload<E>) => void) {
      let set = listeners.get(event);

      if (!set) {
        set = new Set();

        listeners.set(event, set);
      }

      const listener = (payload: unknown) => handler(payload as EventPayload<E>);
      set.add(listener);

      return () => {
        set.delete(listener);
      };
    },

    emit(event: string, payload: unknown) {
      listeners.get(event)?.forEach((handler) => handler(payload));
    },

    listenerCount(event: string) {
      return listeners.get(event)?.size ?? 0;
    },
  };

  return {
    fake,
    manager: fake,
    updates,
  };
}

export const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
