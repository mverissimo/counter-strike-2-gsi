import type {
  SchemaBomb,
  SchemaGrenades,
  SchemaPayload,
  SchemaPhaseCountdowns,
  SchemaRound,
} from "@counter-strike-2-gsi/types";

function player(
  steamid: string,
  name: string,
  team: "CT" | "T",
  health: number,
  money: number,
  observerSlot: number,
  position: string,
) {
  return {
    steamid,
    name,
    team,
    observer_slot: observerSlot,
    position,
    forward: "0.00, 1.00, 0.00",
    weapons: {
      weapon_0: {
        name: team === "CT" ? "weapon_m4a1" : "weapon_ak47",
        type: "Rifle" as const,
        paintkit: "default",
        state: "active" as const,
        ammo_clip: 30,
        ammo_clip_max: 30,
        ammo_reserve: 90,
      },
      weapon_1: {
        name: "weapon_knife",
        type: "Knife" as const,
        paintkit: "default",
        state: "holstered" as const,
      },
    },
    match_stats: {
      kills: 5,
      assists: 2,
      deaths: 4,
      mvps: 1,
      score: 14,
    },
    state: {
      health,
      armor: health > 0 ? 95 : 0,
      helmet: true,
      money,
      round_kills: 1,
      burning: 0,
      equip_value: 4000,
      flashed: 0,
      round_killhs: 0,
      smoked: 0,
      defuse_kit: false,
      round_totaldmg: 120,
    },
  };
}

const S1MPLE = "76561198000000001";
const ZYWOO = "76561198000000002";
const DONK = "76561198000000003";
const NIKO = "76561198000000004";

// Collections and round are typed with the schema's widened types so the
// frame mutations below (phase transitions, roster churn, grenade lifecycle)
// aren't rejected by the base literal's narrowed inference.
const baseRound: SchemaRound = {
  phase: "live",
};

const basePhaseCountdowns: SchemaPhaseCountdowns = {
  phase: "live",
  phase_ends_in: "93.5",
};

const baseAllplayers: Record<string, ReturnType<typeof player>> = {
  [S1MPLE]: player(S1MPLE, "s1mple", "CT", 100, 2450, 1, "-410.5, 1210.3, -52.1"),
  [ZYWOO]: player(ZYWOO, "ZywOo", "T", 87, 1200, 6, "312.9, 840.7, -60.0"),
  [DONK]: player(DONK, "donk", "T", 45, 850, 7, "150.2, 655.4, -58.3"),
};

const baseBomb: SchemaBomb = {
  state: "carried",
  position: "200.0, 340.0, -60.0",
  player: DONK,
};

const baseGrenades: SchemaGrenades = {
  "291": {
    owner: "76561198253772619",
    lifetime: "4.242",
    type: "inferno",
    flames: {
      flame_p682_p1321_n85: "682.0, 1321.0, -85.0",
    },
  },
  "331": {
    owner: "76561198051139338",
    position: "-807.5, 353.4, -54.0",
    velocity: "0.0, 0.0, 0.0",
    lifetime: "3.050",
    type: "smoke",
    effecttime: "0.844",
  },
};

const basePayload = {
  provider: {
    name: "Counter-Strike 2",
    appid: 730,
    version: 13900,
    steamid: S1MPLE,
    timestamp: 1744310000,
  },
  map: {
    mode: "competitive",
    name: "de_inferno",
    phase: "live",
    round: 8,
    num_matches_to_win_series: 2,
    current_spectators: 0,
    round_wins: {},
    souvenirs_total: 0,
    team_ct: {
      name: "Team Liquid",
      score: 5,
      consecutive_round_losses: 2,
      timeouts_remaining: 1,
      matches_won_this_series: 1,
    },
    team_t: {
      name: "Vitality",
      score: 3,
      consecutive_round_losses: 1,
      timeouts_remaining: 1,
      matches_won_this_series: 0,
    },
  },
  player: {
    steamid: S1MPLE,
    name: "s1mple",
    team: "CT",
    activity: "playing",
    observer_slot: 1,
    position: "-410.5, 1210.3, -52.1",
    forward: "0.71, 0.71, 0.00",
    state: {
      health: 100,
      armor: 100,
      helmet: true,
      flashed: 0,
      smoked: 0,
      burning: 0,
      money: 2450,
      round_kills: 2,
      round_killhs: 1,
      equip_value: 4700,
    },
    weapons: {
      weapon_0: {
        name: "weapon_ak47",
        type: "Rifle",
        paintkit: "default",
        state: "active",
        ammo_clip: 30,
        ammo_clip_max: 30,
        ammo_reserve: 90,
      },
      weapon_1: {
        name: "weapon_knife",
        type: "Knife",
        paintkit: "default",
        state: "holstered",
      },
    },
  },
  allplayers: baseAllplayers,
  bomb: baseBomb,
  grenades: baseGrenades,
  round: baseRound,
  phase_countdowns: basePhaseCountdowns,
} satisfies SchemaPayload;

/**
 * CS2 posts the full snapshot of every subscribed component on each update,
 * so the replay corpus is built the same way: a working draft is mutated
 * frame by frame (damage, ammo, bomb plant, round end, buys, roster churn)
 * and serialized whole. Frames must stay schema-complete — partial blocks
 * fail `parsePayload` validation and would benchmark the error path instead.
 */
const frames: string[] = [JSON.stringify(basePayload)];
const working: SchemaPayload = structuredClone(basePayload);

function snap(mutate: (draft: typeof basePayload) => void): void {
  mutate(working as typeof basePayload);
  frames.push(JSON.stringify(working));
}

// damage tick, players moving
snap((draft) => {
  draft.player.state.health = 67;
  draft.player.state.armor = 82;
  draft.player.position = "-402.1, 1198.6, -52.1";
  draft.allplayers[S1MPLE].state.health = 67;
  draft.allplayers[S1MPLE].state.armor = 82;
  draft.allplayers[S1MPLE].position = "-402.1, 1198.6, -52.1";
  draft.allplayers[ZYWOO].position = "305.4, 852.2, -60.0";
  draft.phase_countdowns.phase_ends_in = "88.2";
});

// firing: ammo drains
snap((draft) => {
  draft.player.weapons.weapon_0.ammo_clip = 24;
  draft.player.weapons.weapon_0.ammo_reserve = 90;
});

// ZywOo takes damage
snap((draft) => {
  draft.allplayers[ZYWOO].state.health = 50;
  draft.allplayers[ZYWOO].state.round_totaldmg = 180;
});

// grenade lifetimes tick, players moving
snap((draft) => {
  draft.grenades["291"].lifetime = "4.742";
  draft.grenades["331"].lifetime = "3.550";
  draft.grenades["331"].effecttime = "1.344";
  draft.allplayers[DONK].position = "162.7, 668.0, -58.3";
  draft.phase_countdowns.phase_ends_in = "84.9";
});

// bomb planted
snap((draft) => {
  draft.bomb.state = "planted";
  draft.bomb.position = "-123.4, 456.7, 89.0";
  draft.bomb.countdown = "35.0";
  draft.phase_countdowns.phase = "bomb";
  draft.phase_countdowns.phase_ends_in = "40.0";
});

// bomb countdown + grenade tick
snap((draft) => {
  draft.bomb.countdown = "30.0";
  draft.grenades["291"].lifetime = "5.242";
  draft.phase_countdowns.phase_ends_in = "35.0";
});

// player dies
snap((draft) => {
  draft.player.state.health = 0;
  draft.player.state.round_kills = 3;
  draft.player.state.round_killhs = 2;
  draft.allplayers[S1MPLE].state.health = 0;
  draft.allplayers[S1MPLE].state.armor = 0;
  draft.allplayers[S1MPLE].match_stats.deaths = 5;
  draft.allplayers[ZYWOO].match_stats.kills = 6;
});

// round over, CT wins
snap((draft) => {
  draft.round.phase = "over";
  draft.round.win_team = "CT";
  draft.map.team_ct.score = 6;
  draft.phase_countdowns.phase = "over";
  draft.phase_countdowns.phase_ends_in = "5.0";
});

// next round freezetime: state resets, grenades cleared
snap((draft) => {
  draft.map.round = 9;
  draft.round.phase = "freezetime";
  draft.player.state.health = 100;
  draft.player.state.armor = 0;
  draft.player.state.money = 3900;
  draft.player.state.round_kills = 0;
  draft.player.state.round_killhs = 0;
  for (const steamid of Object.keys(draft.allplayers)) {
    draft.allplayers[steamid].state.health = 100;
    draft.allplayers[steamid].state.round_kills = 0;
  }
  draft.grenades = {};
  draft.phase_countdowns.phase = "freezetime";
  draft.phase_countdowns.phase_ends_in = "15.0";
});

// buy phase
snap((draft) => {
  draft.player.state.money = 150;
  draft.player.state.equip_value = 5700;
  draft.player.state.armor = 100;
  draft.player.weapons.weapon_0.ammo_clip = 30;
  draft.player.weapons.weapon_0.ammo_reserve = 90;
});

// round goes live
snap((draft) => {
  draft.round.phase = "live";
  draft.map.phase = "live";
  draft.phase_countdowns.phase = "live";
  draft.phase_countdowns.phase_ends_in = "115.0";
});

// NiKo joins
snap((draft) => {
  draft.allplayers[NIKO] = player(NIKO, "NiKo", "CT", 100, 1600, 4, "-380.0, 1150.8, -52.1");
});

// fresh inferno spreads: two flame points
snap((draft) => {
  draft.grenades["415"] = {
    owner: "76561198253772619",
    lifetime: "1.100",
    type: "inferno",
    flames: {
      flame_p682_p1321_n85: "682.0, 1321.0, -85.0",
      flame_p700_p1340_n85: "700.0, 1340.0, -85.0",
    },
  };
});

// donk disconnects
snap((draft) => {
  delete draft.allplayers[DONK];
});

// no-change heartbeat
snap(() => undefined);

/**
 * Serialized once so each bench iteration can JSON.parse a fresh object per
 * update — the same cost a real HTTP body parse pays, and it protects the
 * corpus from libraries that mutate the incoming payload (cs2-gsi-z does).
 */
export const serializedFrames: readonly string[] = frames;

/** Full snapshot identical to the base state: a POST where nothing changed. */
export const serializedHeartbeat: string = JSON.stringify(basePayload);
