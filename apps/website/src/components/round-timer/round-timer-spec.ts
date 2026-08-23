import type { SpecNode } from "../../hud/spec/types.ts";

export interface RoundTimerData {
  scoreCt: number;
  scoreT: number;
  phase: string;
  countdown?: string;
}

function chip(id: string, value: number, background: string, gsi: string): SpecNode {
  return {
    id,
    type: "Stack",
    props: { align: "center", justify: "center" },
    style: { width: 36, background, padding: "6px 0" },
    gsi: [gsi],
    children: [
      {
        id: `${id}-value`,
        type: "Text",
        props: { value, size: 16, weight: 700, color: "#fff" },
        gsi: [gsi],
      },
    ],
  };
}

const ROOT_ID = "round-timer";

/** Child ids are namespaced under `${ROOT_ID}:` — see the note in `player-card-spec.ts`. */
export function roundTimerSpec(data: RoundTimerData): SpecNode {
  return {
    id: ROOT_ID,
    type: "Stack",
    props: { direction: "row", align: "stretch" },
    children: [
      chip(`${ROOT_ID}:score-ct`, data.scoreCt, "#2b5fa8", "map:team_ct:score"),
      {
        id: `${ROOT_ID}:center`,
        type: "Stack",
        props: { direction: "column", align: "center", justify: "center", gap: 2 },
        style: {
          padding: "0 12px",
          borderTop: "1px solid #22d3ee",
          borderBottom: "1px solid #22d3ee",
          background: "#10121a",
        },
        children: [
          {
            id: `${ROOT_ID}:phase`,
            type: "Text",
            props: { value: data.phase, size: 9, color: "#7d818c" },
            gsi: ["map:phase"],
          },
          {
            id: `${ROOT_ID}:countdown`,
            type: "Text",
            props: { value: data.countdown ?? "—", size: 15, weight: 700, color: "#22d3ee" },
            gsi: ["phase_countdowns:phase_ends_in"],
          },
        ],
      },
      chip(`${ROOT_ID}:score-t`, data.scoreT, "#b0501f", "map:team_t:score"),
    ],
  };
}
