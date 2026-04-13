/**
 * Minimal in-memory WebSocket stub for vitest. Swap in via
 * `vi.stubGlobal("WebSocket", MockWebSocket)` inside `beforeEach`.
 *
 * Tracks every instance created so tests can drive the `on*` props and
 * readyState transitions deterministically.
 */
export class MockWebSocket {
  static instances: MockWebSocket[] = [];

  static latest(): MockWebSocket {
    const inst = this.instances.at(-1);

    if (!inst) {
      throw new Error("No WebSocket instance created yet");
    }

    return inst;
  }

  static reset() {
    this.instances = [];
  }

  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;

  onopen: ((e: Event) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  onclose: ((e: Event) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;

  constructor(url: string) {
    this.url = url;

    MockWebSocket.instances.push(this);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
  }

  open() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.(new Event("open"));
  }

  /**
   * Simulate a server-initiated close (fires onclose). Client-initiated
   * `close()` only updates readyState to match the real WebSocket contract
   * where the client nulls out its onclose before closing.
   */
  serverClose() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new Event("close"));
  }

  /**
   * Fire onerror. Readyness is unchanged — real WebSocket errors do not
   * transition state on their own.
   */
  error() {
    this.onerror?.(new Event("error"));
  }

  /**
   * Fire an onmessage with a `{event, data}` frame JSON-serialized.
   */
  emit(event: string, data: unknown) {
    this.onmessage?.(
      new MessageEvent("message", {
        data: JSON.stringify({ event, data }),
      }),
    );
  }

  /**
   * Fire an onmessage with a raw string payload. Useful for parse-error tests.
   */
  emitRaw(raw: string) {
    this.onmessage?.(new MessageEvent("message", { data: raw }));
  }
}
