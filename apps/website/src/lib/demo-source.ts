import { GSI } from "@counter-strike-2-gsi/server";
import type { EventMap, EventPayload } from "@counter-strike-2-gsi/types";

import { DEMO_EVENTS } from "./demo-events.ts";
import { frame, TICK_MS } from "./demo-frame.ts";

/**
 * A canned match that plays entirely in the browser, for `?demo=1` — ported
 * from `demo-source.ts` on `feat/website-overlay-and-derive`.
 *
 * The seam is `EventSource` itself: `createSSEClient` does `new
 * EventSource(url)` then `addEventListener(event, …)` per event name, so
 * replacing the global with a class that emits the same `MessageEvent`s
 * exercises the real client, the real store and the real catalog
 * components. Nothing downstream knows it isn't connected to a server.
 *
 * Unlike the upstream version, this runs a real client-side `GSI` manager
 * (it's transport-agnostic — no Node-only imports — so it bundles fine for
 * the browser) and relays whatever it actually emits, `DEMO_EVENTS` in
 * hand. The upstream version only ever sent `"update"`, which is enough for
 * a `useGSIState()` reader but silent to `useGSIEvent`/`useGSIEvents` —
 * this repo's catalog components use both (see the granular-vs-full-state
 * split explained in `player-card-from-gsi.tsx`), so both need real events.
 */
class DemoEventSource {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  readyState = DemoEventSource.CONNECTING;
  url: string;
  withCredentials = false;

  onopen: ((e: Event) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;

  private listeners = new Map<string, Set<EventListener>>();
  private manager = new GSI();
  private managerUnsubs: Array<() => void> = [];
  private timer: ReturnType<typeof setInterval> | undefined;
  private tick = 0;

  constructor(url: string) {
    this.url = url;

    for (const event of DEMO_EVENTS) {
      this.managerUnsubs.push(this.manager.on(event, (payload) => this.relay(event, payload)));
    }

    // A frame on the next macrotask, not synchronously in the constructor:
    // `createSSEClient` attaches its listeners *after* `new EventSource(url)`
    // returns, so anything emitted here would land with nobody subscribed.
    setTimeout(() => {
      this.readyState = DemoEventSource.OPEN;
      this.onopen?.(new Event("open"));

      this.manager.update(frame(this.tick++));

      this.timer = setInterval(() => this.manager.update(frame(this.tick++)), TICK_MS);
    }, 0);
  }

  private relay<E extends keyof EventMap>(event: E, payload: EventPayload<E>) {
    const set = this.listeners.get(String(event));

    if (!set || set.size === 0) {
      return;
    }

    const message = new MessageEvent(String(event), { data: JSON.stringify(payload) });

    set.forEach((listener) => listener(message));
  }

  addEventListener(type: string, listener: EventListener) {
    let set = this.listeners.get(type);

    if (!set) {
      this.listeners.set(type, (set = new Set()));
    }

    set.add(listener);
  }

  removeEventListener(type: string, listener: EventListener) {
    this.listeners.get(type)?.delete(listener);
  }

  close() {
    this.readyState = DemoEventSource.CLOSED;

    clearInterval(this.timer);
    this.managerUnsubs.forEach((unsub) => unsub());
  }
}

/**
 * Swap the global before any `GSIProvider` is constructed. Scoped to
 * `?demo=1` in `main.tsx`, so a real connection never carries this code
 * path — though it does still carry the bytes, which is why this stays a
 * small generator rather than something heavier.
 *
 * Returns the undo, mirroring the upstream file — unused here today, kept
 * for the same reason it was kept there: leaving this installed silently
 * replaces `EventSource` for everything after it.
 */
export function installDemoSource(): () => void {
  const previous = Reflect.get(globalThis, "EventSource");

  Reflect.set(globalThis, "EventSource", DemoEventSource);

  return () => {
    Reflect.set(globalThis, "EventSource", previous);
  };
}
