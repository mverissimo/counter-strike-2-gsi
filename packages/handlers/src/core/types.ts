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

  /** @default console.log */
  logger?: (message: string) => void;
}

export interface GSIServerOptions<Req = unknown> extends GSIHandlerOptions<Req> {
  ws?: Omit<WSOptions, "manager">;
  sse?: Omit<SSEOptions, "manager">;
  ssePath?: string;
  wsPath?: string;
}
