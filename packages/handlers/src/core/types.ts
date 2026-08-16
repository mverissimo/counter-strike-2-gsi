import type { GSI } from "@counter-strike-2-gsi/server";
import type { EventMap } from "@counter-strike-2-gsi/types";

export interface GSIHandlerOptions<Req = unknown> {
  manager: GSI;

  token?: string;

  /**
   * Optional error handler. `req` is typed per-adapter.
   */
  onError?: (error: Error, req: Req) => void;

  gsiPath?: string;
}

export interface SSEOptions {
  manager: GSI;

  /**
   * Events to forward.
   * @default ["update"]
   */
  events?: Array<keyof EventMap>;

  /**
   * Send full state on connection.
   *
   * A reconnecting client sends `Last-Event-ID`, and replay runs first — so
   * with `true` it receives the replayed events *and then* a full `"update"`
   * carrying current state. That ordering is deliberate (state always wins,
   * the client never ends up behind), but it does mean the tail of the replay
   * is logically redundant, and a client that treats every `"update"` as a
   * discrete tick will double-count it.
   *
   * - `true` (default): always send state after replay.
   * - `false`: never send it; the client lives off the event stream.
   * - `"only-if-no-replay"`: send it only when nothing was replayed, i.e. for
   *   genuinely new connections. Use this when the client folds events into a
   *   timeline rather than overwriting a snapshot.
   *
   * @default true
   */
  sendInitialState?: boolean | "only-if-no-replay";

  /** @default 30_000 */
  heartbeatMs?: number;

  /** @default 50 */
  maxReplayEvents?: number;

  /** @default 60_000 */
  maxReplayAgeMs?: number;

  /**
   * Writes a single connection may have queued before new ones are dropped.
   *
   * Writes are serialized per connection, so a client that reads slower than
   * CS2 produces — a throttled mobile link, a paused browser tab, a stalled
   * proxy — turns that chain into an unbounded queue: at 64 Hz it grows by 64
   * retained payloads per second for as long as the socket stays open, and
   * nothing in the connection lifecycle ever shrinks it.
   *
   * Past this many pending writes, further writes for that connection are
   * dropped until its queue fully drains, and `onBackpressure` fires for each
   * one. Dropping is the right failure for this stream: every `"update"`
   * carries the complete state, so a client that skips ticks is behind by
   * milliseconds, not desynced — whereas the queue was costing memory to
   * deliver frames the client had already fallen past. Granular events do lose
   * information when dropped; raise the limit or subscribe to `"update"` if
   * that matters more than the ceiling.
   *
   * The default is ~4 seconds of 64 Hz traffic. Set `0` to disable the cap and
   * accept an unbounded queue.
   *
   * @default 256
   */
  maxPendingWrites?: number;

  /**
   * Maximum simultaneous SSE connections. Past it, `connect` rejects with
   * `SSEConnectionLimitError` and the adapter answers `503` instead of
   * accepting a connection it will fan every event out to.
   *
   * `0` (the default) means unlimited — the historical behavior. Set it to
   * something bounded on any endpoint reachable beyond localhost.
   *
   * @default 0
   */
  maxConnections?: number;

  /**
   * Called for every write dropped to `maxPendingWrites`, with the running
   * total for that connection. Use it for a metric; the core also logs once
   * per episode through `logger`.
   */
  onBackpressure?: (info: { clientId: string; pending: number; dropped: number }) => void;

  /** @default console.log */
  logger?: (message: string) => void;
}

export interface WSOptions {
  manager: GSI;

  /**
   * Events to forward.
   * @default ["update"]
   */
  events?: Array<keyof EventMap>;

  /**
   * Send full state on connection.
   * @default true
   */
  sendInitialState?: boolean;

  /**
   * Frames a single connection may have queued before new ones are dropped.
   * Same unbounded-chain problem and same trade-off as
   * {@link SSEOptions.maxPendingWrites}; `0` disables the cap.
   *
   * @default 256
   */
  maxPendingWrites?: number;

  /** Called for every frame dropped to `maxPendingWrites`. */
  onBackpressure?: (info: { clientId: string; pending: number; dropped: number }) => void;

  /** @default console.log */
  logger?: (message: string) => void;
}

export interface GSIServerOptions<Req = unknown> extends GSIHandlerOptions<Req> {
  ws?: Omit<WSOptions, "manager">;
  sse?: Omit<SSEOptions, "manager">;
  ssePath?: string;
  wsPath?: string;
}
