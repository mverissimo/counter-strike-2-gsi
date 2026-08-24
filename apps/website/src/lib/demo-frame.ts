import type { SchemaPayload } from "@counter-strike-2-gsi/types";

import { MOCK_MAP, MOCK_OBSERVED, MOCK_ROSTER, MOCK_TEAMS } from "./mock-roster.ts";

/**
 * A synthetic match, ported from `demo-source.ts` on
 * `feat/website-overlay-and-derive`. One `frame(tick)` generator, shared by
 * both mock transports (`installDemoSource`'s in-browser fake `EventSource`,
 * and `scripts/mock-server.ts`'s real HTTP+SSE server) — a single source of
 * truth rather than two simulations that can quietly drift apart.
 */

export const TICK_MS = 1000;

/** Freeze, live, planted, aftermath — one loop of the demo, in seconds. */
const FREEZE_SECONDS = 5;
const LIVE_SECONDS = 40;
const PLANT_SECONDS = 40;
const AFTERMATH_SECONDS = 5;
const LOOP_SECONDS = FREEZE_SECONDS + LIVE_SECONDS + PLANT_SECONDS + AFTERMATH_SECONDS;

const CT_WEAPONS = ["weapon_m4a1_silencer", "weapon_awp", "weapon_famas"];
const T_WEAPONS = ["weapon_ak47", "weapon_galilar", "weapon_awp"];

/**
 * Deterministic pseudo-random in [0, 1) — a demo that reshuffles its health
 * bars on every reload makes two runs impossible to compare.
 */
function noise(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;

  return x - Math.floor(x);
}

function makePlayer(
  entry: { name: string; team: "CT" | "T"; slot: number },
  tick: number,
  t: number,
) {
  const { name, team, slot } = entry;
  const seed = slot + (team === "CT" ? 0 : 5);

  // Both driven by `t` (seconds into the *current* 90s loop), not by the
  // ever-increasing tick counter: a value driven by raw `tick` saturates
  // after the demo's first lap and never moves again, which is exactly what
  // `wear` used to do here. `t` wrapping every round is what makes health
  // reset and kills start over each round without any special-casing.
  const roundElapsed = Math.max(0, t - FREEZE_SECONDS);
  const wear = Math.min(1, roundElapsed / LIVE_SECONDS);
  const drain = noise(seed) * 140 * wear;
  const health = Math.max(0, Math.round(100 - drain));

  // A kill roughly every 12s of round time, capped by a per-player ceiling
  // (1-3) so nobody racks up an implausible tally. Deterministic, like
  // everything else here — a reload shows the same match, not a reshuffled
  // one — and this is also what makes `player:killed` (see
  // `packages/server/src/utils/derived.ts`) fire at all against the mock:
  // it fires on `round_kills` increasing between two consecutive payloads,
  // which a flat per-seed noise value (the old formula) never did.
  const killCeiling = 1 + Math.floor(noise(seed + 10) * 3);
  const roundKills = Math.min(killCeiling, Math.floor(roundElapsed / 12));
  const roundHeadshots =
    roundKills > 0 ? Math.min(roundKills, Math.round(roundKills * noise(seed + 11))) : 0;

  const weapons = team === "CT" ? CT_WEAPONS : T_WEAPONS;
  const clipMax = 30;

  return {
    name,
    team,
    observer_slot: slot,
    state: {
      health,
      armor: health > 0 ? 92 : 0,
      helmet: seed % 2 === 0,
      flashed: 0,
      smoked: 0,
      burning: 0,
      money: 2400 + Math.round(noise(seed + 1) * 6000),
      round_kills: roundKills,
      round_killhs: roundHeadshots,
      equip_value: 4200,
    },
    match_stats: {
      kills: 4 + Math.round(noise(seed + 3) * 12),
      assists: Math.round(noise(seed + 4) * 5),
      deaths: 3 + Math.round(noise(seed + 5) * 10),
      mvps: Math.round(noise(seed + 6) * 3),
      score: 12 + Math.round(noise(seed + 7) * 20),
    },
    weapons: {
      weapon_0: {
        name: "weapon_knife",
        type: "Knife",
        paintkit: "default",
        state: "holstered",
      },
      weapon_1: {
        name: weapons[slot % weapons.length],
        type: "Rifle",
        paintkit: "default",
        state: "active",
        ammo_clip: Math.max(0, clipMax - Math.round(noise(seed + tick / 40) * clipMax)),
        ammo_clip_max: clipMax,
        ammo_reserve: 90,
      },
      ...(team === "T" && slot === 2
        ? {
            weapon_2: {
              name: "weapon_c4",
              type: "C4",
              paintkit: "default",
              state: "holstered",
            },
          }
        : {}),
    },
    position: `${1000 + slot * 40 + tick}.0, ${team === "CT" ? -500 : 500}.0, 64.0`,
  };
}

export function frame(tick: number): SchemaPayload {
  const t = ((tick * TICK_MS) / 1000) % LOOP_SECONDS;

  const planted = t >= FREEZE_SECONDS + LIVE_SECONDS && t < LOOP_SECONDS - AFTERMATH_SECONDS;
  const freeze = t < FREEZE_SECONDS;
  const over = t >= LOOP_SECONDS - AFTERMATH_SECONDS;

  const phase = freeze ? "freezetime" : over ? "over" : "live";

  // The bomb owns the clock once it is planted, same as CS2: `phase_ends_in`
  // stops mattering and `bomb.countdown` takes over.
  const endsIn = freeze
    ? FREEZE_SECONDS - t
    : planted
      ? 0
      : Math.max(0, FREEZE_SECONDS + LIVE_SECONDS - t);

  const allplayers: Record<string, ReturnType<typeof makePlayer>> = {};

  for (const entry of MOCK_ROSTER) {
    allplayers[entry.steamid] = makePlayer(entry, tick, t);
  }

  const observed = makePlayer(MOCK_OBSERVED, tick, t);

  return {
    provider: {
      name: "Counter-Strike 2",
      appid: 730,
      version: 14_100,
      steamid: MOCK_OBSERVED.steamid,
      timestamp: Math.floor(Date.now() / 1000),
    },
    map: {
      mode: "competitive",
      name: MOCK_MAP,
      phase: planted ? "live" : phase,
      round: 8,
      team_ct: {
        name: MOCK_TEAMS.CT.name,
        score: 4,
        consecutive_round_losses: 0,
        timeouts_remaining: 1,
        matches_won_this_series: 0,
      },
      team_t: {
        name: MOCK_TEAMS.T.name,
        score: 3,
        consecutive_round_losses: 1,
        timeouts_remaining: 1,
        matches_won_this_series: 0,
      },
      num_matches_to_win_series: 1,
    },
    round: {
      phase: planted ? "live" : phase,
      ...(planted ? { bomb: "planted" } : {}),
    },
    phase_countdowns: {
      phase: planted ? "bomb" : phase,
      phase_ends_in: endsIn.toFixed(1),
    },
    player: {
      steamid: MOCK_OBSERVED.steamid,
      ...observed,
    },
    allplayers,
    ...(planted
      ? {
          bomb: {
            state: "planted",
            countdown: Math.max(0, PLANT_SECONDS - (t - FREEZE_SECONDS - LIVE_SECONDS)).toFixed(1),
          },
        }
      : {}),
  } as SchemaPayload;
}
