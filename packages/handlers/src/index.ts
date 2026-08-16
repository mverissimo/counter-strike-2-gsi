/**
 * Root entry: runtime-free shared core only.
 *
 * Runtime adapters live behind subpath exports so consumers only pull in
 * the dependencies of their host runtime:
 *
 * - `@counter-strike-2-gsi/handlers/node` (depends on `ws`)
 * - `@counter-strike-2-gsi/handlers/bun`
 * - `@counter-strike-2-gsi/handlers/hono` (requires the optional `hono` peer)
 */
export type { GSIHandlerOptions, GSIServerOptions, SSEOptions, WSOptions } from "./core/types";
export type {
  SSEWriter,
  SSESession,
  SSEWriteErrorHandler,
  SSEConnectionReservation,
  SSECore,
} from "./core/sse";
export { SSEConnectionLimitError } from "./core/sse";
export type { WSWriter, WSSession, WSWriteErrorHandler, WSFrame, WSCore } from "./core/ws";
export { classifyHandlerError, safeTokenEqual } from "./core/http";
export type { HttpErrorResponse } from "./core/http";
