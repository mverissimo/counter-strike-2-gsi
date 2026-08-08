/**
 * Readers for the parts of a GSI payload whose shape is easy to read wrong.
 *
 * Everything here is a *rule about the schema*, not a presentation choice —
 * which is the line that decides what belongs. `heldWeapon` encodes which
 * weapon states mean "in hand"; it does not decide how to render the name.
 * A helper that picks fields, formats a string, or sets a threshold is taste,
 * belongs in the consuming app, and should not be added here.
 *
 * Pure functions over `SchemaPayload` sub-trees: no React, no DOM, no runtime
 * assumptions, so a browser overlay and a Node bot can both use them.
 */
import type { SchemaAllPlayers, SchemaPlayer } from "../schema";

export type PlayerEntry = [steamid: string, player: SchemaPlayer];

/**
 * Orders players the way CS2 itself does: by `observer_slot`, the same 1-9 the
 * game binds to the number keys, with SteamID breaking ties.
 *
 * This is not a display preference. Key order in `allplayers` is not stable
 * between ticks, so rendering in payload order makes rows swap places at
 * random; and ordering on anything that moves during a round — health, kills,
 * money — makes them jump exactly when someone is reading them. Players
 * without a slot (spectators, casters) sort last.
 */
function bySlot([aId, a]: PlayerEntry, [bId, b]: PlayerEntry) {
  return (a.observer_slot ?? 99) - (b.observer_slot ?? 99) || aId.localeCompare(bId);
}

/**
 * Every real player in `allplayers`, as `[steamid, player]` pairs, in a stable
 * order.
 *
 * `allplayers` is keyed by SteamID **except** for `custom`, which holds the
 * roster-change bookkeeping the server reads to compute
 * `"allplayers:joined"` / `"allplayers:left"`. It is a sibling of the players,
 * not one of them, so `Object.entries(allplayers)` yields an extra entry with
 * no name, no team and no health — an eleventh player that renders as a blank
 * row and skews any count or average taken over the roster.
 *
 * Returns entries rather than a filtered object so nothing is copied and the
 * result destructures like `Object.entries`. See {@link bySlot} for why the
 * order is fixed rather than left to the caller.
 *
 * @example
 * ```ts
 * for (const [steamid, player] of players(state.allplayers)) {
 *   console.log(steamid, player.state?.health);
 * }
 * ```
 */
export function players(allplayers: SchemaAllPlayers | undefined): PlayerEntry[] {
  if (!allplayers) {
    return [];
  }

  const entries: PlayerEntry[] = [];

  for (const [steamid, player] of Object.entries(allplayers)) {
    if (steamid === "custom") {
      continue;
    }

    entries.push([steamid, player as SchemaPlayer]);
  }

  return entries.sort(bySlot);
}

/**
 * Whether this player is carrying the C4.
 *
 * The bomb is an ordinary entry in `weapons` under the name `weapon_c4`, and
 * its `state` is irrelevant — a T holding a rifle still has the bomb, it is
 * merely holstered. There is no flag anywhere else in the payload that says
 * who is carrying it, so this name is the only way to find out.
 */
export function carriesBomb(weapons: SchemaPlayer["weapons"]) {
  if (!weapons) {
    return false;
  }

  return Object.values(weapons).some((weapon) => weapon.name === "weapon_c4");
}

/**
 * The weapon currently in hand, or `undefined` when the payload carries none.
 *
 * A weapon is `"active" | "holstered" | "reloading"`, and **both** `"active"`
 * and `"reloading"` mean it is being held: CS2 flips the state for the
 * duration of the reload animation, during which no weapon reports
 * `"active"`. Matching only `"active"` makes the weapon vanish from a HUD on
 * every reload — exactly when a player is looking at their ammo.
 */
export function heldWeapon(weapons: SchemaPlayer["weapons"]) {
  if (!weapons) {
    return undefined;
  }

  return Object.values(weapons).find(
    (weapon) => weapon.state === "active" || weapon.state === "reloading",
  );
}

/**
 * Parses one of CS2's countdown fields into a number of seconds.
 *
 * Every countdown in the payload — `bomb.countdown`,
 * `phase_countdowns.phase_ends_in` — is a *string* ("1.9", "94.7"), and the
 * ones that matter are optional: the bomb has no countdown until it is
 * planted. Returns `undefined` rather than `NaN` for anything absent or
 * unparseable, so a missing value can't leak into arithmetic and surface as
 * `NaN` several layers away.
 */
export function parseSeconds(countdown: string | undefined): number | undefined {
  if (countdown === undefined) {
    return undefined;
  }

  const parsed = Number.parseFloat(countdown);

  return Number.isFinite(parsed) ? parsed : undefined;
}
