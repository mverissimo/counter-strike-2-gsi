import { useEffect, useRef, useState, type ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cursor01Icon,
  HandIcon,
  ZoomInIcon,
  ZoomOutIcon,
  FitToScreenIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PropertiesSidebar } from "@/components/properties-sidebar";
import { EditorBackgroundMenu } from "@/components/editor-background-menu";
import { MapBackground, type MapBackgroundId } from "@/features/editor/map-background";
import { EditorZoomMenu } from "@/components/editor-zoom-menu";
import { useEditor } from "@/components/editor-context";
import { EditorCanvas } from "@/features/editor/editor-canvas";
import { HudRenderer } from "@/features/hud/renderer";

const canvasWidth = 1920;
const canvasHeight = 1080;

export function EditorWorkspace({ navigationToggle }: { navigationToggle: ReactNode }) {
  const [background, setBackground] = useState<MapBackgroundId | null>(null);
  const [mode, setMode] = useState<"editor" | "preview">("editor");
  const [tool, setTool] = useState<"select" | "pan">("select");
  const [zoomSetting, setZoomSetting] = useState<number | "fit">("fit");
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const { scene, players } = useEditor();
  const viewportRef = useRef<HTMLDivElement>(null);
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
            <Tooltip disableHoverablePopup>
              <TooltipTrigger
                render={
                  <span
                    tabIndex={0}
                    className="inline-flex rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                }
                aria-label="Save unavailable: changes are temporary"
              >
                <Button variant="secondary" size="sm" disabled className="px-3 text-xs">
                  Save
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Changes are temporary. Saving will be added in a later step.
              </TooltipContent>
            </Tooltip>
          </div>
        </header>
        <div className="relative min-h-0 flex-1 overflow-hidden bg-background">
          <div
            ref={viewportRef}
            role="region"
            aria-label={mode === "editor" ? "Editor canvas" : "HUD preview"}
            className="absolute inset-0 overflow-hidden"
          >
            {mode === "editor" ? (
              <EditorCanvas
                tool={tool}
                background={background}
                viewport={{
                  x: (viewport.width - (canvasWidth * zoom) / 100) / 2 + offset.x,
                  y: (viewport.height - (canvasHeight * zoom) / 100) / 2 + offset.y,
                  zoom: zoom / 100,
                }}
                onViewportChange={(next) => {
                  setZoomSetting(next.zoom * 100);
                  setOffset({
                    x: next.x - (viewport.width - canvasWidth * next.zoom) / 2,
                    y: next.y - (viewport.height - canvasHeight * next.zoom) / 2,
                  });
                }}
              />
            ) : (
              <div
                data-slot="hud-artboard"
                aria-label="1920 by 1080 HUD canvas"
                className="absolute top-1/2 left-1/2 bg-background"
                style={{
                  width: canvasWidth,
                  height: canvasHeight,
                  transform: `translate(-50%, -50%) scale(${zoom / 100})`,
                  visibility: viewport.width ? "visible" : "hidden",
                }}
              >
                <MapBackground map={background} />
                <div className="relative size-full">
                  <HudRenderer scene={scene} players={players} />
                </div>
              </div>
            )}
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex items-center justify-center gap-2 px-2">
            <div
              role="group"
              aria-label="Canvas zoom"
              className="pointer-events-auto flex shrink-0 items-center gap-0.5 rounded-xl border border-border/60 bg-sidebar/95 p-1 shadow-sm"
            >
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Zoom out"
                      disabled={zoom <= 10}
                      onClick={() => setZoomSetting(Math.max(10, zoom / 1.25))}
                      className="size-8 text-muted-foreground"
                    />
                  }
                >
                  <HugeiconsIcon icon={ZoomOutIcon} strokeWidth={1.5} aria-hidden="true" />
                </TooltipTrigger>
                <TooltipContent side="top">Zoom out</TooltipContent>
              </Tooltip>
              <EditorZoomMenu
                zoom={zoom}
                onZoom={setZoomSetting}
                onFit={fitCanvas}
                onReset={fitCanvas}
              />
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Zoom in"
                      disabled={zoom >= 400}
                      onClick={() => setZoomSetting(Math.min(400, zoom * 1.25))}
                      className="size-8 text-muted-foreground"
                    />
                  }
                >
                  <HugeiconsIcon icon={ZoomInIcon} strokeWidth={1.5} aria-hidden="true" />
                </TooltipTrigger>
                <TooltipContent side="top">Zoom in</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Fit to canvas"
                      onClick={fitCanvas}
                      className="size-8 text-muted-foreground"
                    />
                  }
                >
                  <HugeiconsIcon icon={FitToScreenIcon} strokeWidth={1.5} aria-hidden="true" />
                </TooltipTrigger>
                <TooltipContent side="top">Fit to canvas</TooltipContent>
              </Tooltip>
            </div>
            {mode === "editor" && (
              <ToggleGroup
                aria-label="Canvas tools"
                value={[tool]}
                onValueChange={(values) => {
                  const value = values[0];
                  if (value === "select" || value === "pan") setTool(value);
                }}
                spacing={1}
                className="pointer-events-auto shrink-0 rounded-xl border border-border/60 bg-sidebar/95 p-1 shadow-sm"
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
                  <TooltipContent side="top">Select</TooltipContent>
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
                  <TooltipContent side="top">Pan</TooltipContent>
                </Tooltip>
              </ToggleGroup>
            )}
            <div className="pointer-events-auto shrink-0 rounded-xl border border-border/60 bg-sidebar/95 p-1 shadow-sm">
              <EditorBackgroundMenu value={background} onChange={setBackground} />
            </div>
          </div>
        </div>
      </div>
      {mode === "editor" && <PropertiesSidebar />}
    </div>
  );
}
