import type { SpecNode } from "../../hud/spec/types.ts";

export interface WeaponHudData {
  name: string;
  ammoClip?: number;
  ammoReserve?: number;
}

const ROOT_ID = "weapon-hud";

/** Child ids are namespaced under `${ROOT_ID}:` — see the note in `player-card-spec.ts`. */
export function weaponHudSpec(data: WeaponHudData): SpecNode {
  return {
    id: ROOT_ID,
    type: "Stack",
    props: { direction: "row", align: "baseline", gap: 6 },
    style: {
      background: "#10121a",
      border: "1px solid #23262f",
      borderRadius: 5,
      padding: "8px 14px",
    },
    children: [
      {
        id: `${ROOT_ID}:clip`,
        type: "Text",
        props: { value: data.ammoClip ?? "—", size: 24, weight: 700, color: "#f3f4f6" },
        gsi: ['player:weapons:* (state: "active").ammo_clip'],
      },
      {
        id: `${ROOT_ID}:reserve`,
        type: "Text",
        props: { value: `/ ${data.ammoReserve ?? "—"}`, size: 13, color: "#7d818c" },
        gsi: ['player:weapons:* (state: "active").ammo_reserve'],
      },
      {
        id: `${ROOT_ID}:name`,
        type: "Text",
        props: { value: data.name, size: 10, color: "#565a66" },
        gsi: ['player:weapons:* (state: "active").name'],
      },
    ],
  };
}
