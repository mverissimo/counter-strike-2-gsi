---
"@counter-strike-2-gsi/types": minor
---

Add a `@counter-strike-2-gsi/types/derive` subpath with readers for the parts
of the payload whose shape is easy to get wrong:

- `players(allplayers)` — `[steamid, player]` pairs with the `custom` block
  excluded, ordered by `observer_slot`. `custom` is roster-change bookkeeping,
  not a player, so `Object.entries(allplayers)` yields an eleventh entry with
  no name, team or health that renders as a blank row and skews counts taken
  over the roster. The order is fixed because key order in the payload is not
  stable between ticks, which makes roster rows swap places at random.
- `carriesBomb(weapons)` — whether the player holds the C4. The bomb is an
  ordinary `weapons` entry named `weapon_c4` and its state is irrelevant; no
  other field in the payload identifies the carrier.
- `heldWeapon(weapons)` — the weapon in hand, matching `"active"` **and**
  `"reloading"`. CS2 flips the state for the duration of the reload animation,
  during which no weapon reports `"active"`, so matching only `"active"` makes
  the weapon vanish from a HUD on every reload.
- `parseSeconds(countdown)` — parses the string countdowns
  (`bomb.countdown`, `phase_countdowns.phase_ends_in`), returning `undefined`
  rather than `NaN` for absent or unparseable values.

Pure functions with no React, DOM or runtime assumptions, so browser overlays
and Node consumers can share them. The root export is unchanged.
