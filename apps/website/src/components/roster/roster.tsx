import { memo } from "react";

import { healthState } from "../../lib/derive.ts";
import type { RosterEntry, Team } from "../../lib/derive.ts";
import { StatBar } from "../stat-bar/stat-bar.tsx";
import styles from "./roster.module.css";

interface RosterProps {
  team: Team;
  side: "left" | "right";
  players: RosterEntry[];
}

/**
 * `players` is a new array on every tick, so the default shallow compare would
 * never bail out. Comparing the fields that are actually drawn is cheap at ten
 * rows and stops the whole column re-rendering when something unrelated (a
 * position, a grenade) moves in the payload.
 */
function sameRoster(prev: RosterProps, next: RosterProps) {
  if (prev.team !== next.team || prev.side !== next.side) {
    return false;
  }

  if (prev.players.length !== next.players.length) {
    return false;
  }

  return prev.players.every((p, i) => {
    const n = next.players[i];

    return (
      p.steamid === n.steamid &&
      p.name === n.name &&
      p.health === n.health &&
      p.armor === n.armor &&
      p.kills === n.kills &&
      p.deaths === n.deaths &&
      p.assists === n.assists &&
      p.hasBomb === n.hasBomb
    );
  });
}

export const Roster = memo(function Roster(props: RosterProps) {
  const { team, side, players } = props;

  if (players.length === 0) {
    return null;
  }

  return (
    <div className={styles.root} data-side={side} data-team={team}>
      {players.map((player) => (
        <div key={player.steamid} className={styles.row} data-alive={player.alive}>
          <span className={styles.name}>
            {player.hasBomb && <span className={styles.bomb} />}
            {player.name}
          </span>
          <span className={styles.stats}>
            {player.kills}/{player.deaths}/{player.assists}
          </span>
          <div className={styles.bar}>
            <StatBar
              value={player.health}
              tone="health"
              state={healthState(player.health)}
              height="0.25rem"
            />
          </div>
        </div>
      ))}
    </div>
  );
}, sameRoster);
