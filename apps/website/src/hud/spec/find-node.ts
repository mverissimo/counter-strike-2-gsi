import type { SpecNode } from "./types.ts";

export interface FoundNode {
  node: SpecNode;
  parent?: SpecNode;
}

/** Depth-first lookup by id, carrying the immediate parent along for breadcrumbs. */
export function findNode(root: SpecNode, id: string, parent?: SpecNode): FoundNode | undefined {
  if (root.id === id) {
    return { node: root, parent };
  }

  for (const child of root.children ?? []) {
    const found = findNode(child, id, root);

    if (found) {
      return found;
    }
  }

  return undefined;
}
