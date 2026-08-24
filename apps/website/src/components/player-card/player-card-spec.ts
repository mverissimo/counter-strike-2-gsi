import type { SpecNode } from "../../hud/spec/types.ts";

export interface PlayerCardData {
  name: string;
  team?: "CT" | "T";
  health: number;
  armor: number;
  activity?: "playing" | "textinput" | "menu";
  mvps?: number;
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
 * just this tree, so an unqualified id like `"label"` would silently also
 * match Sponsors' own `"label"` node. The prefix is what keeps a patch
 * scoped to the widget instance it was actually made on.
 *
 * Every node also carries `data-scope="player"` plus its own `data-part`
 * (`root`, `avatar`, `name`, `health-bar`, `armor-bar`) — the same
 * Ark UI-style pair every part of a compound component shares — so CSS can
 * target `[data-scope="player"][data-part="health-bar"]` instead of the
 * widget needing a dedicated prop for every state a stylesheet might care
 * about. The root additionally exposes `data-state` (from `player:activity`
 * — "active" while actually playing) and `data-mvp` (present once
 * `match_stats:mvps` is above zero); `data-team` ("ct"/"t", from
 * `player:team`) is omitted when the team is unknown, same as every other
 * widget's team-scoped nodes (`match-info-spec.ts`).
 */
export function playerCardSpec(data: PlayerCardData): SpecNode {
  const accent = TEAM_COLOR[data.team ?? "CT"];
  const scope = "player";
  const team = data.team?.toLowerCase();

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
    gsi: ["player:team"],
    data: {
      scope,
      part: "root",
      state: data.activity === "playing" ? "active" : "inactive",
      mvp: (data.mvps ?? 0) > 0,
      team,
    },
    children: [
      {
        id: `${ROOT_ID}:avatar`,
        type: "Avatar",
        props: { initial: data.name.slice(0, 1).toUpperCase(), color: accent },
        gsi: ["player:name"],
        data: { scope, part: "avatar", team },
      },
      {
        id: `${ROOT_ID}:name`,
        type: "Text",
        props: { value: data.name, size: 11, weight: 600, color: "#dfe1e6" },
        gsi: ["player:name"],
        data: { scope, part: "name", team },
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
        data: { scope, part: "health-bar", team },
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
        data: { scope, part: "armor-bar", team },
      },
    ],
  };
}
