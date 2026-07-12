# @counter-strike-2-gsi/types

arktype-backed schema for the raw Counter-Strike 2 GSI payload, plus the derived TypeScript types every other package in the stack builds on. This package is the single source of truth: event names, event payload types, and payload validation all flow from the schema defined here.

## Install

```bash
pnpm add @counter-strike-2-gsi/types
```

(Not published to npm yet — use `"workspace:*"` inside this monorepo.)

## What's exported

### Runtime

- `schema` — the exported arktype scope. `schema.payload(raw)` validates a full GSI payload and returns either the typed payload or `ArkErrors`. Sub-validators (`schema.player`, `schema.map`, `schema.bomb`, …) are available for individual blocks.

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

## How event names are generated

`LeafPaths<SchemaPayload>` walks the schema and produces a `{ path, type }` pair for every node, joining keys with `:`. Rules worth knowing:

- **Index signatures** (SteamID-keyed maps like `allplayers`, weapon slots, grenades) produce template-literal paths: `` `allplayers:${string}:state:health` ``.
- **The `custom` key is flattened**: `allplayers.custom.joined` becomes the event `"allplayers:joined"`, not `"allplayers:custom:joined"`.
- **Depth is capped at 5**, which exactly covers the deepest real family, `allplayers:<steamid>:weapons:<slot>:<field>`.
- Intermediate nodes get events too — subscribing to `"player:state"` gives you the whole state object as a `Delta`.

## Extending the schema

To support a new field or block, edit the arktype scope in [src/schema/index.ts](src/schema/index.ts) — do not hand-write event types. `GeneratedEventMap`, validation, and every consumer (server, handlers, client hooks) pick up the new event names automatically.

Notes on deliberate schema looseness:

- `map.name` is an open `string` (pinning the map pool would reject workshop maps and break whole-payload validation on every pool update).
- All top-level blocks on `payload` are optional — CS2 only sends the blocks enabled in your `gamestate_integration_*.cfg`, and omits e.g. `bomb`/`allplayers` outside of observer mode.

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
