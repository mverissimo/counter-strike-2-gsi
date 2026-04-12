import type { SchemaPayload } from "@counter-strike-2-gsi/types";

/**
 * Deep clone a payload for test isolation (prevents mutation between tests)
 */
export function clonePayload(payload: SchemaPayload): SchemaPayload {
  return JSON.parse(JSON.stringify(payload));
}

/**
 * Create a frozen deep clone (useful to catch accidental mutations)
 */
export function frozenPayload(payload: SchemaPayload): Readonly<SchemaPayload> {
  return Object.freeze(clonePayload(payload));
}

/**
 * Helper to count how many properties changed between two states
 */
export function countChanges(a: SchemaPayload, b: SchemaPayload): number {
  const diff = require("microdiff")(a, b, {
    cyclesFix: false,
  });

  return diff.length;
}
