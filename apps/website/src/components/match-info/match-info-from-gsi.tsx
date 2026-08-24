import { useGSIEvent, useGSIState } from "@counter-strike-2-gsi/client";
import type { SchemaAllPlayers, SchemaPlayer } from "@counter-strike-2-gsi/types";
import type { CSSProperties } from "react";

import { findActiveWeapon } from "../../lib/find-active-weapon.ts";
import { applyOverrides } from "../../hud/spec/apply-overrides.ts";
import type { SpecOverrides } from "../../hud/spec/apply-overrides.ts";
import { SpecRenderer } from "../../hud/spec/spec-renderer.tsx";
import type { SpecNode } from "../../hud/spec/types.ts";
import { matchInfoSpec } from "./match-info-spec.ts";

/**
 * Scores and team names only change a handful of times a match, so
 * `useGSIState()` is the right fit; the countdown changes almost every
 * tick, so it's the one field pulled from the granular `useGSIEvent` hook.
 */
export function useMatchInfoSpec(): SpecNode | undefined {
  const map = useGSIState()?.map;
  const countdown = useGSIEvent("phase_countdowns:phase_ends_in");

  if (!map) {
    return undefined;
  }

  return matchInfoSpec({
    scoreCt: map.team_ct.score,
    scoreT: map.team_t.score,
    teamCtName: map.team_ct.name,
    teamTName: map.team_t.name,
    phase: map.phase,
    countdown,
  });
}

type Entry = [steamid: string, player: SchemaPlayer];

const ROSTER_COLOR: Record<"CT" | "T", string> = {
  CT: "#6ba4d8",
  T: "#d9a441",
};

function byScore(a: Entry, b: Entry) {
  return (b[1].match_stats?.score ?? 0) - (a[1].match_stats?.score ?? 0);
}

/**
 * A literal port of the real `<table>` markup from the stashed
 * `apps/example/src/views/components/scoreboard.tsx` (`git show
 * stash@{4}:apps/example/src/views/components/scoreboard.tsx`) — kept as a
 * plain component rather than rebuilt out of `Stack`/`Text` spec nodes,
 * since a genuine table (a real header row, `border-collapse`, per-column
 * alignment) isn't something the headless primitives can express, and
 * reinventing one out of them just to stay "on-spec" produced a worse-looking
 * scoreboard than just keeping the table. Not part of the spec tree, so
 * it isn't selectable/overridable in the editor, same as it wasn't in
 * `apps/example` either.
 */
function RosterTable(props: { team: "CT" | "T"; players: Entry[] }) {
  const { team, players } = props;

  return (
    <div>
      <h3 style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: ROSTER_COLOR[team] }}>
        {team === "CT" ? "Counter-Terrorists" : "Terrorists"}
      </h3>

      <table
        style={{ width: "100%", borderCollapse: "collapse", fontVariantNumeric: "tabular-nums" }}
      >
        <thead>
          <tr>
            {["Player", "HP", "Weapon", "K", "A", "D", "$"].map((label, i) => (
              <th
                key={label}
                style={{
                  textAlign: i === 0 ? "left" : "right",
                  fontSize: 11,
                  fontWeight: 500,
                  color: "#8b949e",
                  padding: "4px 6px",
                  borderBottom: "1px solid #2a323d",
                }}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map(([steamid, player]) => {
            const health = player.state?.health ?? 0;
            const weapon = findActiveWeapon(player.weapons)?.name.replace(/^weapon_/, "");
            const td: CSSProperties = {
              textAlign: "right",
              padding: "5px 6px",
              borderBottom: "1px solid #1c232c",
            };

            return (
              <tr key={steamid} style={{ opacity: health === 0 ? 0.4 : 1 }}>
                <td
                  style={{
                    ...td,
                    textAlign: "left",
                    fontWeight: 500,
                    maxWidth: 180,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {player.name ?? steamid}
                </td>
                <td style={td}>{health}</td>
                <td style={{ ...td, color: "#8b949e" }}>{weapon ?? "—"}</td>
                <td style={td}>{player.match_stats?.kills ?? 0}</td>
                <td style={td}>{player.match_stats?.assists ?? 0}</td>
                <td style={td}>{player.match_stats?.deaths ?? 0}</td>
                <td style={td}>${player.state?.money ?? 0}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * `allplayers` only arrives while spectating or watching a demo (CS2 never
 * hands a live player the enemy team's state) — same ceiling the stashed
 * version documented. `custom` on the same object is join/leave bookkeeping,
 * not a player, so it's filtered out before splitting into CT/T.
 */
function Roster() {
  const allplayers: SchemaAllPlayers | undefined = useGSIState()?.allplayers;

  const entries = Object.entries(allplayers ?? {}).filter(
    (entry): entry is Entry => entry[0] !== "custom",
  );

  if (entries.length === 0) {
    return (
      <p style={{ margin: 0, padding: "8px 10px", color: "#8b949e", lineHeight: 1.5 }}>
        Sem dados de roster —{" "}
        <code style={{ background: "#1c232c", padding: "1px 4px", borderRadius: 3 }}>
          allplayers
        </code>{" "}
        só chega enquanto você observa (espectador) ou assiste a uma demo.
      </p>
    );
  }

  const ct = entries.filter(([, player]) => player.team === "CT").sort(byScore);
  const t = entries.filter(([, player]) => player.team === "T").sort(byScore);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "10px 4px" }}>
      <RosterTable team="CT" players={ct} />
      <RosterTable team="T" players={t} />
    </div>
  );
}

export function MatchInfoFromGSI(props: {
  overrides?: SpecOverrides;
  selectedId?: string;
  onSelectNode?: (id: string) => void;
}) {
  const spec = useMatchInfoSpec();

  if (!spec) {
    return <p style={{ color: "#565a66", fontSize: 12 }}>Sem partida em andamento.</p>;
  }

  return (
    <div>
      <SpecRenderer
        node={props.overrides ? applyOverrides(spec, props.overrides) : spec}
        selectedId={props.selectedId}
        onSelectNode={props.onSelectNode}
      />
      <Roster />
    </div>
  );
}
