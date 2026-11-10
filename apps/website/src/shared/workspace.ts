export type WorkspaceSearch = { view: "canvas" | "outline" };
export type MockWorkspace = { title: string; view: WorkspaceSearch["view"]; description: string };

export function validateWorkspaceSearch(search: Record<string, unknown>): WorkspaceSearch {
  return { view: search.view === "outline" ? "outline" : "canvas" };
}

export function validateWorkspaceInput(input: unknown): WorkspaceSearch {
  if (
    typeof input !== "object" ||
    input === null ||
    !("view" in input) ||
    (input.view !== "canvas" && input.view !== "outline")
  ) {
    throw new Error("Expected view to be canvas or outline");
  }
  return { view: input.view };
}
