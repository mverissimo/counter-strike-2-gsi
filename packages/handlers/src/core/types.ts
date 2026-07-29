import type { GSI } from "@counter-strike-2-gsi/server";
import type { EventMap } from "@counter-strike-2-gsi/types";

export interface GSIHandlerOptions<Req = unknown> {
  /**
   * The GSI manager instance
   */
  manager: GSI;

  /**
   * Optional auth token
   */
  token?: string;

  /**
   * Optional error handler. `req` is typed per-adapter.
   */
  onError?: (error: Error, req: Req) => void;

  /**
   * Optional custom path for the GSI POST endpoint
   */
  gsiPath?: string;
}

export interface SSEOptions {
  /**
   * The GSI manager instance
   */
  manager: GSI;

  /**
   * Events to forward. Defaults to ["update"]
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

  /**
   * Heartbeat interval (ms)
   */
  heartbeatMs?: number;

  /**
   * Max events in replay buffer
   */
  maxReplayEvents?: number;

  /**
   * Max age of replayable events (ms)
   */
  maxReplayAgeMs?: number;

  /**
   * Optional logger (defaults to console.log)
   */
  logger?: (message: string) => void;
}

export interface WSOptions {
  /**
   * The GSI manager instance
   */
  manager: GSI;

  /**
   * Events to forward. Defaults to ["update"]
   */
  events?: Array<keyof EventMap>;

  /**
   * Send full state on connection
   */
  sendInitialState?: boolean;

  /**
   * Optional logger (defaults to console.log)
   */
  logger?: (message: string) => void;
}

export interface GSIServerOptions<Req = unknown> extends GSIHandlerOptions<Req> {
  /**
   * WS-specific options
   */
  ws?: Omit<WSOptions, "manager">;

  /**
   * SSE-specific options
   */
  sse?: Omit<SSEOptions, "manager">;

  /**
   * Custom path for SSE endpoint.
   */
  ssePath?: string;

  /**
   * Custom path for WS endpoint.
   */
  wsPath?: string;
}
