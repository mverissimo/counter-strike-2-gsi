import { useGSIState } from "@counter-strike-2-gsi/client";

import { BombTimer } from "./components/bomb-timer/bomb-timer.tsx";
import { Connection } from "./components/connection/connection.tsx";
import { PlayerPanel } from "./components/player-panel/player-panel.tsx";
import { Roster } from "./components/roster/roster.tsx";
import { RoundHistory } from "./components/round-history/round-history.tsx";
import { Scoreboard } from "./components/scoreboard/scoreboard.tsx";
import { heldWeapon, parseSeconds } from "@counter-strike-2-gsi/types/derive";

import { rosters } from "./lib/derive.ts";
import styles from "./overlay.module.css";

/** Read once — this component re-renders on every tick. */
const DEBUG = new URLSearchParams(window.location.search).has("debug");

/**
 * Reads the merged snapshot once and hands each widget the primitives it
 * draws.
 *
 * Why the snapshot and not a granular subscription per field: a granular event
 * fires only when its path *changes*, and this page is loaded mid-match — OBS
 * starts the browser source whenever the scene loads, long after the map name
 * or the team names last moved. `"update"` is also what the SSE handler
 * replays to a new connection, so building from it is what makes the overlay
 * paint on the first frame rather than filling in field by field.
 *
 * The cost is that this component re-renders on every tick (~10 Hz with CS2's
 * default 0.1s throttle). That is one function body and a handful of `memo`
 * comparisons; every widget below bails out unless a value it actually shows
 * has moved. Granular events are still the right tool for *transitions* —
 * `BombTimer` uses one — they're just the wrong tool for painting state.
 */
export function Overlay() {
  const state = useGSIState();

  const map = state?.map;
  const player = state?.player;
  const allplayers = state?.allplayers;

  const { ct: ctRoster, t: tRoster } = rosters(allplayers);

  const weapon = heldWeapon(player?.weapons);
  const hasData = state !== undefined && map !== undefined;

  // Floored here rather than in `Scoreboard`: the payload's tenths would defeat
  // its `memo` on nine ticks in ten.
  const endsIn = parseSeconds(state?.phase_countdowns?.phase_ends_in);
  const phaseEndsIn = endsIn === undefined ? undefined : Math.floor(endsIn);

  return (
    <div className={styles.canvas} data-debug={DEBUG}>
      <Connection hasData={hasData} />

      {map && (
        <>
          <Scoreboard
            ctName={map.team_ct.name ?? "Counter-Terrorists"}
            ctScore={map.team_ct.score}
            tName={map.team_t.name ?? "Terrorists"}
            tScore={map.team_t.score}
            round={map.round}
            mapName={map.name}
            phase={state.phase_countdowns?.phase ?? state.round?.phase ?? map.phase}
            phaseEndsIn={phaseEndsIn}
          />

          <div className={styles.history}>
            <RoundHistory roundWins={map.round_wins} />
          </div>
        </>
      )}

      <Roster team="CT" side="left" players={ctRoster} />
      <Roster team="T" side="right" players={tRoster} />

      <BombTimer state={state?.bomb?.state} countdown={state?.bomb?.countdown} />

      {player?.state && (
        <PlayerPanel
          name={player.name ?? "unknown"}
          team={player.team}
          health={player.state.health}
          armor={player.state.armor}
          helmet={player.state.helmet}
          money={player.state.money}
          roundKills={player.state.round_kills}
          hasDefuseKit={player.state.defuse_kit ?? false}
          weaponName={weapon?.name}
          ammoClip={weapon?.ammo_clip}
          ammoClipMax={weapon?.ammo_clip_max}
          ammoReserve={weapon?.ammo_reserve}
        />
      )}
    </div>
  );
}
