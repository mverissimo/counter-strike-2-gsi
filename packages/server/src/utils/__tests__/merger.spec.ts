import { describe, it, expect, beforeEach } from "vitest";

import type { SchemaPayload } from "@counter-strike-2-gsi/types";

import { mergeDelta } from "../merge";
import { payload, deltas, clonePayload, frozenPayload } from "../../../tests/fixtures";

describe("@server/utils: merger", () => {
  let previous: SchemaPayload;

  beforeEach(() => {
    previous = clonePayload(payload);
  });

  it("returns the exact same reference when no changes (early exit via microdiff)", () => {
    const result = mergeDelta(previous, deltas.noOp);

    expect(result).toStrictEqual(previous);
  });

  it("creates a new object when actual changes occur", () => {
    const result = mergeDelta(previous, deltas.playerDamage);

    expect(result).not.toBe(previous);
    expect(result.player?.state?.health).toBe(67);
    expect(result.player?.state?.armor).toBe(82);
  });

  it("handles grenade removal (key disappears from object)", () => {
    const result = mergeDelta(previous, deltas.grenadeRemoved);

    expect(result.grenades).not.toHaveProperty("291");
    expect(result.grenades).toHaveProperty("331");
  });

  it("adds new grenade correctly", () => {
    const result = mergeDelta(previous, deltas.newGrenade);

    expect(result.grenades?.["354"]?.type).toBe("smoke");
  });

  it("respects skipDiff flag (block/minimal modes)", () => {
    const result = mergeDelta(previous, deltas.playerDeath, true);

    expect(result.player?.state?.health).toBe(0);
  });

  it("handles bomb planted scenario", () => {
    const result = mergeDelta(previous, deltas.bombPlanted);

    expect(result.bomb?.state).toBe("planted");
    expect(result.bomb?.countdown).toBe("35.0");
  });

  it("returns original reference when delta is null or undefined", () => {
    expect(mergeDelta(previous, null)).toBe(previous);
    expect(mergeDelta(previous, undefined)).toBe(previous);
  });

  it("returns same reference when delta is an empty object", () => {
    const result = mergeDelta(previous, {});

    expect(result).toBe(previous);
  });

  it("skipDiff: true forces merge even when delta values match current state", () => {
    const result = mergeDelta(previous, deltas.noOp, true);

    expect(result).not.toBe(previous);
  });

  it("handles round end (multi-key delta updating map and round simultaneously)", () => {
    const result = mergeDelta(previous, deltas.roundEnd);

    expect(result.map?.phase).toBe("over");
    expect(result.map?.round).toBe(9);
    expect(result.map?.team_ct?.score).toBe(6);
    expect(result.round?.phase).toBe("over");
    expect(result.round?.win_team).toBe("CT");
  });

  it("partial delta leaves sibling fields intact", () => {
    const result = mergeDelta(previous, deltas.playerDamage);

    expect(result.player?.name).toBe("s1mple");
    expect(result.player?.team).toBe("CT");
    expect(result.player?.weapons).toEqual(previous.player?.weapons);
  });

  it("does not mutate the previous payload", () => {
    mergeDelta(previous, deltas.playerDamage);

    expect(previous.player?.state?.health).toBe(100);
    expect(previous.player?.state?.armor).toBe(100);
  });

  it("removes disconnected player from allplayers", () => {
    const result = mergeDelta(previous, deltas.playerLeft);

    expect(result.allplayers).not.toHaveProperty("76561198000000003");
    expect(result.allplayers).toHaveProperty("76561198000000001");
    expect(result.allplayers).toHaveProperty("76561198000000002");
  });

  it("adds new player to allplayers while keeping existing roster", () => {
    const result = mergeDelta(previous, deltas.playerAdded);

    expect(result.allplayers).toHaveProperty("76561198000000004");
    expect(result.allplayers?.["76561198000000004"]?.name).toBe("NiKo");
    expect(result.allplayers).toHaveProperty("76561198000000001");
    expect(result.allplayers).toHaveProperty("76561198000000002");
    expect(result.allplayers).toHaveProperty("76561198000000003");
  });

  it("updates existing player state in allplayers without removing other players", () => {
    const result = mergeDelta(previous, deltas.allplayerStateUpdate);

    expect(result.allplayers?.["76561198000000002"]?.state?.health).toBe(50);
    expect(result.allplayers).toHaveProperty("76561198000000001");
    expect(result.allplayers).toHaveProperty("76561198000000003");
  });

  it("clears all grenades when delta has an empty grenades collection", () => {
    const result = mergeDelta(previous, deltas.grenadesAllCleared);

    expect(result.grenades).not.toHaveProperty("291");
    expect(result.grenades).not.toHaveProperty("331");
  });

  it("updates existing grenade fields in-place", () => {
    const result = mergeDelta(previous, deltas.grenadesUpdateExisting);

    expect(result.grenades?.["291"]?.lifetime).toBe("5.500");
    expect(result.grenades).toHaveProperty("331");
  });

  it("updates one grenade and removes another in a single delta", () => {
    const result = mergeDelta(previous, deltas.grenadesUpdateAndRemove);

    expect(result.grenades).not.toHaveProperty("291");
    expect(result.grenades?.["331"]?.lifetime).toBe("4.100");
    expect(result.grenades?.["331"]?.effecttime).toBe("1.200");
  });

  it("deep-merges flames sub-object inside inferno grenade", () => {
    const result = mergeDelta(previous, deltas.flamesUpdate);

    expect(result.grenades?.["291"]?.flames).toHaveProperty("flame_p682_p1321_n85");
    expect(result.grenades?.["291"]?.flames).toHaveProperty("flame_p700_p1340_n85");
  });

  it("drops weapons missing from the active player's delta", () => {
    const result = mergeDelta(previous, deltas.weaponDropped);

    expect(result.player?.weapons).not.toHaveProperty("weapon_1");
    expect(result.player?.weapons?.weapon_0?.ammo_clip).toBe(12);
  });

  it("drops weapons missing from an allplayers entry", () => {
    const result = mergeDelta(previous, deltas.allplayerWeaponDropped);

    const weapons = result.allplayers?.["76561198000000001"]?.weapons;

    expect(weapons).not.toHaveProperty("weapon_1");
    expect(weapons).toHaveProperty("weapon_0");
  });

  it("leaves other players' weapons untouched when one player drops a weapon", () => {
    const result = mergeDelta(previous, deltas.allplayerWeaponDropped);

    expect(result.allplayers?.["76561198000000002"]?.weapons).toEqual(
      previous.allplayers?.["76561198000000002"]?.weapons,
    );
  });

  // Pruning used to `delete` straight out of the merged tree, which is only
  // safe as long as the merger never shares a sub-object with the state it
  // merged from. `manager.state` hands out live sub-trees and the processor
  // diffs `previous` against `current` right after this runs, so a prune that
  // reaches back into the old state silently rewrites both.
  describe("prune does not mutate the previous state", () => {
    it("keeps the previous grenades collection intact after a removal", () => {
      const grenades = previous.grenades;
      const before = clonePayload(previous);

      const result = mergeDelta(previous, deltas.grenadesUpdateAndRemove);

      expect(result.grenades).not.toHaveProperty("291");
      expect(previous.grenades).toBe(grenades);
      expect(previous).toEqual(before);
    });

    it("keeps the previous roster intact after a player leaves", () => {
      const allplayers = previous.allplayers;
      const before = clonePayload(previous);

      const result = mergeDelta(previous, deltas.playerLeft);

      expect(result.allplayers).not.toHaveProperty("76561198000000003");
      expect(previous.allplayers).toBe(allplayers);
      expect(previous).toEqual(before);
    });

    it("keeps the previous player's weapons intact after a drop", () => {
      const weapons = previous.player?.weapons;
      const before = clonePayload(previous);

      const result = mergeDelta(previous, deltas.weaponDropped);

      expect(result.player?.weapons).not.toHaveProperty("weapon_1");
      expect(previous.player?.weapons).toBe(weapons);
      expect(previous).toEqual(before);
    });

    it("keeps the previous allplayers weapons intact after a drop", () => {
      const before = clonePayload(previous);

      const result = mergeDelta(previous, deltas.allplayerWeaponDropped);

      expect(result.allplayers?.["76561198000000001"]?.weapons).not.toHaveProperty("weapon_1");
      expect(previous).toEqual(before);
    });

    it("survives a frozen previous state (no writes attempted at all)", () => {
      const frozen = frozenPayload(payload);

      Object.freeze(frozen.grenades);
      Object.freeze(frozen.allplayers);
      Object.freeze(frozen.player);
      Object.freeze(frozen.player?.weapons);

      expect(() => mergeDelta(frozen, deltas.grenadesUpdateAndRemove)).not.toThrow();
      expect(() => mergeDelta(frozen, deltas.playerLeft)).not.toThrow();
      expect(() => mergeDelta(frozen, deltas.weaponDropped)).not.toThrow();
    });

    it("returns the untouched collection reference when nothing is pruned", () => {
      // `grenadesUpdateExisting` names both grenades, so the collection keeps
      // all its keys and only the changed grenade should be a new object.
      const result = mergeDelta(previous, deltas.grenadesUpdateExisting);

      expect(Object.keys(result.grenades ?? {})).toEqual(["291", "331"]);
      expect(previous.grenades).toHaveProperty("291");
    });
  });

  // A weapons delta has three distinct shapes: `{}` (player holds nothing),
  // `null` (hand-built payloads with validation off), and an absent key
  // (block sent without the weapons component — means "unchanged").
  describe("weapons delta semantics", () => {
    it("weapons: {} empties the active player's weapons", () => {
      const result = mergeDelta(previous, {
        player: { weapons: {} },
      } as Partial<SchemaPayload>);

      expect(result.player?.weapons).toEqual({});
    });

    it("weapons: null removes the weapons key from the active player", () => {
      const result = mergeDelta(previous, {
        player: { weapons: null },
      } as unknown as Partial<SchemaPayload>);

      expect(result.player).not.toHaveProperty("weapons");
      expect(result.player?.name).toBe("s1mple");
    });

    it("a player delta without a weapons key leaves weapons untouched", () => {
      const result = mergeDelta(previous, deltas.playerDamage);

      expect(result.player?.weapons).toEqual(previous.player?.weapons);
    });

    it("allplayers entry weapons: {} empties that player's weapons only", () => {
      const result = mergeDelta(previous, {
        allplayers: {
          "76561198000000001": { steamid: "76561198000000001", weapons: {} },
          "76561198000000002": payload.allplayers?.["76561198000000002"],
          "76561198000000003": payload.allplayers?.["76561198000000003"],
        },
      } as Partial<SchemaPayload>);

      expect(result.allplayers?.["76561198000000001"]?.weapons).toEqual({});
      expect(result.allplayers?.["76561198000000002"]?.weapons).toEqual(
        previous.allplayers?.["76561198000000002"]?.weapons,
      );
    });

    it("allplayers entry weapons: null removes that player's weapons only", () => {
      const result = mergeDelta(previous, {
        allplayers: {
          "76561198000000001": { steamid: "76561198000000001", weapons: null },
          "76561198000000002": payload.allplayers?.["76561198000000002"],
          "76561198000000003": payload.allplayers?.["76561198000000003"],
        },
      } as unknown as Partial<SchemaPayload>);

      expect(result.allplayers?.["76561198000000001"]).not.toHaveProperty("weapons");
      expect(result.allplayers?.["76561198000000002"]?.weapons).toEqual(
        previous.allplayers?.["76561198000000002"]?.weapons,
      );
    });

    it("weapons removal never mutates the previous state", () => {
      const before = clonePayload(previous);

      mergeDelta(previous, {
        player: { weapons: null },
      } as unknown as Partial<SchemaPayload>);
      mergeDelta(previous, {
        player: { weapons: {} },
      } as Partial<SchemaPayload>);

      expect(previous).toEqual(before);
    });
  });

  describe("explicit null blocks", () => {
    it("grenades: null removes the grenades block from state", () => {
      const result = mergeDelta(previous, {
        grenades: null,
      } as unknown as Partial<SchemaPayload>);

      expect(result).not.toHaveProperty("grenades");
      expect(result.player?.name).toBe("s1mple");
    });

    it("allplayers: null removes the roster block from state", () => {
      const result = mergeDelta(previous, {
        allplayers: null,
      } as unknown as Partial<SchemaPayload>);

      expect(result).not.toHaveProperty("allplayers");
    });

    it("null block removal does not mutate the previous state", () => {
      const before = clonePayload(previous);

      mergeDelta(previous, {
        grenades: null,
      } as unknown as Partial<SchemaPayload>);

      expect(previous).toEqual(before);
    });
  });

  // Only reachable with `validatePayload: false` — the schema rejects all of
  // these shapes. The merge must not throw on them; pruning just steps aside.
  describe("non-object garbage in sparse-collection slots", () => {
    it("does not throw when a collection block is a primitive", () => {
      expect(() =>
        mergeDelta(previous, { grenades: "garbage" } as unknown as Partial<SchemaPayload>),
      ).not.toThrow();
      expect(() =>
        mergeDelta(previous, { allplayers: 42 } as unknown as Partial<SchemaPayload>),
      ).not.toThrow();
    });

    it("does not throw when player or weapons is a primitive", () => {
      expect(() =>
        mergeDelta(previous, { player: "garbage" } as unknown as Partial<SchemaPayload>),
      ).not.toThrow();
      expect(() =>
        mergeDelta(previous, {
          player: { weapons: "garbage" },
        } as unknown as Partial<SchemaPayload>),
      ).not.toThrow();
    });

    it("does not throw when an allplayers entry or its weapons is a primitive", () => {
      expect(() =>
        mergeDelta(previous, {
          allplayers: {
            "76561198000000001": "garbage",
            "76561198000000002": payload.allplayers?.["76561198000000002"],
            "76561198000000003": payload.allplayers?.["76561198000000003"],
          },
        } as unknown as Partial<SchemaPayload>),
      ).not.toThrow();
      expect(() =>
        mergeDelta(previous, {
          allplayers: {
            "76561198000000001": { steamid: "76561198000000001", weapons: "garbage" },
            "76561198000000002": payload.allplayers?.["76561198000000002"],
            "76561198000000003": payload.allplayers?.["76561198000000003"],
          },
        } as unknown as Partial<SchemaPayload>),
      ).not.toThrow();
    });

    // Only reachable with `validatePayload: false` — the schema types every
    // collection slot as an object, never an array. The underlying deepmerge
    // treats an array as a non-mergeable value (`isMergeableObject` rejects
    // arrays) and replaces the target field with it wholesale, *before* the
    // sparse-collection pruning step below ever runs — so the `isPlainObject`
    // guard on that pruning step has no bearing on this outcome either way;
    // it exists to stop `pruneMissingKeys` from misbehaving on other garbage
    // shapes (e.g. a string, whose indices `for...in` *does* visit), not to
    // preserve arrays specifically. Pinned so a future change to either the
    // guard or the merge config doesn't silently swap this behavior.
    it("replaces the collection wholesale when the delta value is an array", () => {
      const result = mergeDelta(previous, {
        grenades: [],
      } as unknown as Partial<SchemaPayload>);

      expect(result.grenades).toEqual([]);
    });

    it("replaces weapons wholesale when the delta value is an array", () => {
      const result = mergeDelta(previous, {
        player: { weapons: [] },
      } as unknown as Partial<SchemaPayload>);

      expect(result.player?.weapons).toEqual([]);
    });
  });
});
