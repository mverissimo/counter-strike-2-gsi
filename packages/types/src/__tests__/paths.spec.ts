import { describe, it, expect } from "vitest";

import { schema } from "../schema";
import type { SchemaPayload } from "../schema";
import { MAX_PATH_DEPTH } from "../utils";
import type { GeneratedEventMap, PathValue } from "../types";

/**
 * Compile-time assertion helper: `Assert<false>` is a type error.
 */
type Assert<T extends true> = T;

type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

type Extends<A, B> = [A] extends [B] ? true : false;

type Has<K extends string> = [Extract<keyof GeneratedEventMap, K>] extends [never] ? false : true;

/**
 * Type-level assertions, collected into a tuple so the compiler has to check
 * them (and so `vp lint` reports the failure) rather than treating them as
 * dead declarations.
 */
const typeAssertions: [
  // The deepest real event family the schema declares, at exactly
  // MAX_PATH_DEPTH segments. If this stops resolving, `LeafPaths` has begun
  // truncating paths that consumers are subscribing to.
  Assert<Has<`allplayers:${string}:weapons:${string}:name`>>,
  // Truncation shows up in PathValue as `unknown`, so pinning the leaf to its
  // real type is what makes the depth failure loud.
  Assert<
    Extends<
      PathValue<SchemaPayload, `allplayers:${string}:weapons:${string}:ammo_clip`>,
      number | undefined
    >
  >,
  // A shallower branch of the same family, for contrast.
  Assert<Has<`allplayers:${string}:weapons`>>,
  // The flattened `allplayers.custom` subtree lands on the same names the
  // server emits from its SteamID set difference, not on "allplayers:custom:*".
  Assert<Has<"allplayers:joined">>,
  Assert<Equals<Has<"allplayers:custom:joined">, false>>,
] = [true, true, true, true, true];

/**
 * arktype's `json` form mirrors the structure `LeafPaths` walks: `required`
 * and `optional` carry declared keys, `index` carries index signatures, and
 * arrays are opaque leaves.
 */
interface JsonEntry {
  key?: string;
  value?: unknown;
}

interface JsonNode {
  required?: JsonEntry[];
  optional?: JsonEntry[];
  index?: Array<{ value?: unknown }>;
  proto?: string;
}

/** Keys `LeafPaths` traverses through without spending a path segment. */
const FLATTENED_KEYS = new Set(["custom"]);

/**
 * Longest colon-path (in segments) reachable below `node`, using exactly the
 * traversal rules of `LeafPaths`: one segment per declared key and per index
 * signature, zero for flattened keys, and no recursion into arrays.
 */
function maxPathSegments(node: unknown): number {
  if (Array.isArray(node)) {
    // A union — the deepest branch wins.
    return node.reduce<number>((deepest, branch) => Math.max(deepest, maxPathSegments(branch)), 0);
  }

  if (typeof node !== "object" || node === null) {
    return 0;
  }

  const { required = [], optional = [], index = [], proto } = node as JsonNode;

  if (proto === "Array") {
    return 0;
  }

  let deepest = 0;

  for (const entry of [...required, ...optional]) {
    const cost = entry.key !== undefined && FLATTENED_KEYS.has(entry.key) ? 0 : 1;

    deepest = Math.max(deepest, cost + maxPathSegments(entry.value));
  }

  for (const entry of index) {
    deepest = Math.max(deepest, 1 + maxPathSegments(entry.value));
  }

  return deepest;
}

describe("@types: event path generation", () => {
  it("satisfies its compile-time path assertions", () => {
    expect(typeAssertions.every(Boolean)).toBe(true);
  });

  it("keeps every schema path within the LeafPaths depth limit", () => {
    const deepest = maxPathSegments(schema.payload.json);

    // Not just `<=`: if the schema ever gets shallower, MAX_PATH_DEPTH should
    // come down with it rather than sit there paying for unused recursion.
    expect(deepest).toBe(MAX_PATH_DEPTH);
  });

  it("reaches the deepest declared family through allplayers weapons", () => {
    const weapons = maxPathSegments(schema.allplayers.json);

    // allplayers itself is one segment shallower than the full payload path.
    expect(weapons).toBe(MAX_PATH_DEPTH - 1);
  });
});
