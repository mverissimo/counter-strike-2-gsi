import { createServerFn } from "@tanstack/react-start";
import { validateWorkspaceInput } from "../shared/workspace";

export const getMockWorkspace = createServerFn({ method: "GET" })
  .validator(validateWorkspaceInput)
  .handler(async ({ data }) => {
    const { readMockWorkspace } = await import("../server/workspace.server");
    return readMockWorkspace(data);
  });
