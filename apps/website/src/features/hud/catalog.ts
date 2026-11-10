import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { z } from "zod";

export const playerCardProps = z.object({
  playerName: z.string().min(1).max(64).default("Player"),
  health: z.number().int().min(0).max(100).default(100),
  armor: z.number().int().min(0).max(100).default(100),
  accentColor: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .default("#E4B45E"),
  showName: z.boolean().default(true),
  showPortrait: z.boolean().default(true),
  showHealth: z.boolean().default(true),
  showArmor: z.boolean().default(true),
});
export type PlayerCardProps = z.infer<typeof playerCardProps>;
export const playerDefaults = playerCardProps.parse({});
export const playerInspector = [
  { key: "showPortrait", label: "Portrait", control: "boolean" },
  { key: "showName", label: "Player name", control: "boolean" },
  { key: "showHealth", label: "Health", control: "boolean" },
  { key: "showArmor", label: "Armor", control: "boolean" },
] as const satisfies readonly { key: keyof PlayerCardProps; label: string; control: string }[];

export type PlayerVisibility = Pick<PlayerCardProps, (typeof playerInspector)[number]["key"]>;

export const hudCatalog = defineCatalog(schema, {
  components: {
    "player-card": {
      props: playerCardProps.extend({ portrait: z.string() }),
      description: "Player identity, portrait, health and armor",
    },
  },
  actions: {},
});
