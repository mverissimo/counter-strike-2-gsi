type EventMap = Record<string, any>;
type Listener<T> = (payload: T) => void;

export interface Emitter<Events extends EventMap = EventMap> {
  on<K extends keyof Events>(type: K, handler: Listener<Events[K]>): () => void;
  off<K extends keyof Events>(type: K, handler?: Listener<Events[K]>): void;
  once<K extends keyof Events>(type: K, handler: Listener<Events[K]>): () => void;
  emit<K extends keyof Events>(type: K, payload: Events[K]): void;
  /** Event names that currently have at least one listener. */
  eventNames(): Array<keyof Events>;
  /** Number of listeners registered for `type`. */
  listenerCount<K extends keyof Events>(type: K): number;
}

export function createEmitter<Events extends EventMap>() {
  const handlers = new Map<keyof Events, Array<Listener<any>>>();

  return {
    on<K extends keyof Events>(type: K, handler: Listener<Events[K]>) {
      let set = handlers.get(type);

      if (!set) {
        set = [];

        handlers.set(type, set);
      }

      set.push(handler);

      return () => this.off(type, handler);
    },
    off<K extends keyof Events>(type: K, handler?: Listener<Events[K]>) {
      const set = handlers.get(type);

      if (!set) {
        return;
      }

      if (handler) {
        const index = set.indexOf(handler);

        if (index !== -1) {
          set.splice(index, 1);
        }
      } else {
        handlers.delete(type);
      }
    },
    once<K extends keyof Events>(type: K, handler: Listener<Events[K]>) {
      const unsub: Listener<Events[K]> = (payload) => {
        this.off(type, unsub);

        handler(payload);
      };

      return this.on(type, unsub);
    },
    eventNames() {
      const names: Array<keyof Events> = [];

      for (const [type, set] of handlers) {
        if (set.length > 0) {
          names.push(type);
        }
      }

      return names;
    },
    listenerCount<K extends keyof Events>(type: K) {
      return handlers.get(type)?.length ?? 0;
    },
    emit<K extends keyof Events>(type: K, payload: Events[K]) {
      const set = handlers.get(type);

      if (!set) {
        return;
      }

      const snapshot = [...set];

      for (const handler of snapshot) {
        try {
          handler(payload);
        } catch (err) {
          console.error(`[emitter] listener for "${String(type)}" threw:`, err);
        }
      }
    },
  };
}
