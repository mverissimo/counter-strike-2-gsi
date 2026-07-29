import { schema } from "@counter-strike-2-gsi/types";
import type { SchemaPayload } from "@counter-strike-2-gsi/types";

import { ArkErrors } from "arktype";

interface ParserPayloadOptions {
  /**
   * When true, validation failures throw immediately.
   * When false (default), validation failures log a warning and the payload
   * is salvaged block by block — see {@link dropInvalidBlocks}.
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

  if (isArkErrors(result)) {
    if (strictValidation) {
      throw new Error(`GSI validation failed:\n${result.summary}`);
    }

    console.warn("[GSIManager] GSI payload validation warning:", result.summary);

    return sanitizePayload(dropInvalidBlocks(rawPayload as SchemaPayload, result));
  }

  return sanitizePayload(result);
}

/**
 * `ArkErrors` is an `Array` subclass carrying a `summary` string.
 *
 * `instanceof` alone is not enough: when a bundle ends up with two copies of
 * arktype — the schema comes from `@counter-strike-2-gsi/types`, the class
 * from this package's own dependency — the prototype chains differ and the
 * check silently reports "valid". The error array then flows on as if it were
 * a payload, and its internal back-references make the merged state cyclic,
 * which blows microdiff's stack on the next granular update. Shape-checking
 * on top of `instanceof` keeps the guard identity-independent.
 */
function isArkErrors(value: unknown): value is ArkErrors {
  return (
    value instanceof ArkErrors ||
    (Array.isArray(value) && typeof (value as { summary?: unknown }).summary === "string")
  );
}

/**
 * Non-strict fallback: keep the blocks that validated, drop the ones that
 * didn't.
 *
 * Merging the whole unvalidated payload was the old behaviour, and it means a
 * single malformed field writes the entire raw object into state — including
 * shapes the schema exists to keep out. Since `payload` is a flat map of
 * independent top-level blocks and every arktype error reports a full path
 * (`["player", "state", "armor"]`), the first segment names exactly which
 * block to discard: a malformed `player` no longer costs a perfectly good
 * `map`.
 *
 * An error with an empty path condemns the payload root itself. There is
 * nothing to salvage there, so the update is dropped whole — an empty payload
 * merges as a no-op, leaving state untouched.
 */
function dropInvalidBlocks(payload: SchemaPayload, errors: ArkErrors): SchemaPayload {
  const invalid = new Set<string>();

  for (const error of errors) {
    const block = error.path[0];

    if (block === undefined) {
      return {};
    }

    invalid.add(String(block));
  }

  const kept: Record<string, unknown> = {};

  for (const key in payload) {
    if (!invalid.has(key)) {
      kept[key] = (payload as Record<string, unknown>)[key];
    }
  }

  return kept as SchemaPayload;
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
