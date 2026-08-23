import { applyOverrides } from "../../hud/spec/apply-overrides.ts";
import type { SpecOverrides } from "../../hud/spec/apply-overrides.ts";
import { SpecRenderer } from "../../hud/spec/spec-renderer.tsx";
import type { SpecNode } from "../../hud/spec/types.ts";
import { killFeedSpec } from "./kill-feed-spec.ts";
import { useKillFeedLog } from "./use-kill-feed-log.ts";

export function useKillFeedSpec(): SpecNode {
  const entries = useKillFeedLog();

  return killFeedSpec(entries);
}

export function KillFeedFromGSI(props: {
  overrides?: SpecOverrides;
  selectedId?: string;
  onSelectNode?: (id: string) => void;
}) {
  const spec = useKillFeedSpec();

  return (
    <SpecRenderer
      node={props.overrides ? applyOverrides(spec, props.overrides) : spec}
      selectedId={props.selectedId}
      onSelectNode={props.onSelectNode}
    />
  );
}
