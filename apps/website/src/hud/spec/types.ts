import type { CSSProperties } from "react";

/**
 * One node in a HUD layout tree. `type` looks up a component in the
 * registry; `props` are that component's own typed inputs (an accent
 * color, a numeric value, a label). `style` is the generic escape hatch
 * for anything CSS-expressible (spacing, opacity, borders) that isn't
 * worth a dedicated prop.
 *
 * Composite widgets (PlayerCard, Scoreboard, ...) are just nodes with
 * `children` built from these same primitives — there is no separate
 * "compound component" concept, so any child, however deeply nested, can
 * be hidden or restyled through the exact mechanism used at the top level.
 */
export interface SpecNode<Props extends Record<string, unknown> = Record<string, unknown>> {
  /** Stable within its parent tree — targeted by `applyOverrides` and used as the React key. */
  id: string;
  type: string;
  props?: Props;
  style?: CSSProperties;
  /** Defaults to visible; set `false` to omit the node (and its subtree) from render. */
  visible?: boolean;
  /** GSI leaf paths this node's data comes from — self-documenting lineage for an editor's properties panel. */
  gsi?: string[];
  children?: SpecNode[];
}
