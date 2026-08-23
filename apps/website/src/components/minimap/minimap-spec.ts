import type { SpecNode } from "../../hud/spec/types.ts";

export interface MinimapData {
  position?: string;
}

/**
 * A real radar (dots on a map image) needs per-map calibration data this
 * project doesn't have yet — this is a placeholder that surfaces the same
 * `player:position` GSI value as plain text, so the catalog slot exists and
 * is real-data-bound even before the radar rendering is built.
 */
const ROOT_ID = "minimap";

/** Child ids are namespaced under `${ROOT_ID}:` — see the note in `player-card-spec.ts`. */
export function minimapSpec(data: MinimapData): SpecNode {
  return {
    id: ROOT_ID,
    type: "Stack",
    props: { direction: "column", gap: 2 },
    style: {
      background: "#0c0e14",
      border: "1px solid #23262f",
      borderRadius: 4,
      padding: 8,
      width: 128,
    },
    children: [
      {
        id: `${ROOT_ID}:label`,
        type: "Text",
        props: { value: "Posição", size: 9, color: "#565a66" },
      },
      {
        id: `${ROOT_ID}:value`,
        type: "Text",
        props: { value: data.position ?? "—", size: 11, color: "#9199a8" },
        gsi: ["player:position"],
      },
    ],
  };
}
