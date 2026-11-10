import { useId } from "react";
import { PlayerProperties } from "@/features/editor/player-properties";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { useEditor } from "@/components/editor-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function NumberProperty({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Label
        htmlFor={id}
        className={`shrink-0 text-xs font-normal text-muted-foreground ${label.length > 2 ? "w-16" : "w-5"}`}
      >
        {label}
      </Label>
      <Input
        key={value}
        id={id}
        type="number"
        min={min}
        max={max}
        step={1}
        defaultValue={value}
        className="h-7 min-w-0 border-0 bg-muted px-2 text-xs md:text-xs"
        onBlur={(event) => {
          const number = event.target.value === "" ? NaN : Number(event.target.value);
          const next = Number.isFinite(number)
            ? Math.max(min, Math.min(max, Math.round(number)))
            : value;
          event.target.value = String(next);
          if (next !== value) onChange(next);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            event.currentTarget.value = String(value);
            event.currentTarget.blur();
          }
        }}
      />
    </div>
  );
}

export function ElementProperties() {
  const { scene, selectedItem: element, setSelectedElement, updateProperties } = useEditor();
  const id = useId();
  const locked = !!scene?.locked;
  return (
    <>
      <div className="border-b p-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="secondary" size="sm" className="w-full justify-between text-xs" />
            }
            disabled={!scene?.elements.length}
            aria-label="Select element to inspect"
          >
            <span className="truncate">{element?.kind ?? "Select an element"}</span>
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              className="size-3.5 shrink-0"
              aria-hidden="true"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            <DropdownMenuRadioGroup
              value={element?.id ?? ""}
              onValueChange={(value: string) => {
                if (scene?.elements.some((item) => item.id === value)) setSelectedElement(value);
              }}
            >
              {scene?.elements.map((item) => (
                <DropdownMenuRadioItem
                  key={item.id}
                  value={item.id}
                  closeOnClick
                  className="text-xs"
                >
                  {item.kind}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {!element ? (
        <p className="px-4 py-6 text-xs leading-relaxed text-muted-foreground">
          Select an element in the scene to view its properties.
        </p>
      ) : (
        <div key={element.id} className="min-h-0 flex-1 overflow-y-auto">
          <fieldset disabled={locked} className="min-w-0 disabled:opacity-60">
            <section className="space-y-3 border-b p-4" aria-label="Layout properties">
              <h3 className="text-xs font-semibold">Layout</h3>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                <NumberProperty
                  label="X"
                  value={element.x}
                  min={0}
                  max={1920}
                  onChange={(x) => updateProperties({ x })}
                />
                <NumberProperty
                  label="Y"
                  value={element.y}
                  min={0}
                  max={1080}
                  onChange={(y) => updateProperties({ y })}
                />
                <NumberProperty
                  label="W"
                  value={element.width}
                  min={element.kind === "Player card" ? 240 : 1}
                  max={1920}
                  onChange={(width) => updateProperties({ width })}
                />
                <NumberProperty
                  label="H"
                  value={element.height}
                  min={element.kind === "Player card" ? 160 : 1}
                  max={1080}
                  onChange={(height) => updateProperties({ height })}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">Pixels · 1920 × 1080 canvas</p>
            </section>
            {element.kind === "Player card" && <PlayerProperties element={element} />}
            {element.kind === "Text label" && (
              <section className="space-y-3 border-b p-4" aria-label="Text properties">
                <h3 className="text-xs font-semibold">Text</h3>
                <Label htmlFor={`${id}-text`} className="sr-only">
                  Text content
                </Label>
                <Input
                  id={`${id}-text`}
                  value={element.text}
                  maxLength={500}
                  onChange={(event) => updateProperties({ text: event.target.value })}
                  className="h-7 border-0 bg-muted px-2 text-xs md:text-xs"
                />
                <NumberProperty
                  label="Size"
                  value={element.fontSize}
                  min={8}
                  max={200}
                  onChange={(fontSize) => updateProperties({ fontSize })}
                />
              </section>
            )}
          </fieldset>
          {locked && (
            <p className="px-4 py-3 text-xs text-muted-foreground">
              Unlock the scene to edit its elements.
            </p>
          )}
        </div>
      )}
    </>
  );
}
