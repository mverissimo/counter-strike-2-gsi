import type { CSSProperties } from "react";

/**
 * One node in a HUD layout tree. `type` looks up a component in the
 * registry; `props` are that component's own typed inputs (an accent
 * color, a numeric value, a label). `style` is the generic escape hatch
 * for anything CSS-expressible (spacing, opacity, borders) that isn't
 * worth a dedicated prop.
 *
 * Composite widgets (PlayerCard, MatchInfo, ...) are just nodes with
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
  /**
   * Semantic `data-*` attributes for this node's root element, Ark UI-style
   * (https://ark-ui.com/docs/guides/styling#data-attributes) — keys are
   * given without the `data-` prefix (`{ scope: "player", part: "root" }`
   * becomes `data-scope="player" data-part="root"`). `true` renders as a
   * present-but-empty attribute (`data-mvp=""`, matchable via `[data-mvp]`);
   * `false`/`undefined` omits the attribute entirely, so CSS never has to
   * distinguish "false" from "absent". This is how a node exposes state for
   * CSS to hook into, instead of branching on `props` inline.
   */
  data?: Record<string, string | number | boolean | undefined>;
  children?: SpecNode[];
}
