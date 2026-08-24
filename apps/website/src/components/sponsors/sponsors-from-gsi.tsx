import { applyOverrides } from "../../hud/spec/apply-overrides.ts";
import type { SpecOverrides } from "../../hud/spec/apply-overrides.ts";
import { SpecRenderer } from "../../hud/spec/spec-renderer.tsx";
import type { SpecNode } from "../../hud/spec/types.ts";
import { sponsorsSpec } from "./sponsors-spec.ts";

/**
 * No GSI state to wait on — unlike every other `use*Spec` hook this one
 * never returns `undefined`, so `SponsorsFromGSI` has no empty-state branch.
 */
export function useSponsorsSpec(): SpecNode {
  return sponsorsSpec();
}

export function SponsorsFromGSI(props: {
  overrides?: SpecOverrides;
  selectedId?: string;
  onSelectNode?: (id: string) => void;
}) {
  const spec = useSponsorsSpec();

  return (
    <SpecRenderer
      node={props.overrides ? applyOverrides(spec, props.overrides) : spec}
      selectedId={props.selectedId}
      onSelectNode={props.onSelectNode}
    />
  );
}
