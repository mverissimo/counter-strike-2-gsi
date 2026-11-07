import { GSIPayloadError } from "@counter-strike-2-gsi/server";
import type { GSIHandlerOptions } from "./types";

const DEFAULT_MAX_BODY_BYTES = 1024 * 1024;

class IngressError extends Error {
  constructor(
    readonly status: 400 | 413,
    message: string,
  ) {
    super(message);
  }
}

interface IngressResponse {
  status: 200 | 401 | 405;
  body: { message: string } | { error: string };
}

export function createIngress(
  options: Pick<GSIHandlerOptions, "manager" | "token" | "maxBodyBytes">,
) {
  const { manager, token, maxBodyBytes = DEFAULT_MAX_BODY_BYTES } = options;

  if (!Number.isSafeInteger(maxBodyBytes) || maxBodyBytes < 1) {
    throw new RangeError("maxBodyBytes must be a positive safe integer");
  }

  return async (
    method: string | undefined,
    body: AsyncIterable<Uint8Array>,
  ): Promise<IngressResponse> => {
    if (method !== "POST") {
      return { status: 405, body: { error: "Method Not Allowed" } };
    }

    const chunks: Uint8Array[] = [];
    let size = 0;

    for await (const chunk of body) {
      size += chunk.byteLength;
      if (size > maxBodyBytes) {
        throw new IngressError(413, "Payload too large");
      }
      chunks.push(chunk);
    }

    if (size === 0) {
      throw new IngressError(400, "GSI: Empty payload");
    }

    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const payload: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new IngressError(400, "GSI: Invalid or empty payload");
    }

    const auth = (payload as Record<string, unknown>).auth;
    const receivedToken =
      auth !== null && typeof auth === "object"
        ? (auth as Record<string, unknown>).token
        : undefined;

    if (token !== undefined && !safeTokenEqual(token, receivedToken)) {
      return { status: 401, body: { error: "Invalid auth token" } };
    }

    manager.update(payload);
    return { status: 200, body: { message: "OK" } };
  };
}

export async function* readRequestBody(request: Request): AsyncGenerator<Uint8Array> {
  if (!request.body) return;
  const reader = request.body.getReader();
  let completed = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        completed = true;
        return;
      }
      yield value;
    }
  } finally {
    try {
      if (!completed) await reader.cancel().catch(() => {});
    } finally {
      reader.releaseLock();
    }
  }
}

export interface HttpErrorResponse {
  status: number;
  body: {
    error: string;
  };
}

export function classifyHandlerError(error: Error): HttpErrorResponse {
  const status =
    error instanceof IngressError
      ? error.status
      : error instanceof SyntaxError || error instanceof GSIPayloadError
        ? 400
        : 500;

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
