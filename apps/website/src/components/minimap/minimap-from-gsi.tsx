import { useGSIEvent } from "@counter-strike-2-gsi/client";

import { applyOverrides } from "../../hud/spec/apply-overrides.ts";
import type { SpecOverrides } from "../../hud/spec/apply-overrides.ts";
import { SpecRenderer } from "../../hud/spec/spec-renderer.tsx";
import type { SpecNode } from "../../hud/spec/types.ts";
import { minimapSpec } from "./minimap-spec.ts";

export function useMinimapSpec(): SpecNode {
  const position = useGSIEvent("player:position");

  return minimapSpec({ position });
}

export function MinimapFromGSI(props: {
  overrides?: SpecOverrides;
  selectedId?: string;
  onSelectNode?: (id: string) => void;
}) {
  const spec = useMinimapSpec();

  return (
    <SpecRenderer
      node={props.overrides ? applyOverrides(spec, props.overrides) : spec}
      selectedId={props.selectedId}
      onSelectNode={props.onSelectNode}
    />
  );
}
