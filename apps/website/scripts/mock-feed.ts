/**
 * Posts a synthetic match to the GSI endpoint so the overlay/editor can be
 * developed without CS2 running. Shapes match `SchemaPayload`, so the server
 * validates them exactly as it would validate the real thing.
 *
 *   pnpm mock         # starts scripts/mock-server.ts -> http://localhost:3000
 *   pnpm mock:feed     # this script, posting to http://localhost:3000/gsi
 *   GSI_URL=... pnpm mock:feed
 *
 * Needs `pnpm mock` running first — this only posts. Ported from
 * `mock-feed.ts` on `feat/website-overlay-and-derive`: a real round-by-round
 * state machine (freezetime, plant, defuse, elimination, every `bomb.state`
 * a HUD branches on), not `lib/demo-frame.ts`'s deterministic time-of-day
 * formula. `demo-frame.ts` stays as it is for `?demo=1` — that path can't
 * post to a server (it has to run with nothing listening on any port), so
 * it needs an in-process generator, which this script's persistent,
 * `Math.random()`-driven state isn't.
 */
import type { SchemaMap, SchemaPayload } from "@counter-strike-2-gsi/types";

// Shared with the in-browser demo feed. The steamids here are the join key
// a future match.config.json could key off, so both mocks have to agree.
import { MOCK_MAP, MOCK_ROSTER, MOCK_TEAMS } from "../src/lib/mock-roster.ts";
import type { MockPlayerSeed } from "../src/lib/mock-roster.ts";

type RoundWins = NonNullable<SchemaMap["round_wins"]>;

const URL_ = process.env.GSI_URL ?? `http://localhost:${process.env.PORT ?? 3000}/gsi`;
const TICK_MS = 100;

/** Defuse time with a kit; every CT here carries one. */
const DEFUSE_SECONDS = 5;

/** How far into a live round the Ts start looking to plant. */
const PLANT_AFTER_MS = 12_000;

const RIFLES = [
  ["weapon_ak47", 30],
  ["weapon_m4a1_silencer", 25],
  ["weapon_awp", 5],
  ["weapon_famas", 25],
] as const;

interface MockPlayer {
  steamid: string;
  name: string;
  team: "CT" | "T";
  slot: number;
  health: number;
  armor: number;
  helmet: boolean;
  money: number;
  kills: number;
  deaths: number;
  assists: number;
  mvps: number;
  score: number;
  roundKills: number;
  rifle: string;
  clip: number;
  clipMax: number;
  reserve: number;
}

function makePlayer(seed: MockPlayerSeed): MockPlayer {
  const [rifle, clipMax] = RIFLES[seed.slot % RIFLES.length];

  return {
    steamid: seed.steamid,
    name: seed.name,
    team: seed.team,
    slot: seed.slot,
    health: 100,
    armor: 100,
    helmet: true,
    money: 4200,
    kills: 0,
    deaths: 0,
    assists: 0,
    mvps: 0,
    score: 0,
    roundKills: 0,
    rifle,
    clip: clipMax,
    clipMax,
    reserve: clipMax * 3,
  };
}

const players = MOCK_ROSTER.map(makePlayer);

/** The player the overlay treats as "you" — the `player` block. */
const self = players[0]!;

type Phase = "freezetime" | "live" | "over";

/**
 * Mirrors the `bomb.state` values a HUD branches on, so every one of
 * them — including the defuse and explode ends — is reachable without CS2
 * running. That is most of the point of this script.
 */
type BombState = "carried" | "planted" | "defusing" | "defused" | "exploded";

const state = {
  round: 1,
  ctScore: 0,
  tScore: 0,
  phase: "freezetime" as Phase,
  phaseEndsAt: Date.now() + 5_000,
  liveSince: 0,
  bomb: "carried" as BombState,
  bombPlantedAt: 0,
  defuseStartedAt: 0,
  roundWins: {} as RoundWins,
  winTeam: undefined as "CT" | "T" | undefined,
};

const ticking = () => state.bomb === "planted" || state.bomb === "defusing";

const rand = (n: number) => Math.floor(Math.random() * n);
const alive = (team: "CT" | "T") => players.filter((p) => p.team === team && p.health > 0);

function startRound() {
  state.phase = "freezetime";
  state.phaseEndsAt = Date.now() + 5_000;
  state.bomb = "carried";
  state.winTeam = undefined;

  for (const p of players) {
    p.health = 100;
    p.armor = rand(2) === 0 ? 0 : 100;
    p.helmet = p.armor > 0 && rand(3) !== 0;
    p.money = 800 + rand(12) * 700;
    p.roundKills = 0;
    p.clip = p.clipMax;
    p.reserve = p.clipMax * 3;
  }
}

/**
 * Takes the finished `round_wins` value rather than a winner plus a guess at
 * the reason: the schema's union is the closed set CS2 actually sends (there
 * is no `t_win_time` or `ct_win_bomb`), so passing it whole is what keeps the
 * result honest — a CT elimination with the bomb down is still an elimination.
 */
function endRound(result: NonNullable<RoundWins[string]>) {
  const winner = result.startsWith("ct_") ? "CT" : "T";

  state.phase = "over";
  state.phaseEndsAt = Date.now() + 4_000;
  state.winTeam = winner;

  if (winner === "CT") {
    state.ctScore += 1;
  } else {
    state.tScore += 1;
  }

  state.roundWins[String(state.round)] = result;
}

/** One tick of fake match simulation. */
function simulate() {
  const now = Date.now();

  if (state.phase === "freezetime" && now >= state.phaseEndsAt) {
    state.phase = "live";
    state.phaseEndsAt = now + 115_000;
    state.liveSince = now;

    return;
  }

  if (state.phase === "over" && now >= state.phaseEndsAt) {
    state.round += 1;

    startRound();

    return;
  }

  if (state.phase !== "live") {
    return;
  }

  // Plant window opens partway into the round, then lands within a few seconds
  // of it. Gated on elapsed time rather than on a flat per-tick roll: a roll
  // rare enough to look realistic meant the bomb hardly ever went down, which
  // left the timer, the fuse bar and the plant flash unreachable without real
  // CS2 — the one thing this script exists to avoid.
  if (
    state.bomb === "carried" &&
    alive("T").length > 0 &&
    now - state.liveSince > PLANT_AFTER_MS &&
    rand(30) === 0
  ) {
    state.bomb = "planted";
    state.bombPlantedAt = now;
  }

  const fuseLeft = 40 - (now - state.bombPlantedAt) / 1000;

  // A CT gets to the bomb somewhere in the fuse — mean ~25s, so most rounds
  // end in a defuse and a decent minority do not. The gate is "any time left"
  // rather than "enough time left" on purpose: a defuse started too late is
  // how the `exploded` branch gets reached, and a mock that only ever produces
  // the happy ending is a mock that never shows you the other one.
  if (state.bomb === "planted" && alive("CT").length > 0 && fuseLeft > 1) {
    if (rand(250) === 0) {
      state.bomb = "defusing";
      state.defuseStartedAt = now;
    }
  }

  if (state.bomb === "defusing" && alive("CT").length === 0) {
    state.bomb = "planted";
  }

  if (state.bomb === "defusing" && now - state.defuseStartedAt >= DEFUSE_SECONDS * 1000) {
    state.bomb = "defused";

    endRound("ct_win_defuse");

    return;
  }

  if (ticking() && fuseLeft <= 0) {
    state.bomb = "exploded";

    endRound("t_win_bomb");

    return;
  }

  // Damage: pick a random living player and chip them, occasionally fatally.
  //
  // The rate is set by the bomb rather than by taste. At ~27 damage every six
  // ticks, one side's 500 HP is gone in roughly 20s — the plant lands at 12s
  // and the last CT dies well before the 40s fuse, so the round can only ever
  // end `t_win_bomb_elimination`. One event every two seconds puts a wipe at
  // ~75s, which leaves the fuse room to decide the round instead.
  //
  // Only players whose enemies are still alive can be shot: with the Ts wiped
  // and the bomb down, the CTs were otherwise picked off one at a time by
  // nobody, which is both wrong and another way to lose the fuse.
  if (rand(20) === 0) {
    const living = players.filter(
      (p) => p.health > 0 && alive(p.team === "CT" ? "T" : "CT").length > 0,
    );
    const victim = living[rand(living.length)];

    if (victim) {
      victim.health = Math.max(0, victim.health - (5 + rand(45)));
      victim.armor = Math.max(0, victim.armor - rand(8));

      if (victim.health === 0) {
        victim.deaths += 1;

        const enemies = alive(victim.team === "CT" ? "T" : "CT");
        const killer = enemies[rand(enemies.length)];

        if (killer) {
          killer.kills += 1;
          killer.roundKills += 1;
          killer.score += 2;
          killer.money = Math.min(16_000, killer.money + 300);
        }
      }
    }
  }

  // Ammo burn on the observed player.
  if (self.health > 0 && rand(8) === 0) {
    if (self.clip === 0) {
      const take = Math.min(self.clipMax, self.reserve);

      self.clip = take;
      self.reserve -= take;
    } else {
      self.clip -= 1;
    }
  }

  if (alive("CT").length === 0) {
    // Wiping the CTs with the bomb already down is the one round CS2 records
    // differently from a plain elimination.
    endRound(ticking() ? "t_win_bomb_elimination" : "t_win_elimination");
  } else if (alive("T").length === 0 && !ticking()) {
    endRound("ct_win_elimination");
  } else if (now >= state.phaseEndsAt && !ticking()) {
    endRound("ct_win_time");
  }
}

function weaponsFor(p: MockPlayer) {
  return {
    weapon_0: {
      name: "weapon_knife",
      type: "Knife" as const,
      paintkit: "default",
      state: "holstered" as const,
    },
    weapon_1: {
      name: p.rifle,
      type: "Rifle" as const,
      paintkit: "default",
      state: "active" as const,
      ammo_clip: p.clip,
      ammo_clip_max: p.clipMax,
      ammo_reserve: p.reserve,
    },
  };
}

function stateFor(p: MockPlayer) {
  return {
    health: p.health,
    armor: p.armor,
    helmet: p.helmet,
    flashed: 0,
    smoked: 0,
    burning: 0,
    money: p.money,
    round_kills: p.roundKills,
    round_killhs: 0,
    equip_value: 3800,
    defuse_kit: p.team === "CT",
  };
}

function matchStatsFor(p: MockPlayer) {
  return {
    kills: p.kills,
    assists: p.assists,
    deaths: p.deaths,
    mvps: p.mvps,
    score: p.score,
  };
}

function secondsLeft() {
  return Math.max(0, (state.phaseEndsAt - Date.now()) / 1000).toFixed(1);
}

function buildPayload(): SchemaPayload {
  const allplayers: Record<string, unknown> = {};

  for (const p of players) {
    allplayers[p.steamid] = {
      name: p.name,
      observer_slot: p.slot,
      team: p.team,
      state: stateFor(p),
      weapons: weaponsFor(p),
      match_stats: matchStatsFor(p),
    };
  }

  // Only a live fuse has a countdown; a defused or exploded bomb keeps its
  // `state` for the rest of the round but stops carrying one, as CS2 does.
  //
  // Note this does *not* clear `bomb.countdown` in the merged state: the
  // server deep-merges and only prunes missing keys for the sparse collections
  // (`allplayers`, `grenades`, weapons), so a stale countdown from the last
  // plant survives into the next round. Read `bomb.state` first and treat the
  // countdown as meaningful only while it is `planted`/`defusing`, which is
  // what a real `BombTimer` does.
  const bombCountdown = ticking()
    ? Math.max(0, 40 - (Date.now() - state.bombPlantedAt) / 1000).toFixed(1)
    : undefined;

  const roundBomb =
    state.bomb === "defused" || state.bomb === "exploded"
      ? state.bomb
      : ticking()
        ? ("planted" as const)
        : undefined;

  return {
    provider: {
      name: "Counter-Strike 2",
      appid: 730,
      version: 14_100,
      steamid: self.steamid,
      timestamp: Math.floor(Date.now() / 1000),
    },
    map: {
      mode: "competitive",
      name: MOCK_MAP,
      phase: "live",
      round: state.round,
      team_ct: {
        name: MOCK_TEAMS.CT.name,
        score: state.ctScore,
        consecutive_round_losses: 0,
        timeouts_remaining: 1,
        matches_won_this_series: 0,
      },
      team_t: {
        name: MOCK_TEAMS.T.name,
        score: state.tScore,
        consecutive_round_losses: 0,
        timeouts_remaining: 1,
        matches_won_this_series: 0,
      },
      round_wins: state.roundWins,
      num_matches_to_win_series: 1,
      current_spectators: 0,
      souvenirs_total: 0,
    },
    round: {
      phase: state.phase,
      ...(roundBomb ? { bomb: roundBomb } : {}),
      ...(state.winTeam ? { win_team: state.winTeam } : {}),
    },
    bomb:
      state.bomb === "carried"
        ? {
            state: "carried" as const,
            player: players.find((p) => p.team === "T" && p.health > 0)?.steamid,
          }
        : {
            state: state.bomb,
            ...(bombCountdown === undefined ? {} : { countdown: bombCountdown }),
          },
    player: {
      steamid: self.steamid,
      name: self.name,
      activity: "playing",
      observer_slot: self.slot,
      team: self.team,
      state: stateFor(self),
      weapons: weaponsFor(self),
      match_stats: matchStatsFor(self),
    },
    phase_countdowns: {
      phase: state.phase === "live" && ticking() ? "bomb" : state.phase,
      phase_ends_in: bombCountdown ?? secondsLeft(),
    },
    allplayers: allplayers as SchemaPayload["allplayers"],
  };
}

let failed = false;

async function tick() {
  simulate();

  try {
    const res = await fetch(URL_, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildPayload()),
    });

    if (!res.ok) {
      console.error(`[mock] ${res.status} ${res.statusText}: ${await res.text()}`);
    }

    failed = false;
  } catch (err) {
    // The server going away shouldn't spam the terminal — log the first
    // failure of a streak and stay quiet until it recovers.
    if (!failed) {
      console.error(`[mock] cannot reach ${URL_}: ${(err as Error).message}`);
      console.error(`[mock]   is the server running? start it with: pnpm mock`);

      failed = true;
    }
  }
}

startRound();

console.log(`[mock] feeding ${URL_} every ${TICK_MS}ms — Ctrl+C to stop`);

setInterval(() => void tick(), TICK_MS);
