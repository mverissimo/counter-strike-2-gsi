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
});
