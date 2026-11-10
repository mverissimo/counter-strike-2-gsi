import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceShell } from "@/components/workspace-shell";

export const Route = createFileRoute("/editor")({
  // Full SSR: the editor shell and mock document render on the server; canvas interactions hydrate on the client.
  ssr: true,
  component: WorkspaceShell,
});
