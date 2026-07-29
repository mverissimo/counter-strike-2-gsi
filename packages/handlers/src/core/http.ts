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

  // An empty `received` has no character to compare against: `i % 0` is NaN,
  // `charCodeAt(NaN)` is NaN, and `^` then coerces it to 0 — the right answer
  // by accident. Substitute the 0 explicitly instead; the length mismatch
  // above already forces a false result. The loop still runs `expected.length`
  // times either way, so the comparison stays constant-time.
  const wrap = received.length;

  for (let i = 0; i < expected.length; i++) {
    const code = wrap === 0 ? 0 : received.charCodeAt(i % wrap);

    mismatch |= expected.charCodeAt(i) ^ code;
  }

  return mismatch === 0;
}
