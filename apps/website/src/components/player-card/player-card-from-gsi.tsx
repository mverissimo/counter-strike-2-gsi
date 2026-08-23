import { useGSIEvents, useGSIState } from "@counter-strike-2-gsi/client";

import { applyOverrides } from "../../hud/spec/apply-overrides.ts";
import type { SpecOverrides } from "../../hud/spec/apply-overrides.ts";
import { SpecRenderer } from "../../hud/spec/spec-renderer.tsx";
import type { SpecNode } from "../../hud/spec/types.ts";
import { playerCardSpec } from "./player-card-spec.ts";

/**
 * Builds the live PlayerCard spec from GSI state, undefined until a player
 * is actually observed. Split from the render below so an editor can read
 * the base (pre-override) tree — for `findNode` lookups in a properties
 * panel — without duplicating the GSI subscription.
 *
 * `name`/`team` come from `useGSIState()` (the full snapshot, delivered to
 * every fresh connection) rather than a granular hook: those fields rarely
 * change mid-session, and a granular hook only has a value once its path
 * changes *after* this component subscribed — connecting mid-match would
 * otherwise leave the card blank until the next team swap. `health`/`armor`
 * change constantly, so the granular `useGSIEvents` hook (cheap re-renders,
 * no unrelated state slice) is the better fit there.
 */
export function usePlayerCardSpec(): SpecNode | undefined {
  const { name, team } = useGSIState()?.player ?? {};
  const { "player:state:health": health, "player:state:armor": armor } = useGSIEvents([
    "player:state:health",
    "player:state:armor",
  ]);

  if (!name) {
    return undefined;
  }

  return playerCardSpec({ name, team, health: health ?? 0, armor: armor ?? 0 });
}

export function PlayerCardFromGSI(props: {
  overrides?: SpecOverrides;
  selectedId?: string;
  onSelectNode?: (id: string) => void;
}) {
  const spec = usePlayerCardSpec();

  if (!spec) {
    return <p style={{ color: "#565a66", fontSize: 12 }}>Sem jogador observado ainda.</p>;
  }

  return (
    <SpecRenderer
      node={props.overrides ? applyOverrides(spec, props.overrides) : spec}
      selectedId={props.selectedId}
      onSelectNode={props.onSelectNode}
    />
  );
}
