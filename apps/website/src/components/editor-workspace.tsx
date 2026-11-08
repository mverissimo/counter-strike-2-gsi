import { useEffect, useRef, useState, type ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cursor01Icon, HandIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PropertiesSidebar } from "@/components/properties-sidebar";
import { EditorZoomMenu } from "@/components/editor-zoom-menu";

const canvasWidth = 1920;
const canvasHeight = 1080;

export function EditorWorkspace({ navigationToggle }: { navigationToggle: ReactNode }) {
  const [mode, setMode] = useState<"editor" | "preview">("editor");
  const [tool, setTool] = useState<"select" | "pan">("select");
  const [zoomSetting, setZoomSetting] = useState<number | "fit">("fit");
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    pointerId: number;
    x: number;
    y: number;
    originX: number;
    originY: number;
  } | null>(null);
  const fitZoom = Math.max(
    10,
    Math.min(
      100,
      ((viewport.width - 64) / canvasWidth) * 100,
      ((viewport.height - 64) / canvasHeight) * 100,
    ),
  );
  const zoom = zoomSetting === "fit" ? fitZoom : zoomSetting;

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setViewport({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  function fitCanvas() {
    setZoomSetting("fit");
    setOffset({ x: 0, y: 0 });
  }

  return (
    <div className="relative flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-sidebar px-2 sm:px-4">
          {navigationToggle}
          <ToggleGroup
            aria-label="Workspace mode"
            value={[mode]}
            onValueChange={(values) => {
              const value = values[0];
              if (value === "editor" || value === "preview") {
                setMode(value);
                fitCanvas();
              }
            }}
            spacing={1}
            size="sm"
          >
            <ToggleGroupItem
              value="editor"
              className="px-2 text-xs text-muted-foreground aria-pressed:text-foreground sm:px-3"
            >
              Editor
            </ToggleGroupItem>
            <ToggleGroupItem
              value="preview"
              className="px-2 text-xs text-muted-foreground aria-pressed:text-foreground sm:px-3"
            >
              Preview
            </ToggleGroupItem>
          </ToggleGroup>
          <div className="ml-auto flex items-center gap-2">
            <EditorZoomMenu
              zoom={zoom}
              onZoom={setZoomSetting}
              onFit={fitCanvas}
              onReset={fitCanvas}
            />
            <Tooltip disableHoverablePopup>
              <TooltipTrigger
                render={
                  <span
                    tabIndex={0}
                    className="inline-flex rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                }
                aria-label="Save unavailable: no editable HUD is loaded"
              >
                <Button variant="secondary" size="sm" disabled className="px-3 text-xs">
                  Save
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Save will be available when an editable HUD is loaded.
              </TooltipContent>
            </Tooltip>
          </div>
        </header>
        <div className="relative min-h-0 flex-1 overflow-hidden bg-background">
          <div
            ref={viewportRef}
            role="region"
            aria-label={mode === "editor" ? "Editor canvas" : "HUD preview"}
            className={`absolute inset-0 overflow-hidden ${mode === "editor" ? "bg-[radial-gradient(var(--border)_1px,transparent_1px)] bg-size-[16px_16px]" : ""} ${mode === "editor" && tool === "pan" ? "touch-none" : ""} ${mode === "editor" && tool === "pan" ? (panning ? "cursor-grabbing" : "cursor-grab") : "cursor-default"}`}
            style={{ backgroundPosition: `${offset.x}px ${offset.y}px` }}
            onPointerDown={(event) => {
              if (mode !== "editor" || tool !== "pan" || event.button !== 0) return;
              event.preventDefault();
              drag.current = {
                pointerId: event.pointerId,
                x: event.clientX,
                y: event.clientY,
                originX: offset.x,
                originY: offset.y,
              };
              event.currentTarget.setPointerCapture(event.pointerId);
              setPanning(true);
            }}
            onPointerMove={(event) => {
              const current = drag.current;
              if (!current || current.pointerId !== event.pointerId) return;
              setOffset({
                x: current.originX + event.clientX - current.x,
                y: current.originY + event.clientY - current.y,
              });
            }}
            onPointerUp={(event) => {
              if (drag.current?.pointerId === event.pointerId) {
                drag.current = null;
                setPanning(false);
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
            }}
            onLostPointerCapture={() => {
              drag.current = null;
              setPanning(false);
            }}
            onPointerCancel={() => {
              drag.current = null;
              setPanning(false);
            }}
          >
            <div
              data-slot="hud-artboard"
              aria-label="1920 by 1080 HUD canvas"
              className={`absolute top-1/2 left-1/2 bg-background ${mode === "editor" ? "ring-1 ring-border" : ""}`}
              style={{
                width: canvasWidth,
                height: canvasHeight,
                transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${zoom / 100})`,
                visibility: viewport.width ? "visible" : "hidden",
              }}
            />
          </div>
          {mode === "editor" && (
            <ToggleGroup
              aria-label="Canvas tools"
              orientation="vertical"
              value={[tool]}
              onValueChange={(values) => {
                const value = values[0];
                if (value === "select" || value === "pan") setTool(value);
              }}
              spacing={1}
              className="absolute top-1/2 left-3 z-10 -translate-y-1/2 rounded-xl border bg-sidebar/95 p-1 shadow-sm sm:left-4"
            >
              <Tooltip>
                <TooltipTrigger
                  render={
                    <ToggleGroupItem
                      value="select"
                      aria-label="Select tool"
                      className="size-8 min-w-0 px-0 text-muted-foreground aria-pressed:text-foreground"
                    />
                  }
                >
                  <HugeiconsIcon icon={Cursor01Icon} strokeWidth={1.5} aria-hidden="true" />
                </TooltipTrigger>
                <TooltipContent side="right">Select</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <ToggleGroupItem
                      value="pan"
                      aria-label="Pan tool"
                      className="size-8 min-w-0 px-0 text-muted-foreground aria-pressed:text-foreground"
                    />
                  }
                >
                  <HugeiconsIcon icon={HandIcon} strokeWidth={1.5} aria-hidden="true" />
                </TooltipTrigger>
                <TooltipContent side="right">Pan</TooltipContent>
              </Tooltip>
            </ToggleGroup>
          )}
        </div>
      </div>
      {mode === "editor" && <PropertiesSidebar />}
    </div>
  );
}
