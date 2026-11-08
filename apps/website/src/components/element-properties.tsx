import { useId } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { useEditor } from "@/components/editor-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  const {
    scene,
    selectedItem: element,
    setSelectedElement,
    updateProperties,
    updateElement,
  } = useEditor();
  const id = useId();
  const locked = !!(scene?.locked || element?.locked);
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
            <span className="truncate">{element?.name ?? "Select an element"}</span>
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
                  {item.name}
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
            <section className="space-y-3 border-b p-4" aria-label="Element details">
              <h3 className="text-xs font-semibold">Element</h3>
              <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-2">
                <Label htmlFor={`${id}-name`} className="text-xs font-normal text-muted-foreground">
                  Name
                </Label>
                <Input
                  id={`${id}-name`}
                  value={element.name}
                  maxLength={100}
                  onChange={(event) => updateProperties({ name: event.target.value })}
                  onBlur={() => {
                    if (!element.name.trim()) updateProperties({ name: element.kind });
                  }}
                  className="h-7 border-0 bg-muted px-2 text-xs md:text-xs"
                />
                <span className="text-xs text-muted-foreground">Type</span>
                <span className="text-xs">{element.kind}</span>
              </div>
            </section>
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
                  min={1}
                  max={1920}
                  onChange={(width) => updateProperties({ width })}
                />
                <NumberProperty
                  label="H"
                  value={element.height}
                  min={1}
                  max={1080}
                  onChange={(height) => updateProperties({ height })}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">Pixels · 1920 × 1080 canvas</p>
            </section>
            <section className="space-y-3 border-b p-4" aria-label="Appearance properties">
              <h3 className="text-xs font-semibold">Appearance</h3>
              <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-x-2 gap-y-3">
                <Label
                  htmlFor={`${id}-color`}
                  className="text-xs font-normal text-muted-foreground"
                >
                  Color
                </Label>
                <div className="flex min-w-0 items-center gap-1.5">
                  <input
                    id={`${id}-color`}
                    type="color"
                    value={element.color}
                    onChange={(event) =>
                      updateProperties({ color: event.target.value.toUpperCase() })
                    }
                    className="size-7 shrink-0 cursor-pointer overflow-hidden rounded-md border-0 bg-transparent p-0 disabled:cursor-default [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-0"
                  />
                  <Input
                    key={element.color}
                    aria-label="Hex color"
                    defaultValue={element.color.slice(1)}
                    maxLength={7}
                    onBlur={(event) => {
                      const color = event.target.value.trim().replace(/^#/, "").toUpperCase();
                      if (/^[0-9A-F]{6}$/.test(color)) updateProperties({ color: `#${color}` });
                      else event.target.value = element.color.slice(1);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                    }}
                    className="h-7 min-w-0 border-0 bg-muted px-2 text-xs uppercase md:text-xs"
                  />
                </div>
                <Label
                  htmlFor={`${id}-opacity`}
                  className="text-xs font-normal text-muted-foreground"
                >
                  Opacity
                </Label>
                <div className="flex items-center gap-2">
                  <input
                    id={`${id}-opacity`}
                    type="range"
                    min={0}
                    max={100}
                    value={element.opacity}
                    onChange={(event) => updateProperties({ opacity: Number(event.target.value) })}
                    className="h-4 min-w-0 flex-1 accent-foreground"
                  />
                  <output htmlFor={`${id}-opacity`} className="w-9 text-right text-xs tabular-nums">
                    {element.opacity}%
                  </output>
                </div>
              </div>
              <NumberProperty
                label="Radius"
                value={element.radius}
                min={0}
                max={100}
                onChange={(radius) => updateProperties({ radius })}
              />
            </section>
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
          <section className="space-y-3 border-b p-4" aria-label="Element state">
            <h3 className="text-xs font-semibold">State</h3>
            <Label className="flex items-center justify-between text-xs font-normal text-muted-foreground">
              Visible
              <Switch
                size="sm"
                checked={element.visible}
                onCheckedChange={(visible) =>
                  updateElement(element.id, (item) => ({ ...item, visible }))
                }
              />
            </Label>
            <Label className="flex items-center justify-between text-xs font-normal text-muted-foreground">
              Locked
              <Switch
                size="sm"
                disabled={scene?.locked}
                checked={element.locked}
                onCheckedChange={(locked) =>
                  updateElement(element.id, (item) => ({ ...item, locked }))
                }
              />
            </Label>
            {locked && (
              <p className="text-xs leading-relaxed text-muted-foreground">
                {scene?.locked
                  ? "Unlock the scene to edit its elements."
                  : "Unlock this element to edit its properties."}
              </p>
            )}
          </section>
        </div>
      )}
    </>
  );
}
