import { schema } from "@counter-strike-2-gsi/types";
import type { SchemaPayload } from "@counter-strike-2-gsi/types";

import { ArkErrors } from "arktype";

import type { GSILogger } from "../lib/logger";

export interface ValidationIssue {
  /** arktype's human-readable error summary. */
  summary: string;
  /** Top-level blocks that failed validation and were dropped. */
  dropped: string[];
  /**
   * `true` when the payload *root* failed validation. Nothing is salvageable
   * then, so `dropped` lists every block the payload carried and state is
   * left completely untouched.
   */
  discarded: boolean;
}

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

  /**
   * Sink for the non-strict validation warning.
   * @default console
   */
  logger?: Pick<GSILogger, "warn">;

  /**
   * Called when non-strict validation salvages a payload, with the summary
   * and the exact blocks that were dropped. Never called in strict mode
   * (which throws) or when validation is disabled.
   */
  onValidationIssue?: (issue: ValidationIssue) => void;
}

export function parsePayload(input: unknown, options: ParserPayloadOptions = {}): SchemaPayload {
  const { strictValidation = false, validatePayload = true, logger = console } = options;

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

    logger.warn("[GSI] payload validation warning:", result.summary);

    const { kept, dropped, discarded } = dropInvalidBlocks(rawPayload as SchemaPayload, result);

    options.onValidationIssue?.({
      summary: result.summary,
      dropped,
      discarded,
    });

    return sanitizePayload(kept);
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
function dropInvalidBlocks(
  payload: SchemaPayload,
  errors: ArkErrors,
): { kept: SchemaPayload; dropped: string[]; discarded: boolean } {
  const invalid = new Set<string>();

  for (const error of errors) {
    const block = error.path[0];

    if (block === undefined) {
      return {
        kept: {},
        dropped: Object.keys(payload),
        discarded: true,
      };
    }

    invalid.add(String(block));
  }

  const kept: Record<string, unknown> = {};

  for (const key in payload) {
    if (!invalid.has(key)) {
      kept[key] = (payload as Record<string, unknown>)[key];
    }
  }

  return {
    kept: kept as SchemaPayload,
    dropped: [...invalid],
    discarded: false,
  };
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
  let result = payload;

  if (result && STRIPPED_KEYS.some((key) => key in result)) {
    const rest = { ...result } as Record<string, unknown>;

    for (const key of STRIPPED_KEYS) {
      delete rest[key];
    }

    result = rest as SchemaPayload;
  }

  // `allplayers.custom` is more CS2 roster bookkeeping, and letting it into
  // state breaks the event contract twice over: derived roster events iterate
  // `allplayers` keys as SteamIDs (a literal "custom" player would join), and
  // a granular diff through it would emit names (`allplayers:custom:joined`,
  // array indices like `...:left:0`) that `LeafPaths` deliberately flattens
  // out of the type system. The manager computes `allplayers:joined`/`left`
  // from the roster itself, so nothing is lost.
  const allplayers = result?.allplayers;

  if (
    allplayers !== null &&
    typeof allplayers === "object" &&
    !Array.isArray(allplayers) &&
    "custom" in allplayers
  ) {
    const rest = { ...allplayers } as Record<string, unknown>;

    delete rest.custom;

    result = {
      ...result,
      allplayers: rest,
    } as SchemaPayload;
  }

  return result;
}
