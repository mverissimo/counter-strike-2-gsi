import { useState, type Dispatch, type SetStateAction } from "react";
import {
  ReactFlow,
  NodeResizer,
  ViewportPortal,
  Background,
  BackgroundVariant,
  type Node,
  type NodeProps,
  type NodeChange,
  type Viewport,
} from "@xyflow/react";
import { useEditor } from "@/components/editor-context";
import { ElementContent } from "@/features/hud/renderer";
import { canvas, type EditorElement, type ElementProperties } from "@/features/hud/document";
import type { MockPlayer } from "@/features/hud/mock-data";

type HudNode = Node<
  {
    element: EditorElement;
    players: readonly MockPlayer[];
    locked: boolean;
    resize: (id: string, patch: Partial<ElementProperties>) => void;
  },
  "hud"
>;
function ElementNode({ id, data, selected }: NodeProps<HudNode>) {
  return (
    <>
      <NodeResizer
        isVisible={selected && !data.locked}
        minWidth={data.element.kind === "Player card" ? 240 : 1}
        minHeight={data.element.kind === "Player card" ? 160 : 1}
        maxWidth={canvas.width}
        maxHeight={canvas.height}
        color="var(--primary)"
        onResizeEnd={(_, geometry) => data.resize(id, geometry)}
      />
      <div className="size-full overflow-hidden">
        <ElementContent element={data.element} players={data.players} editing />
      </div>
    </>
  );
}
const nodeTypes = { hud: ElementNode };
type Draft = { x?: number; y?: number; width?: number; height?: number };

export function EditorCanvas({
  viewport,
  onViewportChange,
  tool,
}: {
  viewport: Viewport;
  onViewportChange: (viewport: Viewport) => void;
  tool: "select" | "pan";
}) {
  const { scene, selectedElement, players, setSelectedElement, updateGeometry } = useEditor();
  // Remounting on scene changes prevents transient geometry from leaking between scenes.
  return (
    <SceneCanvas
      key={scene?.id ?? "empty"}
      viewport={viewport}
      onViewportChange={onViewportChange}
      tool={tool}
      scene={scene}
      selectedElement={selectedElement}
      players={players}
      setSelectedElement={setSelectedElement}
      updateGeometry={updateGeometry}
    />
  );
}
function SceneCanvas({
  scene,
  selectedElement,
  players,
  setSelectedElement,
  updateGeometry,
  viewport,
  onViewportChange,
  tool,
}: Pick<
  ReturnType<typeof useEditor>,
  "scene" | "selectedElement" | "players" | "setSelectedElement" | "updateGeometry"
> & {
  viewport: Viewport;
  onViewportChange: (viewport: Viewport) => void;
  tool: "select" | "pan";
}) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  function finish(id: string, geometry: Partial<ElementProperties>) {
    updateGeometry(id, geometry);
    clearDraft(id, setDrafts);
  }
  const nodes: HudNode[] = (scene?.elements ?? []).map((element, index) => {
    const draft = drafts[element.id];
    const locked = !!(scene?.locked || tool === "pan");
    return {
      id: element.id,
      type: "hud",
      position: { x: draft?.x ?? element.x, y: draft?.y ?? element.y },
      width: draft?.width ?? element.width,
      height: draft?.height ?? element.height,
      style: { width: draft?.width ?? element.width, height: draft?.height ?? element.height },
      selected: element.id === selectedElement,
      hidden: !scene?.visible || !element.visible,
      draggable: !locked,
      selectable: tool === "select",
      deletable: false,
      zIndex: index,
      ariaLabel: element.kind,
      data: { element, players, locked, resize: finish },
    };
  });
  function onNodesChange(changes: NodeChange<HudNode>[]) {
    for (const change of changes) {
      if (change.type === "select" && change.selected) setSelectedElement(change.id);
      if (change.type === "position" && change.position) {
        if (change.dragging === false) finish(change.id, change.position);
        else
          setDrafts((current) => ({
            ...current,
            [change.id]: { ...current[change.id], ...change.position },
          }));
      }
      if (change.type === "dimensions" && change.resizing && change.dimensions) {
        const dimensions = change.dimensions;
        setDrafts((current) => ({
          ...current,
          [change.id]: { ...current[change.id], ...dimensions },
        }));
      }
    }
  }
  return (
    <ReactFlow<HudNode>
      nodes={nodes}
      edges={[]}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      viewport={viewport}
      onViewportChange={onViewportChange}
      minZoom={0.1}
      maxZoom={4}
      nodeExtent={[
        [0, 0],
        [canvas.width, canvas.height],
      ]}
      nodesConnectable={false}
      panOnDrag={tool === "pan" ? true : [1, 2]}
      selectionOnDrag={false}
      multiSelectionKeyCode={null}
      selectionKeyCode={null}
      zoomOnDoubleClick={false}
      elevateNodesOnSelect={false}
      onNodeClick={(_, node) => {
        if (tool === "select") setSelectedElement(node.id);
      }}
      onNodeDragStop={(_, node) => finish(node.id, node.position)}
      onPaneClick={() => {
        if (tool === "select") setSelectedElement(null);
      }}
      colorMode="dark"
      className="bg-background"
      deleteKeyCode={null}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={16 / viewport.zoom}
        size={2 / viewport.zoom}
        color="var(--border)"
        bgColor="var(--background)"
      />
      <ViewportPortal>
        <div
          data-slot="hud-artboard"
          aria-label="1920 by 1080 HUD canvas"
          className="pointer-events-none absolute -z-10 bg-background ring-1 ring-border"
          style={{ width: canvas.width, height: canvas.height }}
        />
      </ViewportPortal>
    </ReactFlow>
  );
}
function clearDraft(id: string, setDrafts: Dispatch<SetStateAction<Record<string, Draft>>>) {
  setDrafts((current) => {
    const next = { ...current };
    delete next[id];
    return next;
  });
}
