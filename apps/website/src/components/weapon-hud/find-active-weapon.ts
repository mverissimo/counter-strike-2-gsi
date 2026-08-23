import type { SchemaPayload } from "@counter-strike-2-gsi/types";

type Weapons = NonNullable<NonNullable<SchemaPayload["player"]>["weapons"]>;
type Weapon = Weapons[string];

/**
 * The schema has no single "active weapon" leaf path — `state: "active"`
 * lives per weapon-slot key (`weapon_0`, `weapon_1`, ...), so finding it
 * means scanning the whole `weapons` object. That's why this reads from
 * `useGSIState()` (the full payload) rather than a granular event.
 */
export function findActiveWeapon(weapons: Weapons | undefined): Weapon | undefined {
  if (!weapons) {
    return undefined;
  }

  return Object.values(weapons).find((weapon) => weapon.state === "active");
}
