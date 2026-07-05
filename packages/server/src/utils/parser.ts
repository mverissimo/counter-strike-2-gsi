import { schema } from "@counter-strike-2-gsi/types";
import type { SchemaPayload } from "@counter-strike-2-gsi/types";

import { ArkErrors } from "arktype";

interface ParserPayloadOptions {
  /**
   * When true, validation failures throw immediately.
   * When false (default), invalid payloads log a warning and return the original data.
   * @default false
   */
  strictValidation?: boolean;

  /**
   * When false, skips schema validation entirely — the payload is only
   * JSON-parsed and sanitized. `strictValidation` has no effect.
   * @default true
   */
  validatePayload?: boolean;
}

export function parsePayload(input: unknown, options: ParserPayloadOptions = {}): SchemaPayload {
  const { strictValidation = false, validatePayload = true } = options;

  let rawPayload: unknown;

  if (typeof input === "string") {
    try {
      rawPayload = JSON.parse(input);
    } catch (err) {
      throw new Error(`GSI parser: Invalid JSON payload\n${(err as Error).message}`);
    }
  } else if (typeof input === "object" && input !== null) {
    rawPayload = input;
  } else {
    throw new Error(
      `GSI parser: Input must be a string (JSON) or a non-null object. Received: ${typeof input}`,
    );
  }

  if (typeof rawPayload !== "object" || rawPayload === null || Array.isArray(rawPayload)) {
    throw new Error("GSI parser: Payload must be a non-null object after parsing");
  }

  if (!validatePayload) {
    return sanitizePayload(rawPayload as SchemaPayload);
  }

  const payloadForValidation = {
    ...(rawPayload as Record<string, unknown>),
  };
  const result = schema.payload(payloadForValidation);

  if (result instanceof ArkErrors) {
    if (strictValidation) {
      throw new Error(`GSI validation failed:\n${result.summary}`);
    } else {
      console.warn("[GSIManager] GSI payload validation warning:", result.summary);

      return sanitizePayload(rawPayload as SchemaPayload);
    }
  }

  return sanitizePayload(result);
}

// `auth` is validated by the transport handler; the merged state is broadcast
// to every connected SSE/WS client, so we must never let the shared secret
// enter the manager's state.
//
// `previously`/`added` are CS2's own change-bookkeeping blocks. arktype's
// default undeclared-key policy preserves them, so without stripping they
// would merge into state and produce bogus "previously:*" granular events.
const STRIPPED_KEYS = ["auth", "previously", "added"] as const;

function sanitizePayload(payload: SchemaPayload): SchemaPayload {
  if (!payload || !STRIPPED_KEYS.some((key) => key in payload)) {
    return payload;
  }

  const rest = { ...payload } as Record<string, unknown>;

  for (const key of STRIPPED_KEYS) {
    delete rest[key];
  }

  return rest as SchemaPayload;
}
