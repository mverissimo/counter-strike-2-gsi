import type { SchemaPayload } from "@counter-strike-2-gsi/types";

import { payload } from "./payload";

export const deltas = {
  playerDamage: {
    player: {
      state: {
        health: 67,
        armor: 82,
      },
    },
  } as Partial<SchemaPayload>,
  playerDeath: {
    player: {
      state: {
        health: 0,
        round_kills: 3,
        round_killhs: 2,
      },
    },
  } as Partial<SchemaPayload>,
  roundEnd: {
    map: {
      phase: "over",
      round: 9,
      team_ct: { score: 6 },
    },
    round: {
      phase: "over",
      win_team: "CT",
    },
  } as Partial<SchemaPayload>,
  bombPlanted: {
    bomb: {
      state: "planted",
      position: "-123.4, 456.7, 89.0",
      player: "76561198253772619",
      countdown: "35.0",
    },
  } as Partial<SchemaPayload>,
  newGrenade: {
    grenades: {
      "354": {
        owner: "76561199815555276",
        position: "-72.6, 776.8, 2.3",
        lifetime: "19.378",
        type: "smoke",
        effecttime: "17.578",
      },
    },
  } as Partial<SchemaPayload>,

  /** Grenade removed (exploded/expired) */
  grenadeRemoved: {
    grenades: {
      "331": payload.grenades?.["331"], // keep smoke
      // '291' intentionally omitted
    },
  } as Partial<SchemaPayload>,

  /** New player joins (allplayers) */
  playerJoined: {
    allplayers: {
      "76561198000000004": {
        steamid: "76561198000000004",
        name: "NiKo",
        team: "CT",
        state: {
          health: 100,
          armor: 100,
          helmet: true,
          money: 1600,
          burning: 0,
          equip_value: 1000,
          flashed: 0,
          round_killhs: 1,
          round_kills: 1,
          smoked: 0,
          defuse_kit: false,
          round_totaldmg: 100,
        },
      },
    },
  } as Partial<SchemaPayload>,

  noOp: {
    player: {
      name: "s1mple",
    },
  } as Partial<SchemaPayload>,

  /** donk ("76561198000000003") left the match */
  playerLeft: {
    allplayers: {
      "76561198000000001": payload.allplayers?.["76561198000000001"],
      "76561198000000002": payload.allplayers?.["76561198000000002"],
      // "76561198000000003" (donk) intentionally omitted
    },
  } as Partial<SchemaPayload>,

  /** NiKo joins — all three existing players still present */
  playerAdded: {
    allplayers: {
      "76561198000000001": payload.allplayers?.["76561198000000001"],
      "76561198000000002": payload.allplayers?.["76561198000000002"],
      "76561198000000003": payload.allplayers?.["76561198000000003"],
      "76561198000000004": {
        steamid: "76561198000000004",
        name: "NiKo",
        team: "CT",
        state: {
          health: 100,
          armor: 100,
          helmet: true,
          money: 1600,
          burning: 0,
          equip_value: 1000,
          flashed: 0,
          round_killhs: 1,
          round_kills: 1,
          smoked: 0,
          defuse_kit: false,
          round_totaldmg: 100,
        },
      },
    },
  } as Partial<SchemaPayload>,

  /** ZywOo took damage — all three players still in roster */
  allplayerStateUpdate: {
    allplayers: {
      "76561198000000001": payload.allplayers?.["76561198000000001"],
      "76561198000000002": {
        steamid: "76561198000000002",
        name: "ZywOo",
        team: "T",
        state: {
          health: 50, // changed from 87
          armor: 95,
          helmet: true,
          money: 1200,
          round_kills: 1,
          burning: 10,
          equip_value: 1000,
          flashed: 0,
          round_killhs: 1,
          smoked: 0,
          defuse_kit: false,
          round_totaldmg: 300,
        },
      },
      "76561198000000003": payload.allplayers?.["76561198000000003"],
    },
  } as Partial<SchemaPayload>,

  /** All grenades have expired / been cleared */
  grenadesAllCleared: {
    grenades: {},
  } as Partial<SchemaPayload>,

  /** Inferno "291" lifetime ticked — both grenades still active */
  grenadesUpdateExisting: {
    grenades: {
      "291": {
        owner: "76561198253772619",
        lifetime: "5.500",
        type: "inferno",
        flames: {
          flame_p682_p1321_n85: "682.0, 1321.0, -85.0",
        },
      },
      "331": payload.grenades?.["331"],
    },
  } as Partial<SchemaPayload>,

  /** Inferno "291" exploded — "331" survives with updated effecttime */
  grenadesUpdateAndRemove: {
    grenades: {
      "331": {
        owner: "76561198051139338",
        position: "-807.5, 353.4, -54.0",
        lifetime: "4.100",
        type: "smoke",
        effecttime: "1.200",
      },
      // "291" intentionally omitted
    },
  } as Partial<SchemaPayload>,

  /** s1mple dropped the knife — only weapon_0 is still reported */
  weaponDropped: {
    player: {
      weapons: {
        weapon_0: {
          name: "weapon_ak47",
          type: "Rifle",
          paintkit: "default",
          state: "active",
          ammo_clip: 12,
          ammo_clip_max: 30,
          ammo_reserve: 90,
        },
        // "weapon_1" intentionally omitted
      },
    },
  } as Partial<SchemaPayload>,

  /** Same drop, seen through the allplayers roster */
  allplayerWeaponDropped: {
    allplayers: {
      "76561198000000001": {
        steamid: "76561198000000001",
        weapons: {
          weapon_0: payload.allplayers?.["76561198000000001"]?.weapons?.weapon_0,
          // "weapon_1" intentionally omitted
        },
      },
      "76561198000000002": payload.allplayers?.["76561198000000002"],
      "76561198000000003": payload.allplayers?.["76561198000000003"],
    },
  } as Partial<SchemaPayload>,

  /** Inferno "291" spreads — new flame point appears in sub-object */
  flamesUpdate: {
    grenades: {
      "291": {
        owner: "76561198253772619",
        lifetime: "4.242",
        type: "inferno",
        flames: {
          flame_p682_p1321_n85: "682.0, 1321.0, -85.0",
          flame_p700_p1340_n85: "700.0, 1340.0, -85.0",
        },
      },
      "331": payload.grenades?.["331"],
    },
  } as Partial<SchemaPayload>,
} as const;
