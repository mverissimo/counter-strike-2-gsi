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

const CLIENT_ERROR_MARKERS = ["Invalid", "parse", "Empty", "validation", "too large"];

export function classifyHandlerError(error: Error): HttpErrorResponse {
  // JSON.parse / req.json() throw SyntaxError on malformed bodies across
  // Node, Bun, and the fetch runtimes — message wording varies per runtime,
  // so match the type rather than the text.
  const isClientError =
    error instanceof SyntaxError || CLIENT_ERROR_MARKERS.some((m) => error.message.includes(m));
  const status = isClientError ? 400 : 500;

  const body = {
    error: process.env.NODE_ENV === "production" ? "Internal server error" : error.message,
  };

  return {
    status,
    body,
  };
}

/**
 * Constant-time string comparison for auth tokens. Avoids leaking token
 * prefixes through response timing; implemented without node:crypto so it
 * works in Bun and edge runtimes too.
 */
export function safeTokenEqual(expected: string, received: unknown): boolean {
  if (typeof received !== "string") {
    return false;
  }

  let mismatch = expected.length === received.length ? 0 : 1;

  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ received.charCodeAt(i % (received.length || 1));
  }

  return mismatch === 0;
}
