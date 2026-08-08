import { parseSeconds } from "@counter-strike-2-gsi/types/derive";

/**
 * Renders one of CS2's countdowns as a clock.
 *
 * `parseSeconds` handles the payload's side of this — countdowns arrive as
 * strings, and the optional ones are absent rather than zero. What is decided
 * here is presentation: `m:ss`, and floor rather than round so the timer never
 * shows a value the player still has — 0:07 must not appear while 7.9s remain.
 */
export function formatClock(seconds: string | number | undefined) {
  const total = typeof seconds === "number" ? seconds : parseSeconds(seconds);

  if (total === undefined) {
    return "--:--";
  }

  const clamped = Math.max(0, Math.floor(total));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;

  return `${mins}:${String(secs).padStart(2, "0")}`;
}

const MONEY = new Intl.NumberFormat("en-US");

export function formatMoney(amount: number | undefined) {
  return amount === undefined ? "$0" : `$${MONEY.format(amount)}`;
}

const WEAPON_PREFIX = /^weapon_/;
const UNDERSCORE = /_/g;

/**
 * `weapon_ak47` -> `AK47`, `weapon_m4a1_silencer` -> `M4A1 SILENCER`.
 * Purely cosmetic; the raw name is what any real logic should key off.
 */
export function formatWeapon(name: string | undefined) {
  if (!name) {
    return "";
  }

  return name.replace(WEAPON_PREFIX, "").replace(UNDERSCORE, " ").toUpperCase();
}
