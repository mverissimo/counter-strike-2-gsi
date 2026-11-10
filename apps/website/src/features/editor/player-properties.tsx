import { useEditor } from "@/components/editor-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { playerInspector } from "@/features/hud/catalog";
import { mockPlayerFields } from "@/features/hud/mock-data";
import type { PlayerElement } from "@/features/hud/document";

export function PlayerProperties({ element }: { element: PlayerElement }) {
  const { players, updatePlayer, updateBindings, updateMockPlayer } = useEditor();
  const player = players.find((item) => item.id === element.bindings.playerId);
  return (
    <>
      <section className="space-y-3 border-b p-4" aria-label="Player data">
        <h3 className="text-xs font-semibold">Player data</h3>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="secondary" size="sm" className="w-full justify-between text-xs" />
            }
            aria-label="Mock player"
          >
            <span className="truncate">{player?.name ?? "Player unavailable"}</span>
            <span className="shrink-0 text-muted-foreground">Mock data</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            <DropdownMenuRadioGroup
              value={element.bindings.playerId}
              onValueChange={(playerId: string) => updateBindings({ playerId })}
            >
              {players.map((item) => (
                <DropdownMenuRadioItem key={item.id} value={item.id} closeOnClick>
                  {item.name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        {player ? (
          mockPlayerFields.map((field) => (
            <Label
              key={field.key}
              className="flex flex-col items-stretch gap-1.5 text-xs font-normal text-muted-foreground"
            >
              {field.label}
              <Input
                key={`${player.id}-${player[field.key]}`}
                type={field.control === "number" ? "number" : "text"}
                min={0}
                max={100}
                maxLength={field.maxLength}
                defaultValue={player[field.key]}
                placeholder={field.key === "portrait" ? "/image.svg or https://…" : undefined}
                className="h-7 bg-muted text-xs md:text-xs"
                onBlur={(event) => {
                  if (field.control === "number") {
                    const value = event.target.value === "" ? NaN : Number(event.target.value);
                    const next = Number.isFinite(value)
                      ? Math.round(Math.max(0, Math.min(100, value)))
                      : player[field.key];
                    event.target.value = String(next);
                    updateMockPlayer(player.id, { [field.key]: next });
                  } else {
                    const value = event.target.value.trim();
                    const next = field.key === "name" && !value ? player.name : value;
                    event.target.value = next;
                    updateMockPlayer(player.id, { [field.key]: next });
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                  if (event.key === "Escape") {
                    event.currentTarget.value = String(player[field.key]);
                    event.currentTarget.blur();
                  }
                }}
              />
            </Label>
          ))
        ) : (
          <p className="text-xs text-muted-foreground">Choose a mock player to edit its data.</p>
        )}
      </section>
      <section className="space-y-3 border-b p-4" aria-label="Player card visibility">
        <h3 className="text-xs font-semibold">Player card</h3>
        {playerInspector.map((field) => (
          <Label
            key={field.key}
            className="flex items-center justify-between text-xs font-normal text-muted-foreground"
          >
            {field.label}
            <Switch
              size="sm"
              checked={element.props[field.key]}
              onCheckedChange={(visible) => updatePlayer({ [field.key]: visible })}
            />
          </Label>
        ))}
      </section>
    </>
  );
}
