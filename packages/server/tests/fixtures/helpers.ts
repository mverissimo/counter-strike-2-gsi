import type { SchemaPayload } from "@counter-strike-2-gsi/types";

export function clonePayload(payload: SchemaPayload): SchemaPayload {
  return JSON.parse(JSON.stringify(payload));
}

/**
 * Shallow-frozen deep clone. `Object.freeze` only guards the root, so this
 * catches top-level writes into a fixture, not nested ones.
 */
export function frozenPayload(payload: SchemaPayload): Readonly<SchemaPayload> {
  return Object.freeze(clonePayload(payload));
}

export function countChanges(a: SchemaPayload, b: SchemaPayload): number {
  const diff = require("microdiff")(a, b, {
    cyclesFix: false,
  });

  return diff.length;
}
