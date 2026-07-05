import type { GSI } from "@counter-strike-2-gsi/server";

/**
 * Minimal stand-in for the GSI manager: just enough of `state`/`on` for
 * the SSE/WS cores, plus test-only `emit`/`listenerCount` introspection.
 */
export function createFakeManager(initialState: object = { round: { phase: "live" } }) {
  const listeners = new Map<string, Set<(payload: unknown) => void>>();

  const fake = {
    state: initialState,

    on(event: string, handler: (payload: unknown) => void) {
      let set = listeners.get(event);

      if (!set) {
        set = new Set();

        listeners.set(event, set);
      }

      set.add(handler);

      return () => {
        set.delete(handler);
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
    manager: fake as unknown as GSI,
  };
}

export const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
