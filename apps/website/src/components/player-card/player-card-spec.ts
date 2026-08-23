import type { SpecNode } from "../../hud/spec/types.ts";

export interface PlayerCardData {
  name: string;
  team?: "CT" | "T";
  health: number;
  armor: number;
}

const TEAM_COLOR: Record<"CT" | "T", string> = {
  CT: "#60a5fa",
  T: "#fb923c",
};

const ROOT_ID = "player-card";

/**
 * Builds a PlayerCard as a tree of headless primitives rather than one
 * opaque component. `health-bar` and `armor-bar` are ordinary child nodes
 * with stable ids, so hiding one or recoloring it is a single-entry
 * `SpecOverrides` patch (see `applyOverrides`) — no prop was added to
 * PlayerCard itself for "show armor" or "health bar color", because the
 * subtree mechanism already covers both.
 *
 * Every child id is namespaced under `${ROOT_ID}:` — `SpecOverrides` keys
 * a patch by bare node id across the *whole page* the editor composes, not
 * just this tree, so an unqualified id like `"name"` would silently also
 * match WeaponHUD's own `"name"` node. The prefix is what keeps a patch
 * scoped to the widget instance it was actually made on.
 */
export function playerCardSpec(data: PlayerCardData): SpecNode {
  const accent = TEAM_COLOR[data.team ?? "CT"];

  return {
    id: ROOT_ID,
    type: "Stack",
    props: { direction: "column", gap: 6, align: "center" },
    style: {
      width: 72,
      padding: "10px 8px",
      borderRadius: 6,
      border: `1px solid ${accent}`,
      background: "#10121a",
    },
    children: [
      {
        id: `${ROOT_ID}:avatar`,
        type: "Avatar",
        props: { initial: data.name.slice(0, 1).toUpperCase(), color: accent },
        gsi: ["player:name"],
      },
      {
        id: `${ROOT_ID}:name`,
        type: "Text",
        props: { value: data.name, size: 11, weight: 600, color: "#dfe1e6" },
        gsi: ["player:name"],
      },
      {
        id: `${ROOT_ID}:health-bar`,
        type: "StatBar",
        props: {
          value: data.health,
          color: accent,
          label: String(data.health),
          width: 48,
          height: 4,
        },
        gsi: ["player:state:health"],
      },
      {
        id: `${ROOT_ID}:armor-bar`,
        type: "StatBar",
        props: {
          value: data.armor,
          color: "#6b90c9",
          label: String(data.armor),
          width: 48,
          height: 4,
        },
        gsi: ["player:state:armor"],
      },
    ],
  };
}
