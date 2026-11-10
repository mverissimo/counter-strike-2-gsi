import "@tanstack/react-start/server-only";
import type { MockWorkspace, WorkspaceSearch } from "../shared/workspace";

export async function readMockWorkspace(input: WorkspaceSearch): Promise<MockWorkspace> {
  // A short mock delay makes the streamed Suspense boundary observable without external services.
  await new Promise<void>((resolve) => setTimeout(resolve, 30));
  return { title: "HUD Studio", view: input.view, description: "Your workspace starts here." };
}
