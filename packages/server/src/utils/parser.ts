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
}

export function parsePayload(input: unknown, options: ParserPayloadOptions = {}): SchemaPayload {
  const { strictValidation = false } = options;

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

  const payloadForValidation = {
    ...(rawPayload as Record<string, unknown>),
  };
  const result = schema.payload(payloadForValidation);

  if (result instanceof ArkErrors) {
    if (strictValidation) {
      throw new Error(`GSI validation failed:\n${result.summary}`);
    } else {
      console.warn("[GSIManager] GSI payload validation warning:", result.summary);

      return stripAuth(rawPayload as SchemaPayload);
    }
  }

  return stripAuth(result);
}

// Auth is validated by the transport handler; the merged state is broadcast
// to every connected SSE/WS client, so we must never let the shared secret
// enter the manager's state.
function stripAuth(payload: SchemaPayload): SchemaPayload {
  if (!payload || !("auth" in payload)) {
    return payload;
  }

  const { auth: _auth, ...rest } = payload;

  return rest;
}
