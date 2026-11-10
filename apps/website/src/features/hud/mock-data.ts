import { z } from "zod";
import { playerCardProps, type PlayerCardProps } from "./catalog";
import type { PlayerElement } from "./document";

export const mockPlayerSchema = z.object({
  id: z.string().min(1),
  name: playerCardProps.shape.playerName,
  health: playerCardProps.shape.health,
  armor: playerCardProps.shape.armor,
  portrait: z.string().max(2048),
});
export type MockPlayer = z.infer<typeof mockPlayerSchema>;
export type MockPlayerEdits = Partial<Omit<MockPlayer, "id">>;
export const mockPlayers: MockPlayer[] = [
  {
    id: "borrow",
    name: "borrow",
    health: 86,
    armor: 100,
    portrait: "/branding/players/borrow.svg",
  },
  { id: "kernel", name: "kernel", health: 64, armor: 72, portrait: "/branding/players/kernel.svg" },
];
export const mockPlayerFields = [
  { key: "name", label: "Player name", control: "text", maxLength: 64 },
  { key: "health", label: "Health", control: "number", maxLength: undefined },
  { key: "armor", label: "Armor", control: "number", maxLength: undefined },
  { key: "portrait", label: "Portrait URL", control: "text", maxLength: 2048 },
] as const satisfies readonly {
  key: keyof MockPlayerEdits;
  label: string;
  control: string;
  maxLength: number | undefined;
}[];

export function editMockPlayer(
  players: readonly MockPlayer[],
  id: string,
  patch: MockPlayerEdits,
): MockPlayer[] {
  return players.map((player) => {
    if (player.id !== id) return player;
    const result = mockPlayerSchema.safeParse({ ...player, ...patch, id: player.id });
    return result.success ? result.data : player;
  });
}
export function resolvePlayerProps(
  element: PlayerElement,
  players: readonly MockPlayer[],
): PlayerCardProps & { portrait: string } {
  const player = players.find((item) => item.id === element.bindings.playerId);
  return {
    ...playerCardProps.parse({
      ...element.props,
      playerName: player?.name ?? element.props.playerName,
      health: player?.health ?? element.props.health,
      armor: player?.armor ?? element.props.armor,
    }),
    portrait: player?.portrait ?? "",
  };
}
