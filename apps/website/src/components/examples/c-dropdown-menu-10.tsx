import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  Layers01Icon,
  Layout01Icon,
  UserIcon,
  UserGroupIcon,
  Target01Icon,
  TextIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const elements = [
  { name: "Match score", description: "Team scores and round information", icon: Layout01Icon },
  { name: "Player card", description: "Player name, health, and equipment", icon: UserIcon },
  { name: "Team roster", description: "Players and team status", icon: UserGroupIcon },
  { name: "Kill feed", description: "Recent eliminations", icon: Target01Icon },
  { name: "Text label", description: "Titles and custom text", icon: TextIcon },
] as const;

import type { ElementName } from "@/features/hud/document";
export type { ElementName } from "@/features/hud/document";

export function ElementDropdown({
  onAdd,
  existingTypes = [],
}: {
  onAdd: (name: ElementName) => void;
  existingTypes?: ElementName[];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-xs" className="size-[22px] text-muted-foreground" />
        }
        aria-label="Add element"
      >
        <HugeiconsIcon icon={Add01Icon} className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start" sideOffset={8}>
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-1.5">
            <HugeiconsIcon
              icon={Layers01Icon}
              className="size-3.5"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            Elements
          </DropdownMenuLabel>
          {elements.map((element) => (
            <DropdownMenuItem
              key={element.name}
              disabled={existingTypes.includes(element.name)}
              className="gap-3"
              onClick={() => onAdd(element.name)}
            >
              <HugeiconsIcon
                icon={element.icon}
                className="size-4"
                strokeWidth={1.5}
                aria-hidden="true"
              />
              <div className="flex flex-1 flex-col">
                <span className="text-sm font-medium">{element.name}</span>
                <span className="text-xs text-muted-foreground">
                  {existingTypes.includes(element.name)
                    ? "Already in this scene"
                    : element.description}
                </span>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
