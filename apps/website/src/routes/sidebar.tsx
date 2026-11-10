import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceShell } from "@/components/workspace-shell";

export const Route = createFileRoute("/sidebar")({
  // Full SSR: the static navigation preview renders before its controls hydrate.
  ssr: true,
  component: WorkspaceShell,
});
