import type { SpecNode } from "../../hud/spec/types.ts";

/**
 * Decorative only — a fixed slug pool with no GSI binding, since GSI never
 * says "here is the map pool," only the map currently loaded (`map:name`).
 * Whichever entry matches that value is highlighted; everything else is
 * just there to look like a real map-select bar (see this file's caller in
 * `map-rotation-from-gsi.tsx` for how `activeMap` flows in).
 */
const MAP_POOL = ["de_mirage", "de_dust2", "de_inferno", "de_nuke", "de_anubis", "de_ancient"];

function mapLabel(slug: string): string {
  return slug.replace(/^de_/, "").toUpperCase();
}

const ROOT_ID = "map-rotation";
const SCOPE = "map-rotation";

/**
 * Split out of `match-info-spec.ts` into its own catalog entry — the map
 * tabs and the score/timer block have nothing to do with each other, so
 * hiding/restyling one independently of the other needed to be a whole
 * widget apart, not a subtree inside a bigger one. Same `data-scope`/
 * `data-part` treatment as `player-card-spec.ts`; the active tab also
 * carries `data-active`.
 */
export function mapRotationSpec(activeMap: string): SpecNode {
  return {
    id: ROOT_ID,
    type: "Stack",
    props: { direction: "row", gap: 2 },
    style: { background: "#10121a", border: "1px solid #23262f" },
    data: { scope: SCOPE, part: "root" },
    children: MAP_POOL.map((slug) => {
      const active = slug === activeMap;

      return {
        id: `${ROOT_ID}:${slug}`,
        type: "Text",
        props: {
          value: mapLabel(slug),
          size: 10,
          weight: 700,
          color: active ? "#0a0b0f" : "#7d818c",
        },
        style: {
          padding: "8px 10px",
          background: active ? "#f3f4f6" : "transparent",
        },
        gsi: active ? ["map:name"] : undefined,
        data: { scope: SCOPE, part: "tab", map: slug, active },
      };
    }),
  };
}
