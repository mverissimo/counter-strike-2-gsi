# @counter-strike-2-gsi/types

arktype-backed schema for the raw Counter-Strike 2 GSI payload, plus the derived TypeScript types every other package in the stack builds on. This package is the single source of truth: event names, event payload types, and payload validation all flow from the schema defined here.

## Install

```bash
pnpm add @counter-strike-2-gsi/types
```

## What's exported

### Runtime

- `schema` — the exported arktype scope. `schema.payload(raw)` validates a full GSI payload and returns either the typed payload or `ArkErrors`. Sub-validators (`schema.player`, `schema.map`, `schema.bomb`, …) are available for individual blocks.
- `MAX_PATH_DEPTH` — the depth cap applied to generated event paths (see below). Exported so the limit is inspectable and testable rather than a magic number buried in a conditional type.

### Payload types

Inferred from the schema, one per block:

`SchemaPayload` (the whole POST body), `SchemaProvider`, `SchemaMap`, `SchemaBomb`, `SchemaRound`, `SchemaPlayer`, `SchemaPhaseCountdowns`, `SchemaAllPlayers`, `SchemaGrenades`, `SchemaAuth`, `SchemaDelta`.

### Event types

- `Delta<T>` — `{ previous?: T; current: T }`, the payload shape of every change event.
- `GeneratedEventMap` — every auto-generated event name mapped to its `Delta` payload. Names are colon-separated paths derived from `SchemaPayload` via `LeafPaths`, e.g. `"player"`, `"player:state:health"`, `` `allplayers:${string}:weapons:${string}:name` ``.
- `EventMap` — `GeneratedEventMap` plus the system events:
  - `"update"` → the full merged `SchemaPayload` (emitted on every accepted payload)
  - `"error"` → `{ error: Error; context: string }`
  - `"allplayers:joined"` / `"allplayers:left"` → `Delta<string[]>` of SteamIDs
- `EventPayload<E>` — payload type for a given event name.
- `Block` / `BlockEventName` / `GranularEventName` — top-level block names vs. nested path events.
- `PathValue<T, P>` — resolves the value type at a colon-separated path; used by the client hooks so template-literal keys like `` `allplayers:${string}:name` `` narrow to `string` instead of a wide union.

## The `/derive` subpath

```ts
import { carriesBomb, heldWeapon, parseSeconds, players } from "@counter-strike-2-gsi/types/derive";
```

A handful of pure functions for the parts of the payload whose shape is easy to read wrong. They are a separate entry point, so the root export stays schema + types and nothing pulls in runtime code it didn't ask for.

- `players(allplayers)` — `[steamid, player]` pairs, `custom` excluded, ordered by `observer_slot`. `custom` is roster-change bookkeeping rather than a player, so `Object.entries` yields an eleventh entry with no name, team or health; and key order is not stable between ticks, so payload order makes rows swap places at random.
- `heldWeapon(weapons)` — the weapon in hand, matching `"active"` **and** `"reloading"`. CS2 flips the state for the duration of the reload animation, during which nothing reports `"active"` — match only that and the weapon vanishes from a HUD on every reload.
- `carriesBomb(weapons)` — whether the player holds the C4. It is an ordinary `weapons` entry named `weapon_c4` whose `state` is irrelevant, and no other field identifies the carrier.
- `parseSeconds(countdown)` — parses the string countdowns (`bomb.countdown`, `phase_countdowns.phase_ends_in`), returning `undefined` rather than `NaN` for absent or unparseable values.

The bar for adding here: **can a test for it fail because the game disagrees with you?** If yes it is a rule about the schema and belongs in this package. If it can only fail because someone changed their mind — field selection, thresholds, formatting — it is a presentation choice and belongs in the consuming app.

## How event names are generated

`LeafPaths<SchemaPayload>` walks the schema and produces a `{ path, type }` pair for every node, joining keys with `:`. Rules worth knowing:

- **Index signatures** (SteamID-keyed maps like `allplayers`, weapon slots, grenades) produce template-literal paths: `` `allplayers:${string}:state:health` ``.
- **The `custom` key is flattened**: `allplayers.custom.joined` becomes the event `"allplayers:joined"`, not `"allplayers:custom:joined"`. That is deliberate, and it's what keeps the schema-derived name lined up with the one the server actually emits: `"allplayers:joined"` / `"allplayers:left"` are **computed** by `@counter-strike-2-gsi/server` from the SteamID set difference between two states, not read out of the payload, and they're declared by hand on `EventMap`. CS2 does send `allplayers.custom` when the roster changes, so without the flatten a granular diff would emit `"allplayers:custom:joined"` too, splitting one concept across two event names. Drop the flatten only if the hand-declared events on `EventMap` are renamed to match.
- **Depth is capped at `MAX_PATH_DEPTH`** (5), which exactly covers the deepest real family, `allplayers:<steamid>:weapons:<slot>:<field>`. Each level multiplies type instantiations, so this is the lever that keeps schema changes from blowing up compile times. Flattened keys don't spend a level. A test walks the arktype schema and asserts the real deepest path is exactly this number, so growing the schema past it fails the build instead of silently dropping event names.
- Intermediate nodes get events too — subscribing to `"player:state"` gives you the whole state object as a `Delta`.

## Extending the schema

To support a new field or block, edit the arktype scope in [src/schema/index.ts](src/schema/index.ts) — do not hand-write event types. `GeneratedEventMap`, validation, and every consumer (server, handlers, client hooks) pick up the new event names automatically.

Notes on deliberate schema looseness:

- `map.name` is an open `string` (pinning the map pool would reject workshop maps and break whole-payload validation on every pool update).
- All top-level blocks on `payload` are optional — CS2 only sends the blocks enabled in your `gamestate_integration_*.cfg`, and omits e.g. `bomb`/`allplayers` outside of observer mode.

### A validation warning can mean CS2 changed, not that your data is bad

Most fields are wide (`string`, `number`) or fully open (unknown keys pass through arktype's default policy), so they never fail validation. The fields that _can_ fail are the closed string unions that mirror CS2's own enums: `map.mode`, `map.phase`/`round.phase`/`phase_countdowns.phase`, `round.win_team`, `bomb.state`/`round.bomb`, `player.activity`, `player.team`, `player.weapons[].type`/`.state`, and `grenades[].type`.

When Valve ships a game update that adds a new value to one of these — a new grenade type, a new round-end reason — before this schema knows about it, `schema.payload()` fails validation on that one field. `@counter-strike-2-gsi/server`'s default (non-strict) handling then drops the **entire top-level block** the field lives in for that update and logs a warning naming the exact path and value (see the [server README](../server/README.md#behavior-worth-knowing)). That warning isn't saying the payload is corrupt — it's saying CS2 sent a value this schema doesn't recognize yet. Treat it as a prompt to check what changed and extend the relevant union in [src/schema/index.ts](src/schema/index.ts), not as noise to suppress.

## Example

```ts
import { schema } from "@counter-strike-2-gsi/types";
import type { EventPayload, PathValue, SchemaPayload } from "@counter-strike-2-gsi/types";

const result = schema.payload(JSON.parse(body));

type HealthDelta = EventPayload<"player:state:health">;
// { previous?: number; current: number }

type Name = PathValue<SchemaPayload, `allplayers:${string}:name`>;
// string | undefined
```

## Development

```bash
pnpm test        # vp test
pnpm build       # vp pack → dist/
pnpm typecheck   # tsc --noEmit
```
