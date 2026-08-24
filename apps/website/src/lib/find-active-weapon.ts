import type { SchemaPayload } from "@counter-strike-2-gsi/types";

type Weapons = NonNullable<NonNullable<SchemaPayload["player"]>["weapons"]>;
type Weapon = Weapons[string];

/**
 * The schema has no single "active weapon" leaf path — `state: "active"`
 * lives per weapon-slot key (`weapon_0`, `weapon_1`, ...), so finding it
 * means scanning the whole `weapons` object. Shared under `lib/` (not a
 * single widget's folder) because both the observed player and every
 * roster entry in `match-info-from-gsi.tsx` need the same lookup.
 */
export function findActiveWeapon(weapons: Weapons | undefined): Weapon | undefined {
  if (!weapons) {
    return undefined;
  }

  return Object.values(weapons).find((weapon) => weapon.state === "active");
}
