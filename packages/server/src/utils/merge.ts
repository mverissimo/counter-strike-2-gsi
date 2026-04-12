import microdiff from "microdiff";
import deepmerge from "@fastify/deepmerge";

import type { SchemaPayload } from "@counter-strike-2-gsi/types";

const factory = deepmerge({
  onlyDefinedProperties: true,
  mergeArray: (options) => {
    const { clone } = options;

    return (target: unknown[], source: unknown[]): unknown[] => {
      if (!Array.isArray(source) || source.length === 0) {
        return target;
      }

      if (!Array.isArray(target)) {
        return clone ? source.map((item) => clone(item)) : [...source];
      }

      const result: unknown[] = [...target];

      for (let i = 0; i < source.length; i++) {
        const newItem = source[i];
        const oldItem = target[i];

        if (newItem === undefined) {
          continue;
        }

        if (oldItem === newItem) {
          continue;
        }

        if (isPlainObject(oldItem) && isPlainObject(newItem)) {
          result[i] = gsiMerger(oldItem, newItem);
        } else {
          result[i] = clone ? clone(newItem) : newItem;
        }
      }

      for (let i = target.length; i < source.length; i++) {
        result[i] = clone ? clone(source[i]) : source[i];
      }

      return result;
    };
  },

  isMergeableObject: (value: unknown): boolean => {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  },
});

const gsiMerger = factory;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Keys that represent sparse object collections in GSI.
 * When a key is missing in the delta, it should be removed from the state.
 */
const COLLECTION_KEYS = new Set<keyof SchemaPayload>(["grenades", "allplayers"]);

/**
 * High-performance immutable merge for CS2 GSI deltas with proper removal support.
 *
 * Features:
 * - Early exit via microdiff when no real changes
 * - Smart by-index merging for true arrays
 * - Explicit deletion for missing keys in known collections (grenades, allplayers)
 * - Always returns same reference on no-op
 */
export function mergeDelta(
  current: SchemaPayload,
  delta: Partial<SchemaPayload> | SchemaPayload | null | undefined,
  skipDiff = false,
): SchemaPayload {
  if (!delta || Object.keys(delta).length === 0) {
    return current;
  }

  if (!skipDiff) {
    const changes = microdiff(current, delta, {
      cyclesFix: false,
    });

    if (changes.length === 0) {
      return current;
    }
  }

  let result = gsiMerger(current, delta) as SchemaPayload;

  // Post-merge cleanup: remove keys that were omitted in the delta for collection objects
  for (const key of COLLECTION_KEYS) {
    if (key in delta) {
      const deltaCollection = delta[key] as Record<string, unknown> | undefined;
      const currentCollection = result[key] as Record<string, unknown> | undefined;

      if (currentCollection && deltaCollection) {
        // Delete any keys that exist in current but NOT in the incoming delta
        for (const k in currentCollection) {
          if (!(k in deltaCollection)) {
            delete (result[key] as any)[k];
          }
        }
      }
    }
  }

  return result;
}
