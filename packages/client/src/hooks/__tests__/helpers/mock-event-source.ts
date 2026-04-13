/**
 * Minimal in-memory EventSource stub for vitest. Swap in via
 * `vi.stubGlobal("EventSource", MockEventSource)` inside `beforeEach`.
 *
 * Tracks every instance created so tests can drive listeners and readyState
 * transitions deterministically.
 */
export class MockEventSource {
  static instances: MockEventSource[] = [];

  static latest(): MockEventSource {
    const inst = this.instances.at(-1);

    if (!inst) {
      throw new Error("No EventSource instance created yet");
    }

    return inst;
  }

  static reset() {
    this.instances = [];
  }

  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  readyState = MockEventSource.CONNECTING;
  url: string;

  onopen: ((e: Event) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;

  private listeners = new Map<string, Set<EventListener>>();

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
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
    this.readyState = MockEventSource.CLOSED;
  }

  open() {
    this.readyState = MockEventSource.OPEN;
    this.onopen?.(new Event("open"));
  }

  /**
   * Fire a named event with a JSON-serialized payload. Omit `data` to fire
   * whatever raw string you pass via the second arg — useful for malformed
   * JSON parse tests.
   */
  emit(type: string, data: unknown, raw?: string) {
    const payload = raw ?? JSON.stringify(data);
    const event = new MessageEvent(type, {
      data: payload,
    });

    this.listeners.get(type)?.forEach((l) => l(event));
  }

  /**
   * Fire onerror. Caller sets readyState first to simulate connecting vs closed.
   */
  error(readyState: number = MockEventSource.CONNECTING) {
    this.readyState = readyState;

    this.onerror?.(new Event("error"));
  }

  listenerCount(type: string) {
    return this.listeners.get(type)?.size ?? 0;
  }
}
