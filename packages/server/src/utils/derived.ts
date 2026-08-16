import { FLATTENED_KEYS } from "@counter-strike-2-gsi/types";
import type { EventMap, SchemaPayload } from "@counter-strike-2-gsi/types";

/**
 * High-level events computed from a state transition rather than read
 * directly off a diff path. Where `"player:state:health"` reports a value,
 * these report a milestone — round over, bomb planted, a kill, roster
 * churn — the way a HUD actually thinks about a match.
 *
 * Kept as a hand-picked list rather than generated: unlike granular events,
 * there's no mechanical way to derive "this is a moment worth naming" from
 * the schema shape alone.
 */
export type DerivedEventName =
  | "round:started"
  | "round:ended"
  | "bomb:planted"
  | "bomb:defused"
  | "bomb:exploded"
  | "player:died"
  | "player:killed"
  | "allplayers:joined"
  | "allplayers:left";

export interface DerivedEvent<E extends DerivedEventName = DerivedEventName> {
  event: E;
  payload: EventMap[E];
}

const FLATTENED = new Set<string>(FLATTENED_KEYS);

/**
 * The SteamIDs in a roster, minus the flattened bookkeeping keys.
 *
 * CS2 puts `allplayers.custom` in the same object as the players, so a plain
 * `Object.keys` reports a phantom `"custom"` join the first time roster
 * churn arrives and a phantom leave when it stops.
 */
function rosterIds(roster: SchemaPayload["allplayers"]): Set<string> {
  const ids = new Set<string>();

  for (const key in roster) {
    if (!FLATTENED.has(key)) {
      ids.add(key);
    }
  }

  return ids;
}

/**
 * `"allplayers:joined"` / `"allplayers:left"` from SteamID set differences.
 *
 * Deliberately **level-triggered**, unlike the milestone events below: a
 * cold start with an already-populated roster (a HUD attaching mid-match)
 * reports every current SteamID as `"joined"` rather than staying silent
 * until the next roster change, so a scoreboard can be seeded from the very
 * first payload. This is why {@link deriveEvents} runs roster derivation
 * before its cold-start guard.
 */
function deriveRosterEvents(previous: SchemaPayload, current: SchemaPayload): DerivedEvent[] {
  const events: DerivedEvent[] = [];

  const prevSteamIDs = rosterIds(previous.allplayers);
  const currSteamIDs = rosterIds(current.allplayers);

  const joined = [...currSteamIDs].filter((id) => !prevSteamIDs.has(id));
  const left = [...prevSteamIDs].filter((id) => !currSteamIDs.has(id));

  if (joined.length > 0) {
    events.push({
      event: "allplayers:joined",
      payload: { previous: undefined, current: joined },
    });
  }

  if (left.length > 0) {
    events.push({
      event: "allplayers:left",
      payload: { previous: undefined, current: left },
    });
  }

  return events;
}

/**
 * Computes the derived events a state transition crosses: roster churn
 * first, then round/bomb/player milestones. Pure and diff-free — every check
 * is a handful of property reads, so this runs unconditionally on every
 * update regardless of change-detection mode or subscriptions.
 *
 * **Cold start.** `previous` empty (`{}`) means there is nothing to
 * transition *from* — the manager was just constructed or just `reset()`,
 * and the next payload is an initial snapshot, not a transition. The
 * round/bomb/player milestones below don't fire off that first payload, even
 * if it already reports `round.phase: "live"` or `bomb.state: "planted"`:
 * those are facts about the current state, not something that happened on
 * this tick. Roster events are the deliberate exception — see
 * {@link deriveRosterEvents}.
 *
 * **Milestone detection is edge-triggered and best-effort.** Each fires
 * once, on the tick where the watched field first reaches its target value,
 * and does not require the field to have existed on the previous tick — a
 * `bomb` block appearing already `"planted"` (e.g. GSI/component just
 * enabled, or a heartbeat was skipped over the intermediate state) still
 * fires `"bomb:planted"`, since from this manager's point of view that's the
 * first moment the fact became true. Reported as a real transition, not a
 * replay.
 *
 * **`player:killed` / `player:died` are scoped to the currently-observed
 * `player` block**, not the `allplayers` roster — the same block
 * `"player:state:health"` reads from. They fire only while consecutive
 * payloads report the *same* `steamid`, so switching observed target (a
 * spectator changing POV) is one player's stats being replaced by another's,
 * never a kill. For roster-wide kill/death tracking, subscribe to
 * `"allplayers:<steamid>:state:health"` directly.
 */
export function deriveEvents(previous: SchemaPayload, current: SchemaPayload): DerivedEvent[] {
  const events: DerivedEvent[] = deriveRosterEvents(previous, current);

  if (Object.keys(previous).length === 0) {
    return events;
  }

  const prevRound = previous.round;
  const currRound = current.round;

  if (prevRound?.phase !== "live" && currRound?.phase === "live") {
    events.push({
      event: "round:started",
      payload: { round: current.map?.round },
    });
  }

  if (prevRound?.phase !== "over" && currRound?.phase === "over") {
    events.push({
      event: "round:ended",
      payload: {
        winner: currRound?.win_team,
        bomb: currRound?.bomb,
        round: current.map?.round,
      },
    });
  }

  const prevBomb = previous.bomb;
  const currBomb = current.bomb;

  if (prevBomb?.state !== "planted" && currBomb?.state === "planted") {
    events.push({
      event: "bomb:planted",
      payload: { player: currBomb?.player, countdown: currBomb?.countdown },
    });
  }

  if (prevBomb?.state !== "defused" && currBomb?.state === "defused") {
    events.push({
      event: "bomb:defused",
      payload: { player: currBomb?.player },
    });
  }

  if (prevBomb?.state !== "exploded" && currBomb?.state === "exploded") {
    events.push({
      event: "bomb:exploded",
      payload: { position: currBomb?.position },
    });
  }

  const prevPlayer = previous.player;
  const currPlayer = current.player;

  const samePlayer =
    prevPlayer !== undefined &&
    currPlayer !== undefined &&
    prevPlayer.steamid !== undefined &&
    prevPlayer.steamid === currPlayer.steamid;

  if (samePlayer) {
    const prevHealth = prevPlayer.state?.health;
    const currHealth = currPlayer.state?.health;

    if (prevHealth !== undefined && prevHealth > 0 && currHealth === 0) {
      events.push({
        event: "player:died",
        payload: { steamid: currPlayer.steamid, name: currPlayer.name },
      });
    }

    const prevKills = prevPlayer.state?.round_kills;
    const currKills = currPlayer.state?.round_kills;

    if (prevKills !== undefined && currKills !== undefined) {
      const prevHeadshots = prevPlayer.state?.round_killhs ?? 0;
      const currHeadshots = currPlayer.state?.round_killhs ?? 0;

      // `round_kills` is CS2's own per-round counter: it only ever resets to
      // 0 on a new round, never decreases otherwise. A drop therefore means
      // the round rolled over between these two payloads — and if a
      // heartbeat got skipped over the boundary, this same tick can already
      // carry the new round's first kill, with no valid baseline to diff
      // against (`prevKills` describes a round that no longer applies).
      // Treat the post-reset count itself as the tally for a kill this tick.
      const roundReset = currKills < prevKills;
      const kills = roundReset ? currKills : currKills - prevKills;

      if (kills > 0) {
        const headshots = roundReset ? currHeadshots : Math.max(0, currHeadshots - prevHeadshots);

        events.push({
          event: "player:killed",
          payload: {
            steamid: currPlayer.steamid,
            name: currPlayer.name,
            kills,
            headshots,
            round_kills: currKills,
          },
        });
      }
    }
  }

  return events;
}
