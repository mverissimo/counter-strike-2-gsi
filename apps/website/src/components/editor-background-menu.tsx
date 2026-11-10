import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Image01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { mapBackgrounds, type MapBackgroundId } from "@/features/editor/map-background";

export function EditorBackgroundMenu({
  value,
  onChange,
}: {
  value: MapBackgroundId | null;
  onChange: (value: MapBackgroundId | null) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button variant="ghost" size="icon-sm" className="size-8 text-muted-foreground" />
              }
              aria-label="Map background"
            />
          }
        >
          <HugeiconsIcon icon={Image01Icon} strokeWidth={1.5} aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent side="top">Map background</TooltipContent>
      </Tooltip>
      <PopoverContent
        side="top"
        sideOffset={12}
        className="w-[min(360px,calc(100vw-24px))] gap-3 p-3"
      >
        <PopoverTitle className="text-xs">Map background</PopoverTitle>
        <div
          className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto p-0.5"
          role="group"
          aria-label="Available backgrounds"
        >
          {[{ id: null, name: "No background", image: null }, ...mapBackgrounds].map((map) => (
            <button
              key={map.id ?? "none"}
              type="button"
              aria-pressed={value === map.id}
              onClick={() => {
                onChange(map.id);
                setOpen(false);
              }}
              className="group relative overflow-hidden rounded-lg border border-border bg-muted text-left outline-none hover:border-ring focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-primary aria-pressed:ring-1 aria-pressed:ring-primary"
            >
              <div className="aspect-video bg-background">
                {map.image && (
                  <img src={map.image} alt="" loading="lazy" className="size-full object-cover" />
                )}
              </div>
              <span className="flex items-center justify-between gap-2 px-2 py-2 text-xs font-medium">
                {map.name}
                {value === map.id && (
                  <HugeiconsIcon icon={Tick02Icon} className="size-3.5" aria-hidden="true" />
                )}
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
