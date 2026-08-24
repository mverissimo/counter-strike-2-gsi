import type { SpecNode } from "../../hud/spec/types.ts";

const ROOT_ID = "sponsors";
const SCOPE = "sponsors";

/**
 * Split out of `match-info-spec.ts` into its own catalog entry, same reason
 * as `map-rotation-spec.ts`. Fully static — GSI has no concept of sponsors —
 * so unlike every other widget's spec builder this one takes no data at all;
 * the placeholder label is editable through `applyOverrides` like anything
 * else in the catalog. Same `data-scope`/`data-part` treatment as
 * `player-card-spec.ts`.
 */
export function sponsorsSpec(): SpecNode {
  return {
    id: ROOT_ID,
    type: "Stack",
    props: { align: "center", justify: "center" },
    style: { padding: "8px 16px", background: "#14161e", border: "1px solid #23262f" },
    data: { scope: SCOPE, part: "root" },
    children: [
      {
        id: `${ROOT_ID}:label`,
        type: "Text",
        props: { value: "PATROCINADORES", size: 10, weight: 700, color: "#7d818c" },
        data: { scope: SCOPE, part: "label" },
      },
    ],
  };
}
