import type { GSI } from "@counter-strike-2-gsi/server";
import type { EventMap } from "@counter-strike-2-gsi/types";

export interface GSIHandlerOptions {
  /**
   * The GSI manager instance
   */
  manager: GSI;

  /**
   * Optional auth token
   */
  token?: string;

  /**
   * Optional error handler
   */
  onError?: (error: Error, req: any) => void;

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
   * Send full state on connection
   */
  sendInitialState?: boolean;

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

export interface GSIServerOptions extends GSIHandlerOptions {
  /**
   * Enable SSE endpoint
   */
  enableSSE?: boolean;

  /**
   * SSE-specific options
   */
  sse?: Omit<SSEOptions, "manager">;

  /**
   * Custom path for SSE endpoint
   */
  ssePath?: string;
}
