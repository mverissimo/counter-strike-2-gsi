import { useGSIState } from "@counter-strike-2-gsi/client";

import { applyOverrides } from "../../hud/spec/apply-overrides.ts";
import type { SpecOverrides } from "../../hud/spec/apply-overrides.ts";
import { SpecRenderer } from "../../hud/spec/spec-renderer.tsx";
import type { SpecNode } from "../../hud/spec/types.ts";
import { mapRotationSpec } from "./map-rotation-spec.ts";

export function useMapRotationSpec(): SpecNode | undefined {
  const mapName = useGSIState()?.map?.name;

  if (!mapName) {
    return undefined;
  }

  return mapRotationSpec(mapName);
}

export function MapRotationFromGSI(props: {
  overrides?: SpecOverrides;
  selectedId?: string;
  onSelectNode?: (id: string) => void;
}) {
  const spec = useMapRotationSpec();

  if (!spec) {
    return <p style={{ color: "#565a66", fontSize: 12 }}>Sem partida em andamento.</p>;
  }

  return (
    <SpecRenderer
      node={props.overrides ? applyOverrides(spec, props.overrides) : spec}
      selectedId={props.selectedId}
      onSelectNode={props.onSelectNode}
    />
  );
}
