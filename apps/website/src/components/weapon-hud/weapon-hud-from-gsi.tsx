import { useGSIState } from "@counter-strike-2-gsi/client";

import { applyOverrides } from "../../hud/spec/apply-overrides.ts";
import type { SpecOverrides } from "../../hud/spec/apply-overrides.ts";
import { SpecRenderer } from "../../hud/spec/spec-renderer.tsx";
import type { SpecNode } from "../../hud/spec/types.ts";
import { findActiveWeapon } from "./find-active-weapon.ts";
import { weaponHudSpec } from "./weapon-hud-spec.ts";

export function useWeaponHudSpec(): SpecNode | undefined {
  const state = useGSIState();
  const weapon = findActiveWeapon(state?.player?.weapons);

  if (!weapon) {
    return undefined;
  }

  return weaponHudSpec({
    name: weapon.name.replace(/^weapon_/, ""),
    ammoClip: weapon.ammo_clip,
    ammoReserve: weapon.ammo_reserve,
  });
}

export function WeaponHudFromGSI(props: {
  overrides?: SpecOverrides;
  selectedId?: string;
  onSelectNode?: (id: string) => void;
}) {
  const spec = useWeaponHudSpec();

  if (!spec) {
    return <p style={{ color: "#565a66", fontSize: 12 }}>Sem arma ativa.</p>;
  }

  return (
    <SpecRenderer
      node={props.overrides ? applyOverrides(spec, props.overrides) : spec}
      selectedId={props.selectedId}
      onSelectNode={props.onSelectNode}
    />
  );
}
