import { createContext, useContext, useState, type ReactNode } from "react";
import {
  createElement,
  constrainGeometry,
  initialDocument,
  playerBindings,
  type ElementName,
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
    const item: EditorScene = {
      id: crypto.randomUUID(),
      name: `Scene ${number}`,
      visible: true,
      locked: false,
      elements: [],
    };
    setDocument((current) => ({ ...current, scenes: [...current.scenes, item] }));
    setSceneId(item.id);
    setSelectedElement(null);
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
  function addElement(kind: ElementName = "Player card") {
    if (!scene || scene.locked) return;
    const existing = scene.elements.find((element) => element.kind === kind);
    if (existing) {
      setSelectedElement(existing.id);
      return;
    }
    const element = createElement(kind, crypto.randomUUID());
    element.x += scene.elements.length * 40;
    element.y += scene.elements.length * 40;
    updateScene(scene.id, (current) =>
      current.locked || current.elements.some((item) => item.kind === kind)
        ? current
        : {
            ...current,
            elements: [...current.elements, constrainGeometry(element, {})],
          },
    );
    setSelectedElement(element.id);
  }
  function updateElement(id: string, update: (element: EditorElement) => EditorElement) {
    if (!scene) return;
    updateScene(scene.id, (current) => {
      if (current.locked) return current;
      return {
        ...current,
        elements: current.elements.map((element) =>
          element.id === id ? update(element) : element,
        ),
      };
    });
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
    addElement,
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
