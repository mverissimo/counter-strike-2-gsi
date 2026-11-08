import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function EditorZoomMenu({
  zoom,
  onZoom,
  onFit,
  onReset,
}: {
  zoom: number;
  onZoom: (value: number) => void;
  onFit: () => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState(false);
  return (
    <DropdownMenu
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (value) {
          setDraft(String(Math.round(zoom)));
          setInvalid(false);
        }
      }}
    >
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="sm" className="min-w-16 tabular-nums" />}
        aria-label={`Zoom: ${Math.round(zoom)}%`}
      >
        {Math.round(zoom)}%{" "}
        <HugeiconsIcon icon={ArrowDown01Icon} className="size-3" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48" align="end" sideOffset={8}>
        <form
          className="p-1"
          onSubmit={(event) => {
            event.preventDefault();
            const value = Number(draft.trim().replace(/%$/, ""));
            if (!Number.isFinite(value) || value < 10 || value > 400) {
              setInvalid(true);
              return;
            }
            onZoom(value);
            setOpen(false);
          }}
        >
          <Input
            aria-label="Zoom percentage"
            aria-invalid={invalid}
            inputMode="decimal"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setInvalid(false);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Escape" && event.key !== "Tab") event.stopPropagation();
            }}
            className="h-8 bg-muted text-xs"
          />
          {invalid && (
            <p role="alert" className="px-1 pt-1 text-xs text-destructive">
              Enter a value from 10 to 400.
            </p>
          )}
        </form>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={String(zoom)}
          onValueChange={(value: string) => onZoom(Number(value))}
        >
          {[400, 200, 100, 50, 25].map((value) => (
            <DropdownMenuRadioItem
              key={value}
              value={String(value)}
              closeOnClick
              className="text-xs"
            >
              {value}%
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onFit} className="text-xs">
          Fit to canvas
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onReset} className="text-xs">
          Reset view
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={zoom >= 400}
          onClick={() => onZoom(Math.min(400, zoom * 1.25))}
          className="text-xs"
        >
          Zoom in
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={zoom <= 10}
          onClick={() => onZoom(Math.max(10, zoom / 1.25))}
          className="text-xs"
        >
          Zoom out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
