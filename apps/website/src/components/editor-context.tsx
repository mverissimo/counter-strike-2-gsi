import { createContext, useContext, useState, type ReactNode } from "react";
import {
  createSceneElements,
  constrainGeometry,
  initialDocument,
  playerBindings,
  type EditorElement,
  type ElementProperties,
  type EditorScene,
} from "@/features/hud/document";
import { playerCardProps, type PlayerVisibility } from "@/features/hud/catalog";
import { mockPlayers, editMockPlayer, type MockPlayerEdits } from "@/features/hud/mock-data";
export type { EditorElement, ElementProperties } from "@/features/hud/document";

function useEditorState() {
  const [document, setDocument] = useState(initialDocument);
  const [sceneId, setSceneId] = useState<string | null>("broadcast");
  const [selectedElement, setSelectedElement] = useState<string | null>("broadcast-player");
  const [players, setPlayers] = useState(() => mockPlayers.map((player) => ({ ...player })));
  const scenes = document.scenes;
  const scene = scenes.find((item) => item.id === sceneId);
  const selectedItem = scene?.elements.find((element) => element.id === selectedElement);

  function addScene() {
    let number = scenes.length + 1;
    while (scenes.some((item) => item.name === `Scene ${number}`)) number++;
    const id = crypto.randomUUID();
    const item: EditorScene = {
      id,
      name: `Scene ${number}`,
      visible: true,
      locked: false,
      elements: createSceneElements(id),
    };
    setDocument((current) => ({ ...current, scenes: [...current.scenes, item] }));
    setSceneId(item.id);
    setSelectedElement(null);
    return item.id;
  }
  function updateScene(id: string, update: (scene: EditorScene) => EditorScene) {
    setDocument((current) => ({
      ...current,
      scenes: current.scenes.map((item) => (item.id === id ? update(item) : item)),
    }));
  }
  function deleteScene(id: string) {
    const target = scenes.find((item) => item.id === id);
    if (!target || target.locked) return;
    const remaining = scenes.filter((item) => item.id !== id);
    setDocument((current) => ({
      ...current,
      scenes: current.scenes.filter((item) => item.id !== id),
    }));
    if (sceneId === id) {
      setSceneId(remaining[0]?.id ?? null);
      setSelectedElement(null);
    }
  }
  function updateElement(id: string, update: (element: EditorElement) => EditorElement) {
    const owner = scenes.find((item) => item.elements.some((element) => element.id === id));
    if (!owner) return;
    updateScene(owner.id, (current) =>
      current.locked
        ? current
        : {
            ...current,
            elements: current.elements.map((element) =>
              element.id === id ? update(element) : element,
            ),
          },
    );
  }
  function updateGeometry(id: string, patch: Partial<ElementProperties>) {
    updateElement(id, (item) => constrainGeometry(item, patch));
  }
  function updateProperties(patch: Partial<ElementProperties>) {
    if (selectedItem) updateGeometry(selectedItem.id, patch);
  }
  function updatePlayer(patch: Partial<PlayerVisibility>) {
    if (!selectedItem) return;
    updateElement(selectedItem.id, (item) => {
      if (item.kind !== "Player card") return item;
      const result = playerCardProps.safeParse({ ...item.props, ...patch });
      return result.success ? { ...item, props: result.data } : item;
    });
  }
  function updateBindings(patch: Partial<ReturnType<typeof playerBindings.parse>>) {
    if (!selectedItem) return;
    updateElement(selectedItem.id, (item) =>
      item.kind !== "Player card"
        ? item
        : { ...item, bindings: playerBindings.parse({ ...item.bindings, ...patch }) },
    );
  }
  function updateMockPlayer(id: string, patch: MockPlayerEdits) {
    if (scene?.locked) return;
    setPlayers((current) => editMockPlayer(current, id, patch));
  }
  return {
    document,
    scenes,
    sceneId,
    scene,
    selectedElement,
    selectedItem,
    players,
    updateMockPlayer,
    setSceneId,
    setSelectedElement,
    addScene,
    updateScene,
    deleteScene,
    updateElement,
    updateProperties,
    updateGeometry,
    updatePlayer,
    updateBindings,
  };
}
const EditorContext = createContext<ReturnType<typeof useEditorState> | null>(null);
export function EditorProvider({ children }: { children: ReactNode }) {
  const editor = useEditorState();
  return <EditorContext.Provider value={editor}>{children}</EditorContext.Provider>;
}
export function useEditor() {
  const editor = useContext(EditorContext);
  if (!editor) throw new Error("useEditor requires EditorProvider");
  return editor;
}
