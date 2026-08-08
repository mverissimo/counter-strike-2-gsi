/**
 * Minimal in-memory EventSource stub, mirroring the one in
 * `packages/client`. Swap in via `vi.stubGlobal("EventSource", ...)`.
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

  emit(type: string, data: unknown) {
    const event = new MessageEvent(type, {
      data: JSON.stringify(data),
    });

    this.listeners.get(type)?.forEach((l) => l(event));
  }
}
