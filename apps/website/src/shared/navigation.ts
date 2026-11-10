import {
  Folder01Icon,
  Layout01Icon,
  Layers01Icon,
  Image01Icon,
  Settings01Icon,
} from "@hugeicons/core-free-icons";

export const navigation = [
  { url: "/huds", title: "My HUDs", group: "Workspace", icon: Folder01Icon },
  { url: "/editor", title: "HUD Editor", group: "Workspace", icon: Layout01Icon },
  { url: "/templates", title: "Templates", group: "Library", icon: Layers01Icon },
  { url: "/assets", title: "Assets", group: "Library", icon: Image01Icon },
  { url: "/settings", title: "Settings", group: "Preferences", icon: Settings01Icon },
] as const;

export const navigationGroups = ["Workspace", "Library", "Preferences"] as const;
