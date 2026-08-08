import { describe, expect, it } from "vitest";

import { carriesBomb, heldWeapon, parseSeconds, players } from "../derive";
import type { SchemaAllPlayers, SchemaPlayer } from "../schema";

function player(name: string, health: number, slot?: number): SchemaPlayer {
  return {
    name,
    team: "CT",
    ...(slot === undefined ? {} : { observer_slot: slot }),
    state: {
      health,
      armor: 100,
      helmet: true,
      flashed: 0,
      smoked: 0,
      burning: 0,
      money: 3000,
      round_kills: 0,
      round_killhs: 0,
      equip_value: 3800,
    },
  };
}

describe("@types: players", () => {
  it("returns every player as [steamid, player]", () => {
    const roster = {
      "76561197960265728": player("dev_null", 100),
      "76561197960265729": player("segfault", 40),
    } as unknown as SchemaAllPlayers;

    expect(players(roster).map(([id, p]) => [id, p.name])).toEqual([
      ["76561197960265728", "dev_null"],
      ["76561197960265729", "segfault"],
    ]);
  });

  it("skips the `custom` roster-change block", () => {
    // CS2 sends this alongside the players whenever the roster changes; it is
    // what the server reads to emit allplayers:joined / allplayers:left.
    const roster = {
      "76561197960265728": player("dev_null", 100),
      custom: {
        joined: ["76561197960265729"],
        left: [],
      },
    } as unknown as SchemaAllPlayers;

    const result = players(roster);

    expect(result).toHaveLength(1);
    expect(result[0][0]).toBe("76561197960265728");
  });

  it("does not let `custom` skew a count taken over the roster", () => {
    const roster = {
      "1": player("a", 100),
      "2": player("b", 0),
      custom: {
        joined: [],
        left: ["3"],
      },
    } as unknown as SchemaAllPlayers;

    const alive = players(roster).filter(([, p]) => (p.state?.health ?? 0) > 0);

    expect(players(roster)).toHaveLength(2);
    expect(alive).toHaveLength(1);
  });

  it("returns an empty array when allplayers is absent", () => {
    expect(players(undefined)).toEqual([]);
  });

  it("orders by observer_slot regardless of payload key order", () => {
    // Key order in `allplayers` is not stable between ticks; rendering in
    // payload order makes roster rows swap places at random.
    const roster = {
      "300": player("third", 100, 2),
      "100": player("first", 100, 0),
      "200": player("second", 100, 1),
    } as unknown as SchemaAllPlayers;

    expect(players(roster).map(([, p]) => p.name)).toEqual(["first", "second", "third"]);
  });

  it("sorts slotless players last and breaks ties by steamid", () => {
    const roster = {
      zzz: player("caster", 100),
      aaa: player("observer", 100),
      "100": player("in-game", 100, 4),
    } as unknown as SchemaAllPlayers;

    expect(players(roster).map(([, p]) => p.name)).toEqual(["in-game", "observer", "caster"]);
  });
});

describe("@types: carriesBomb", () => {
  it("finds the C4 even while another weapon is held", () => {
    // The bomb is just an entry in `weapons`; its state is irrelevant, and
    // nothing else in the payload says who is carrying it.
    const weapons = {
      weapon_0: { name: "weapon_ak47", paintkit: "default", state: "active" },
      weapon_1: { name: "weapon_c4", paintkit: "default", state: "holstered" },
    } as unknown as SchemaPlayer["weapons"];

    expect(carriesBomb(weapons)).toBe(true);
  });

  it("is false for a player without it", () => {
    const weapons = {
      weapon_0: { name: "weapon_knife", paintkit: "default", state: "holstered" },
    } as unknown as SchemaPlayer["weapons"];

    expect(carriesBomb(weapons)).toBe(false);
    expect(carriesBomb(undefined)).toBe(false);
  });
});

describe("@types: heldWeapon", () => {
  const knife = {
    name: "weapon_knife",
    paintkit: "default",
    state: "holstered",
  } as const;

  it("finds the active weapon", () => {
    const weapons = {
      weapon_0: knife,
      weapon_1: {
        name: "weapon_ak47",
        paintkit: "default",
        state: "active",
        ammo_clip: 30,
      },
    } as unknown as SchemaPlayer["weapons"];

    expect(heldWeapon(weapons)?.name).toBe("weapon_ak47");
  });

  it("still finds the weapon while it is reloading", () => {
    // No weapon reports "active" during a reload — matching only "active"
    // makes the weapon disappear from a HUD for the whole animation.
    const weapons = {
      weapon_0: knife,
      weapon_1: {
        name: "weapon_ak47",
        paintkit: "default",
        state: "reloading",
        ammo_clip: 0,
      },
    } as unknown as SchemaPlayer["weapons"];

    expect(heldWeapon(weapons)?.name).toBe("weapon_ak47");
  });

  it("returns undefined when everything is holstered or absent", () => {
    const weapons = {
      weapon_0: knife,
    } as unknown as SchemaPlayer["weapons"];

    expect(heldWeapon(weapons)).toBeUndefined();
    expect(heldWeapon(undefined)).toBeUndefined();
  });
});

describe("@types: parseSeconds", () => {
  it("parses CS2's string countdowns", () => {
    expect(parseSeconds("94.7")).toBe(94.7);
    expect(parseSeconds("0.0")).toBe(0);
  });

  it("returns undefined rather than NaN for absent or unparseable values", () => {
    // `bomb.countdown` is absent until the bomb is planted; NaN here would
    // propagate silently into whatever arithmetic the consumer does next.
    expect(parseSeconds(undefined)).toBeUndefined();
    expect(parseSeconds("")).toBeUndefined();
    expect(parseSeconds("not-a-number")).toBeUndefined();
  });
});
