import { useEffect, useId, useMemo, useState } from "react";
import { cn } from "cn";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, ViewIcon, ViewOffIcon, Delete02Icon } from "@hugeicons/core-free-icons";
import { hotkeysCoreFeature, selectionFeature, syncDataLoaderFeature } from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
import { useEditor } from "@/components/editor-context";
import { OverflowLabel } from "@/components/overflow-label";
import { Button } from "@/components/ui/button";
import { Tree, TreeItem, TreeItemLabel } from "@/components/reui/tree";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import type { EditorElement, EditorScene } from "@/features/hud/document";

type NavigationItem =
  | { type: "root"; name: string; children: string[] }
  | { type: "scene"; name: string; children: string[]; scene: EditorScene }
  | {
      type: "element";
      name: string;
      children: string[];
      scene: EditorScene;
      element: EditorElement;
    };
const rootId = "scene-tree-root";
const missingItem: NavigationItem = { type: "root", name: "Scenes", children: [] };

export function EditorNavigation() {
  const {
    scenes,
    sceneId,
    selectedElement,
    setSceneId,
    setSelectedElement,
    addScene,
    deleteScene,
    updateElement,
  } = useEditor();
  const labelId = useId();
  const [expandedItems, setExpandedItems] = useState<string[]>(() => (sceneId ? [sceneId] : []));
  const items = useMemo(() => {
    const result: Record<string, NavigationItem> = {
      [rootId]: { type: "root", name: "Scenes", children: scenes.map((scene) => scene.id) },
    };
    for (const scene of scenes) {
      result[scene.id] = {
        type: "scene",
        name: scene.name,
        children: scene.elements.map((element) => element.id),
        scene,
      };
      for (const element of scene.elements)
        result[element.id] = { type: "element", name: element.kind, children: [], scene, element };
    }
    return result;
  }, [scenes]);
  const selectedId = selectedElement ?? sceneId;
  const selectedItems = selectedId ? [selectedId] : [];
  function selectItem(id: string | undefined) {
    const item = id ? items[id] : undefined;
    if (!item || item.type === "root") return;
    setSceneId(item.scene.id);
    setSelectedElement(item.type === "element" ? item.element.id : null);
  }
  const tree = useTree<NavigationItem>({
    rootItemId: rootId,
    indent: 22,
    state: { expandedItems, selectedItems },
    setExpandedItems,
    setSelectedItems: (update) => {
      const next = typeof update === "function" ? update(selectedItems) : update;
      selectItem(next.at(-1));
    },
    onPrimaryAction: (item) => selectItem(item.getId()),
    getItemName: (item) => item.getItemData().name,
    isItemFolder: (item) => item.getItemData().type !== "element",
    dataLoader: {
      getItem: (id) => items[id] ?? missingItem,
      getChildren: (id) => items[id]?.children ?? [],
    },
    features: [syncDataLoaderFeature, selectionFeature, hotkeysCoreFeature],
  });
  useEffect(() => {
    tree.rebuildTree();
  }, [tree, items, expandedItems]);
  useEffect(() => {
    if (selectedElement && sceneId)
      setExpandedItems((current) => (current.includes(sceneId) ? current : [...current, sceneId]));
  }, [sceneId, selectedElement]);
  function expand(id: string) {
    setExpandedItems((current) => (current.includes(id) ? current : [...current, id]));
  }
  return (
    <Sidebar
      collapsible="none"
      className="hidden min-w-0 flex-1 bg-background md:flex"
      aria-label="Editor secondary navigation"
    >
      <SidebarHeader className="h-12 flex-row items-center justify-between border-b px-5 py-0">
        <span className="truncate text-sm font-medium">HUD Editor</span>
        <SidebarTrigger className="size-6 text-muted-foreground" />
      </SidebarHeader>
      <SidebarContent className="gap-4 px-4 py-2">
        <SidebarGroup className="gap-0.5 p-0">
          <div className="flex items-center justify-between px-2 pb-1">
            <span id={labelId} className="text-xs font-medium text-ring">
              Scenes
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              className="size-[22px] text-muted-foreground"
              aria-label="Add scene"
              onClick={() => expand(addScene())}
            >
              <HugeiconsIcon
                icon={Add01Icon}
                className="size-3.5"
                strokeWidth={1.5}
                aria-hidden="true"
              />
            </Button>
          </div>
          <Tree
            tree={tree}
            indent={22}
            aria-labelledby={labelId}
            className="relative before:absolute before:inset-0 before:-ms-1.75 before:bg-[repeating-linear-gradient(to_right,transparent_0,transparent_calc(var(--tree-indent)-1px),var(--border)_calc(var(--tree-indent)-1px),var(--border)_calc(var(--tree-indent)))]"
          >
            {tree
              .getItems()
              .filter((item) => items[item.getId()])
              .map((item) => {
                const data = item.getItemData();
                if (data.type === "root") return null;
                const isScene = data.type === "scene";
                const visible = isScene ? data.scene.visible : data.element.visible;
                const persistentActions = !isScene && !visible;
                return (
                  <div
                    key={item.getId()}
                    className="group/row relative not-last:pb-0.5"
                    role="presentation"
                  >
                    <TreeItem item={item} className="relative block w-full text-left not-last:pb-0">
                      <TreeItemLabel
                        className={cn(
                          "h-8 gap-2 text-xs font-medium text-muted-foreground not-in-data-[folder=true]:ps-2 hover:text-sidebar-accent-foreground",
                          "[&_svg]:size-4 [&_svg]:text-ring [&:hover_svg]:text-sidebar-accent-foreground",
                          "[[data-selected=true]_&]:text-foreground [[data-selected=true]_&_svg]:text-foreground [[data-selected=true]:not(:focus-visible)_&]:ring-input/50 [[data-selected=true]:not(:focus-visible)_&]:ring-1 [[data-selected=true]:not(:focus-visible)_&]:ring-inset",
                          "relative before:absolute before:inset-x-0 before:-inset-y-0.5 before:-z-10 before:bg-background",
                          "[[data-folder=true]_&>svg:first-child]:size-3.5 [[data-folder=true]_&>svg:first-child]:transition-transform [[data-folder=true]_&>svg:first-child]:duration-200 motion-reduce:[[data-folder=true]_&>svg:first-child]:transition-none",
                          "[[aria-expanded=true]_&]:text-foreground [[aria-expanded=true]_&_svg]:text-foreground [[data-folder=true][data-selected=false]_&]:hover:bg-transparent",
                          "transition-[padding,background-color,color] duration-200 motion-reduce:transition-none",
                          "group-hover/row:pr-8 group-focus-within/row:pr-8 max-md:pr-8",
                          persistentActions ? "pr-8" : "pr-2",
                        )}
                      >
                        <OverflowLabel text={data.name} muted={!visible || !data.scene.visible} />
                      </TreeItemLabel>
                    </TreeItem>
                    <div
                      onKeyDown={(event) => event.stopPropagation()}
                      onKeyUp={(event) => event.stopPropagation()}
                      className={`absolute top-1 right-1 z-30 flex items-center gap-0.5 group-hover/row:opacity-100 group-focus-within/row:opacity-100 has-[[aria-expanded=true]]:opacity-100 ${persistentActions ? "opacity-100" : "md:opacity-0"}`}
                    >
                      {!isScene && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="size-[22px] text-muted-foreground"
                          aria-label={`${visible ? "Hide" : "Show"} ${data.name}`}
                          title={visible ? "Hide" : "Show"}
                          disabled={data.scene.locked}
                          onClick={() =>
                            updateElement(data.element.id, (current) => ({
                              ...current,
                              visible: !current.visible,
                            }))
                          }
                        >
                          <HugeiconsIcon
                            icon={visible ? ViewIcon : ViewOffIcon}
                            className="size-3.5"
                            strokeWidth={1.5}
                            aria-hidden="true"
                          />
                        </Button>
                      )}
                      {isScene && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="size-[22px] text-muted-foreground hover:text-destructive"
                          aria-label={`Delete ${data.name}`}
                          title="Delete scene"
                          disabled={data.scene.locked}
                          onClick={() => deleteScene(data.scene.id)}
                        >
                          <HugeiconsIcon
                            icon={Delete02Icon}
                            className="size-3.5"
                            strokeWidth={1.5}
                            aria-hidden="true"
                          />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
          </Tree>
          {scenes.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">No scenes yet</p>
          )}
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
