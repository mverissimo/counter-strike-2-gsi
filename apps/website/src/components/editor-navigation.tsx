import { useState, type ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { useEditor } from "@/components/editor-context";
import { ElementRow } from "@/components/element-row";
import { ElementDropdown, type ElementName } from "@/components/examples/c-dropdown-menu-10";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarTrigger,
} from "@/components/ui/sidebar";

function NavigationSection({
  title,
  onAdd,
  children,
  canAdd = true,
}: {
  title: "Scenes" | "Elements";
  canAdd?: boolean;
  onAdd: (element?: ElementName) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <SidebarGroup className="gap-1 px-0 py-4">
        <div className="flex h-6 items-center gap-1 pr-3 pl-3">
          <span className="mr-auto text-xs font-normal text-muted-foreground">{title}</span>
          {canAdd &&
            (title === "Elements" ? (
              <ElementDropdown
                onAdd={(name) => {
                  onAdd(name);
                  setOpen(true);
                }}
              />
            ) : (
              <Button
                variant="ghost"
                size="icon-xs"
                className="size-[22px] text-muted-foreground"
                aria-label={`Add ${title === "Scenes" ? "scene" : "element"}`}
                onClick={() => {
                  onAdd();
                  setOpen(true);
                }}
              >
                <HugeiconsIcon icon={Add01Icon} className="size-3.5" strokeWidth={1.5} />
              </Button>
            ))}
          <CollapsibleTrigger
            render={<Button variant="ghost" size="icon-xs" />}
            className="size-[22px] rounded-md bg-transparent text-muted-foreground aria-expanded:bg-muted focus-visible:bg-muted"
            aria-label={`${open ? "Collapse" : "Expand"} ${title.toLowerCase()}`}
          >
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              className={`size-3.5 transition-transform ${open ? "" : "-rotate-90"}`}
              strokeWidth={1.5}
            />
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5" aria-label={title}>
              {children}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}

export function EditorNavigation() {
  const {
    scenes,
    sceneId,
    scene,
    selectedElement,
    setSceneId,
    setSelectedElement,
    addScene,
    updateScene,
    deleteScene,
    addElement,
    updateElement,
    deleteElement,
  } = useEditor();

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
      <SidebarContent className="gap-0 px-2">
        <NavigationSection title="Scenes" onAdd={addScene}>
          {scenes.map((item) => (
            <ElementRow
              key={item.id}
              itemType="scene"
              name={item.name}
              visible={item.visible}
              locked={item.locked}
              selected={sceneId === item.id}
              onSelect={() => {
                setSceneId(item.id);
                setSelectedElement(null);
              }}
              onToggleVisibility={() =>
                updateScene(item.id, (scene) => ({ ...scene, visible: !scene.visible }))
              }
              onToggleLock={() =>
                updateScene(item.id, (scene) => ({ ...scene, locked: !scene.locked }))
              }
              onDelete={() => deleteScene(item.id)}
            />
          ))}
          {scenes.length === 0 && (
            <li className="px-3 py-2 text-xs text-muted-foreground">No scenes yet</li>
          )}
        </NavigationSection>
        <div className="h-px shrink-0 bg-border" />
        <NavigationSection title="Elements" onAdd={addElement} canAdd={!!scene}>
          {scene?.elements.map((element) => (
            <ElementRow
              key={element.id}
              name={element.name}
              visible={element.visible}
              locked={element.locked}
              selected={selectedElement === element.id}
              onSelect={() => setSelectedElement(element.id)}
              onToggleVisibility={() =>
                updateElement(element.id, (item) => ({ ...item, visible: !item.visible }))
              }
              onToggleLock={() =>
                updateElement(element.id, (item) => ({ ...item, locked: !item.locked }))
              }
              onDelete={() => deleteElement(element.id)}
            />
          ))}
          {!scene ? (
            <li className="px-3 py-2 text-xs text-muted-foreground">
              Create a scene to add elements
            </li>
          ) : (
            scene.elements.length === 0 && (
              <li className="px-3 py-2 text-xs text-muted-foreground">No elements yet</li>
            )
          )}
        </NavigationSection>
      </SidebarContent>
    </Sidebar>
  );
}
