import { carriesBomb, players } from "@counter-strike-2-gsi/types/derive";
import type { SchemaAllPlayers } from "@counter-strike-2-gsi/types";

/**
 * Projections that are specific to *this* overlay.
 *
 * Anything the game gets a vote on lives in
 * `@counter-strike-2-gsi/types/derive`: skipping the `custom` block, ordering
 * by `observer_slot`, knowing the C4 is `weapon_c4`, knowing a reloading
 * weapon is still held. Those can be wrong, and a test can prove it.
 *
 * What stays here can only ever be a preference — which fields a roster row
 * shows, where "low health" begins. A radar or a stats page would want a
 * different shape, which is exactly why `RosterEntry` is not in the library.
 */
export type Team = "CT" | "T";

export interface RosterEntry {
  steamid: string;
  name: string;
  team: Team;
  slot: number;
  health: number;
  armor: number;
  helmet: boolean;
  money: number;
  kills: number;
  deaths: number;
  assists: number;
  alive: boolean;
  hasBomb: boolean;
}

export interface Rosters {
  ct: RosterEntry[];
  t: RosterEntry[];
}

/**
 * Flattens `allplayers` into the roster rows this overlay draws, both sides in
 * one pass — `players()` walks *and sorts* the whole roster, so a call per team
 * pays for that twice a tick and discards half of each result.
 *
 * No sort here: `players()` already returns a stable `observer_slot` order,
 * and that ordering rule belongs to the payload rather than to this component.
 */
export function rosters(allplayers: SchemaAllPlayers | undefined): Rosters {
  const ct: RosterEntry[] = [];
  const t: RosterEntry[] = [];

  // `players()` is what keeps the `custom` block out of the roster.
  for (const [steamid, p] of players(allplayers)) {
    const team = p.team;

    if (team !== "CT" && team !== "T") {
      continue;
    }

    (team === "CT" ? ct : t).push({
      steamid,
      name: p.name ?? "unknown",
      team,
      slot: p.observer_slot ?? 99,
      health: p.state?.health ?? 0,
      armor: p.state?.armor ?? 0,
      helmet: p.state?.helmet ?? false,
      money: p.state?.money ?? 0,
      kills: p.match_stats?.kills ?? 0,
      deaths: p.match_stats?.deaths ?? 0,
      assists: p.match_stats?.assists ?? 0,
      alive: (p.state?.health ?? 0) > 0,
      hasBomb: carriesBomb(p.weapons),
    });
  }

  return {
    ct,
    t,
  };
}

/**
 * Health thresholds, in one place because three components colour on them and
 * a HUD that disagrees with itself about what "low" means is worse than one
 * that picks the wrong number.
 */
export function healthState(health: number): HealthState {
  if (health <= 0) {
    return "dead";
  }

  if (health <= 25) {
    return "critical";
  }

  if (health <= 60) {
    return "low";
  }

  return "ok";
}

export type HealthState = "dead" | "critical" | "low" | "ok";
