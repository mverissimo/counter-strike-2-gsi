import { useGSIEvent, useGSIState } from "@counter-strike-2-gsi/client";

import { applyOverrides } from "../../hud/spec/apply-overrides.ts";
import type { SpecOverrides } from "../../hud/spec/apply-overrides.ts";
import { SpecRenderer } from "../../hud/spec/spec-renderer.tsx";
import type { SpecNode } from "../../hud/spec/types.ts";
import { roundTimerSpec } from "./round-timer-spec.ts";

/**
 * Scores and phase come from `useGSIState()` — they only change a few times
 * a match, so a granular subscriber connecting mid-round would otherwise
 * stay blank until the next round ends. The countdown changes almost every
 * server tick, so it's the one field that's a good fit for the granular
 * `useGSIEvent` hook (see `player-card-from-gsi.tsx` for the same tradeoff).
 */
export function useRoundTimerSpec(): SpecNode | undefined {
  const map = useGSIState()?.map;
  const countdown = useGSIEvent("phase_countdowns:phase_ends_in");

  if (!map) {
    return undefined;
  }

  return roundTimerSpec({
    scoreCt: map.team_ct.score,
    scoreT: map.team_t.score,
    phase: map.phase,
    countdown,
  });
}

export function RoundTimerFromGSI(props: {
  overrides?: SpecOverrides;
  selectedId?: string;
  onSelectNode?: (id: string) => void;
}) {
  const spec = useRoundTimerSpec();

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
