import type { SpecNode } from "./types.ts";

/**
 * A patch keyed by node id, applied wherever that id occurs in the tree —
 * at the root or nested inside a composite widget. This is the whole
 * mechanism behind "hide the health bar" or "recolor it": both are a
 * one-entry override targeting `"player-card:health-bar"`, no different
 * from overriding a top-level node.
 *
 * The id is a flat key across however many trees an `overrides` object
 * gets applied to (an editor composing several widgets on one page, say),
 * not just the one tree in front of you — so it only stays scoped to a
 * single widget instance if every widget namespaces its own child ids
 * under something unique to it (see `player-card-spec.ts`). Two widgets
 * that both happen to have a bare `"name"` child would otherwise patch
 * each other by accident.
 */
export type SpecOverrides = Record<string, Partial<Pick<SpecNode, "visible" | "props" | "style">>>;

export function applyOverrides(node: SpecNode, overrides: SpecOverrides): SpecNode {
  const patch = overrides[node.id];
  const children = node.children?.map((child) => applyOverrides(child, overrides));
  const childrenChanged = children?.some((child, i) => child !== node.children?.[i]);

  if (!patch && !childrenChanged) {
    return node;
  }

  return {
    ...node,
    visible: patch?.visible ?? node.visible,
    props: patch?.props ? { ...node.props, ...patch.props } : node.props,
    style: patch?.style ? { ...node.style, ...patch.style } : node.style,
    children,
  };
}
