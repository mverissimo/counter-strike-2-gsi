import type { SpecNode } from "../../hud/spec/types.ts";
import type { KillFeedEntry } from "./use-kill-feed-log.ts";

const ROOT_ID = "kill-feed";

/**
 * Named `kill-feed-spec.ts`, not `kill-feed.spec.ts` — see `player-card.spec.ts`
 * on this branch for why a hyphen instead of a dot matters here (Vitest treats
 * any `*.spec.ts` as a test file, workspace-wide).
 *
 * Each row reads "name — kill" or "name — headshot", never "name killed
 * name" — `player:killed` only describes the observed player's own kills,
 * with no killer/victim pair, so that's the honest ceiling of what this
 * widget can show until the server exposes more.
 */
export function killFeedSpec(entries: KillFeedEntry[]): SpecNode {
  const rows: SpecNode[] =
    entries.length > 0
      ? entries.map((entry, i) => ({
          id: `${ROOT_ID}:entry-${entry.id}`,
          type: "Stack",
          props: { direction: "row", align: "center", justify: "space-between", gap: 8 },
          style: { opacity: 1 - i * 0.15 },
          children: [
            {
              id: `${ROOT_ID}:entry-${entry.id}:name`,
              type: "Text",
              props: {
                value: entry.kills > 1 ? `${entry.name} x${entry.kills}` : entry.name,
                size: 11,
                weight: 600,
                color: "#dfe1e6",
              },
              gsi: ["player:killed"],
            },
            {
              id: `${ROOT_ID}:entry-${entry.id}:tag`,
              type: "Text",
              props: {
                value: entry.headshots > 0 ? "headshot" : "kill",
                size: 9,
                color: entry.headshots > 0 ? "#f472b6" : "#a3e635",
              },
              gsi: ["player:killed"],
            },
          ],
        }))
      : [
          {
            id: `${ROOT_ID}:empty`,
            type: "Text",
            props: { value: "sem kills do jogador observado ainda", size: 10, color: "#565a66" },
          },
        ];

  return {
    id: ROOT_ID,
    type: "Stack",
    props: { direction: "column", gap: 5 },
    style: {
      width: 210,
      minHeight: 20,
      background: "#10121a",
      border: "1px solid #23262f",
      borderRadius: 6,
      padding: "8px 10px",
    },
    children: rows,
  };
}
