import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceShell } from "@/components/workspace-shell";

export const Route = createFileRoute("/settings")({
  // Full SSR: this static placeholder has no browser-only data requirements.
  ssr: true,
  component: WorkspaceShell,
});
