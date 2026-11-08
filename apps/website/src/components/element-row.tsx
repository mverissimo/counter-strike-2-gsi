import { OverflowLabel } from "@/components/overflow-label";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ViewIcon,
  ViewOffIcon,
  SquareLock01Icon,
  SquareUnlock01Icon,
  Delete02Icon,
} from "@hugeicons/core-free-icons";
import { SidebarMenuAction, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

type ElementRowProps = {
  itemType?: "element" | "scene";
  name: string;
  visible: boolean;
  locked: boolean;
  selected: boolean;
  onSelect: () => void;
  onToggleVisibility: () => void;
  onToggleLock: () => void;
  onDelete: () => void;
};

export function ElementRow({
  itemType = "element",
  name,
  visible,
  locked,
  selected,
  onSelect,
  onToggleVisibility,
  onToggleLock,
  onDelete,
}: ElementRowProps) {
  return (
    <SidebarMenuItem className="group/row">
      <SidebarMenuButton
        className={`hover:bg-foreground/5 data-active:bg-foreground/10 data-active:hover:bg-foreground/12 transition-[padding] duration-200 ease-out group-focus-within/menu-item:pr-20! group-hover/menu-item:pr-20! max-md:pr-20! ${visible && !locked ? "pr-2 group-has-data-[sidebar=menu-action]/menu-item:pr-2" : "pr-20 group-has-data-[sidebar=menu-action]/menu-item:pr-20"}`}
        isActive={selected}
        aria-pressed={selected}
        aria-label={name}
        onClick={onSelect}
      >
        <OverflowLabel text={name} muted={!visible} />
      </SidebarMenuButton>
      <SidebarMenuAction
        showOnHover
        className={`right-13 ${visible ? "" : "md:opacity-100"}`}
        aria-label={`${visible ? "Hide" : "Show"} ${name}`}
        title={`${visible ? "Hide" : "Show"} ${itemType}`}
        onClick={onToggleVisibility}
      >
        <HugeiconsIcon
          icon={visible ? ViewIcon : ViewOffIcon}
          strokeWidth={1.5}
          aria-hidden="true"
        />
      </SidebarMenuAction>
      <SidebarMenuAction
        showOnHover
        className={`right-7 ${locked ? "md:opacity-100" : ""}`}
        aria-label={`${locked ? "Unlock" : "Lock"} ${name}`}
        title={`${locked ? "Unlock" : "Lock"} ${itemType}`}
        onClick={onToggleLock}
      >
        <HugeiconsIcon
          icon={locked ? SquareLock01Icon : SquareUnlock01Icon}
          strokeWidth={1.5}
          aria-hidden="true"
        />
      </SidebarMenuAction>
      <SidebarMenuAction
        showOnHover
        className="right-1 hover:text-destructive disabled:cursor-not-allowed disabled:text-muted-foreground"
        aria-label={`Delete ${name}`}
        title={locked ? `Unlock this ${itemType} before deleting` : `Delete ${itemType}`}
        disabled={locked}
        onClick={onDelete}
      >
        <HugeiconsIcon icon={Delete02Icon} strokeWidth={1.5} aria-hidden="true" />
      </SidebarMenuAction>
    </SidebarMenuItem>
  );
}
