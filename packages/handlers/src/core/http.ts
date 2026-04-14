/**
 * Shared HTTP error classification for all runtime adapters.
 * Keeps status codes and response bodies consistent across bun/node/hono.
 */

export interface HttpErrorResponse {
  status: number;
  body: {
    error: string;
  };
}

const CLIENT_ERROR_MARKERS = ["Invalid", "parse", "Empty"];

export function classifyHandlerError(error: Error): HttpErrorResponse {
  const isClientError = CLIENT_ERROR_MARKERS.some((m) => error.message.includes(m));
  const status = isClientError ? 400 : 500;

  const body = {
    error: process.env.NODE_ENV === "production" ? "Internal server error" : error.message,
  };

  return {
    status,
    body,
  };
}
