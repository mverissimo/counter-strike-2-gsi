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
 * Immutable merge of a CS2 GSI delta into current state, with removal support
 * for the sparse collections in {@link COLLECTION_KEYS} and for weapons.
 *
 * Returns `current` by identity when nothing changed, so callers can use
 * reference equality to skip work. Pass `skipDiff` when the caller diffs the
 * result itself and the pre-diff would just walk the state twice.
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

  // Post-merge cleanup: remove keys that were omitted in the delta for
  // collection objects (sparse by construction in GSI — a missing key means
  // "no longer present", not "unchanged").
  //
  // Every step below is copy-on-write. `pruneMissingKeys` hands back the same
  // reference when there is nothing to drop, so a parent is only rebuilt once
  // a child actually changed, and nothing reachable from `current` is written
  // to. See the note on `pruneMissingKeys` for why in-place deletion is not
  // an option here.
  for (const key of COLLECTION_KEYS) {
    const collection = result[key] as Record<string, unknown> | undefined;
    const source = key in delta ? (delta[key] as Record<string, unknown> | undefined) : undefined;

    if (!collection || !source) {
      continue;
    }

    const pruned = pruneMissingKeys(collection, source);

    if (pruned !== collection) {
      result = {
        ...result,
        [key]: pruned,
      } as SchemaPayload;
    }
  }

  // Weapons are also sparse. The active player's weapons live at
  // `player.weapons`; every player's weapons also live under
  // `allplayers[steamid].weapons`. A dropped weapon vanishes from the
  // payload, so we have to mirror that in state.
  if (delta.player?.weapons && result.player?.weapons) {
    const weapons = result.player.weapons;
    const pruned = pruneMissingKeys(weapons, delta.player.weapons);

    if (pruned !== weapons) {
      result = {
        ...result,
        player: {
          ...result.player,
          weapons: pruned,
        },
      };
    }
  }

  // Roster pruning above already ran, so this only walks players that
  // survived the delta.
  if (delta.allplayers && result.allplayers) {
    const original = result.allplayers;

    let players = original;

    for (const steamid of Object.keys(original)) {
      const player = players[steamid];
      const weapons = player?.weapons;
      const deltaWeapons = delta.allplayers[steamid]?.weapons;

      if (!weapons || !deltaWeapons) {
        continue;
      }

      const pruned = pruneMissingKeys(weapons, deltaWeapons);

      if (pruned === weapons) {
        continue;
      }

      if (players === original) {
        players = {
          ...original,
        };
      }

      players[steamid] = {
        ...player,
        weapons: pruned,
      };
    }

    if (players !== original) {
      result = {
        ...result,
        allplayers: players,
      };
    }
  }

  return result;
}

/**
 * Returns `target` without the keys that are absent from `source`.
 *
 * Never mutates. `manager.state` hands out live sub-trees, so consumers can
 * be holding a reference to any object in here; deleting keys in place would
 * rewrite a snapshot they already read — and would break the `previous`
 * side of every delta the processor is about to emit from it.
 *
 * Returns the exact same reference when nothing has to be dropped (the common
 * case at 64 Hz), so callers can use identity to decide whether the parent
 * needs rebuilding.
 */
function pruneMissingKeys<T extends Record<string, unknown>>(
  target: T,
  source: Record<string, unknown>,
): T {
  let hasMissing = false;

  for (const k in target) {
    if (!(k in source)) {
      hasMissing = true;

      break;
    }
  }

  if (!hasMissing) {
    return target;
  }

  const pruned: Record<string, unknown> = {};

  for (const k in target) {
    if (k in source) {
      pruned[k] = target[k];
    }
  }

  return pruned as T;
}
