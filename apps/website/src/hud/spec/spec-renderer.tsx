import { registry } from "./registry.ts";
import type { SpecNode } from "./types.ts";

export interface SpecRendererProps {
  node: SpecNode;
  /** The id of the node currently selected in an editor — unrelated to rendering when omitted. */
  selectedId?: string;
  /** Present only in editable contexts (an editor canvas); every node becomes clickable when given. */
  onSelectNode?: (id: string) => void;
}

/**
 * Walks a spec tree and renders it against the primitive registry.
 * `node.visible === false` prunes that node and everything under it —
 * the same check whether `node` is the root or three levels deep inside
 * a composite widget, which is what makes per-subtree visibility "just
 * work" without any widget needing to know about it.
 *
 * `onSelectNode` threads the same way: every primitive accepts an
 * `onClick`/`selected` pair (see `primitives/*`), so passing it down
 * makes every node in the tree independently clickable — a health bar
 * nested inside a player card is selected exactly like a top-level
 * widget, no per-widget click wiring needed.
 */
export function SpecRenderer(props: SpecRendererProps) {
  const { node, selectedId, onSelectNode } = props;

  if (node.visible === false) {
    return null;
  }

  const Component = registry[node.type];

  if (!Component) {
    if (import.meta.env.DEV) {
      console.warn(`hud spec: unknown component type "${node.type}" (node "${node.id}")`);
    }

    return null;
  }

  const interactive = onSelectNode
    ? {
        onClick: (event: { stopPropagation: () => void }) => {
          event.stopPropagation();
          onSelectNode(node.id);
        },
        selected: node.id === selectedId,
      }
    : undefined;

  const dataAttrs = toDataAttrs(node.data);

  return (
    <Component {...node.props} style={node.style} {...dataAttrs} {...interactive}>
      {node.children?.map((child) => (
        <SpecRenderer
          key={child.id}
          node={child}
          selectedId={selectedId}
          onSelectNode={onSelectNode}
        />
      ))}
    </Component>
  );
}

/**
 * `node.data` uses author-friendly keys (`scope`, `part`, `mvp`) — this
 * turns them into real `data-*` prop names and applies the
 * present-when-true/omitted-when-false convention documented on
 * `SpecNode.data`, so every primitive just spreads the result verbatim.
 */
function toDataAttrs(data: SpecNode["data"]): Record<string, string> {
  const attrs: Record<string, string> = {};

  if (!data) {
    return attrs;
  }

  for (const [key, value] of Object.entries(data)) {
    if (value === false || value === undefined) continue;
    attrs[`data-${key}`] = value === true ? "" : String(value);
  }

  return attrs;
}
