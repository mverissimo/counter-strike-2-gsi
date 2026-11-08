import { createContext, useContext, useState, type ReactNode } from "react";
import type { ElementName } from "@/components/examples/c-dropdown-menu-10";

export type EditorElement = {
  id: string;
  name: string;
  kind: ElementName;
  visible: boolean;
  locked: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  color: string;
  radius: number;
  text: string;
  fontSize: number;
};
export type ElementProperties = Pick<
  EditorElement,
  "name" | "x" | "y" | "width" | "height" | "opacity" | "color" | "radius" | "text" | "fontSize"
>;
const defaultProperties = {
  x: 0,
  y: 0,
  width: 600,
  height: 120,
  opacity: 100,
  color: "#FFFFFF",
  radius: 0,
  text: "Text label",
  fontSize: 32,
};
const defaultElementNames: ElementName[] = [
  "Match score",
  "Player card",
  "Team roster",
  "Kill feed",
  "Text label",
];
type EditorScene = {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  elements: EditorElement[];
};

const initialScenes: EditorScene[] = [
  {
    id: "broadcast",
    name: "Match broadcast",
    elements: defaultElementNames,
  },
  { id: "minimal", name: "Minimal HUD", elements: defaultElementNames.slice(0, 2) },
].map((scene) => ({
  ...scene,
  visible: true,
  locked: false,
  elements: scene.elements.map((name, index) => ({
    id: `${scene.id}-${index}`,
    name,
    kind: name,
    ...defaultProperties,
    visible: true,
    locked: false,
  })),
}));

function useEditorState() {
  const [scenes, setScenes] = useState(initialScenes);
  const [sceneId, setSceneId] = useState<string | null>("broadcast");
  const [selectedElement, setSelectedElement] = useState<string | null>("broadcast-0");
  const scene = scenes.find((item) => item.id === sceneId);

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
    setScenes((items) => [...items, item]);
    setSceneId(item.id);
    setSelectedElement(null);
  }

  function updateScene(id: string, update: (scene: EditorScene) => EditorScene) {
    setScenes((items) => items.map((item) => (item.id === id ? update(item) : item)));
  }

  function deleteScene(id: string) {
    const target = scenes.find((item) => item.id === id);
    if (!target || target.locked) return;
    const remaining = scenes.filter((item) => item.id !== id);
    setScenes(remaining);
    if (sceneId === id) {
      setSceneId(remaining[0]?.id ?? null);
      setSelectedElement(null);
    }
  }

  function addElement(baseName: ElementName = "Text label") {
    if (!scene) return;
    let name: string = baseName;
    let suffix = 2;
    while (scene.elements.some((element) => element.name === name)) {
      name = `${baseName} ${suffix++}`;
    }
    const element: EditorElement = {
      ...defaultProperties,
      id: crypto.randomUUID(),
      name,
      kind: baseName,
      visible: true,
      locked: false,
    };
    setScenes((items) =>
      items.map((item) =>
        item.id === scene.id ? { ...item, elements: [...item.elements, element] } : item,
      ),
    );
    setSelectedElement(element.id);
  }

  function updateElement(id: string, update: (element: EditorElement) => EditorElement) {
    if (!scene) return;
    setScenes((items) =>
      items.map((item) =>
        item.id === scene.id
          ? {
              ...item,
              elements: item.elements.map((element) =>
                element.id === id ? update(element) : element,
              ),
            }
          : item,
      ),
    );
  }

  function deleteElement(id: string) {
    if (!scene) return;
    const element = scene.elements.find((item) => item.id === id);
    if (!element || element.locked) return;
    setScenes((items) =>
      items.map((item) =>
        item.id === scene.id
          ? {
              ...item,
              elements: item.elements.filter((element) => element.id !== id || element.locked),
            }
          : item,
      ),
    );
    if (selectedElement === id) setSelectedElement(null);
  }

  const selectedItem = scene?.elements.find((element) => element.id === selectedElement);
  function updateProperties(patch: Partial<ElementProperties>) {
    if (!selectedItem || selectedItem.locked || scene?.locked) return;
    updateElement(selectedItem.id, (item) => ({ ...item, ...patch }));
  }
  return {
    scenes,
    sceneId,
    scene,
    selectedElement,
    selectedItem,
    setSceneId,
    setSelectedElement,
    addScene,
    updateScene,
    deleteScene,
    addElement,
    updateElement,
    deleteElement,
    updateProperties,
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
