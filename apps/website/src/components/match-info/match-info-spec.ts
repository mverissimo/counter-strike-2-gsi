import type { SpecNode } from "../../hud/spec/types.ts";

export interface MatchInfoData {
  scoreCt: number;
  scoreT: number;
  teamCtName?: string;
  teamTName?: string;
  phase: string;
  countdown?: string;
}

const TEAM_COLOR: Record<"CT" | "T", string> = {
  CT: "#2b5fa8",
  T: "#b0501f",
};

const ROOT_ID = "match-info";
const SCOPE = "match-info";

function teamNode(id: string, name: string, team: "CT" | "T", gsi: string): SpecNode {
  return {
    id,
    type: "Stack",
    props: { direction: "row", align: "center", gap: 6 },
    data: { scope: SCOPE, part: "team", team: team.toLowerCase() },
    children: [
      {
        id: `${id}:avatar`,
        type: "Avatar",
        props: { initial: name.slice(0, 1).toUpperCase(), color: TEAM_COLOR[team], size: 24 },
        gsi: [gsi],
        data: { scope: SCOPE, part: "team-avatar", team: team.toLowerCase() },
      },
      {
        id: `${id}:name`,
        type: "Text",
        props: { value: name, size: 11, weight: 700, color: "#dfe1e6" },
        gsi: [gsi],
        data: { scope: SCOPE, part: "team-name", team: team.toLowerCase() },
      },
    ],
  };
}

function scoreChip(id: string, value: number, team: "CT" | "T", gsi: string): SpecNode {
  return {
    id,
    type: "Stack",
    props: { align: "center", justify: "center" },
    style: { width: 32, background: TEAM_COLOR[team], padding: "6px 0" },
    gsi: [gsi],
    data: { scope: SCOPE, part: "score", team: team.toLowerCase() },
    children: [
      {
        id: `${id}:value`,
        type: "Text",
        props: { value, size: 15, weight: 700, color: "#fff" },
        gsi: [gsi],
        data: { scope: SCOPE, part: "score-value", team: team.toLowerCase() },
      },
    ],
  };
}

/**
 * Team names/scores flanking the round phase/countdown — what's left of the
 * old `scoreboard-spec.ts` once the map tabs (`map-rotation-spec.ts`) and
 * the sponsor slot (`sponsors-spec.ts`) were split out into their own
 * catalog entries. Child ids are namespaced under `${ROOT_ID}:` — see the
 * note in `player-card-spec.ts` — and every node carries the same
 * `data-scope`/`data-part` pair, `data-team` on the per-team nodes, and
 * `data-state` (mirroring `map:phase`) on the center block.
 */
export function matchInfoSpec(data: MatchInfoData): SpecNode {
  return {
    id: ROOT_ID,
    type: "Stack",
    props: { direction: "row", align: "center", gap: 10 },
    style: { background: "#10121a", border: "1px solid #23262f", padding: "0 4px" },
    data: { scope: SCOPE, part: "root" },
    children: [
      teamNode(`${ROOT_ID}:team-ct`, data.teamCtName ?? "CT", "CT", "map:team_ct:name"),
      scoreChip(`${ROOT_ID}:score-ct`, data.scoreCt, "CT", "map:team_ct:score"),
      {
        id: `${ROOT_ID}:center`,
        type: "Stack",
        props: { direction: "column", align: "center", justify: "center", gap: 2 },
        style: { padding: "0 12px" },
        data: { scope: SCOPE, part: "center", state: data.phase },
        children: [
          {
            id: `${ROOT_ID}:phase`,
            type: "Text",
            props: { value: data.phase, size: 9, color: "#7d818c" },
            gsi: ["map:phase"],
            data: { scope: SCOPE, part: "phase" },
          },
          {
            id: `${ROOT_ID}:countdown`,
            type: "Text",
            props: { value: data.countdown ?? "—", size: 15, weight: 700, color: "#22d3ee" },
            gsi: ["phase_countdowns:phase_ends_in"],
            data: { scope: SCOPE, part: "countdown" },
          },
        ],
      },
      scoreChip(`${ROOT_ID}:score-t`, data.scoreT, "T", "map:team_t:score"),
      teamNode(`${ROOT_ID}:team-t`, data.teamTName ?? "T", "T", "map:team_t:name"),
    ],
  };
}
