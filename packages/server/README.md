# @counter-strike-2-gsi/server

Transport-agnostic core for Counter-Strike 2 GSI. The `GSI` class takes raw payloads (from any HTTP server), validates them against the [`@counter-strike-2-gsi/types`](../types) schema, merges them into a persistent state, diffs old vs. new, and emits typed events.

It knows nothing about HTTP, SSE, or WebSockets — feed it with [`@counter-strike-2-gsi/handlers`](../handlers) or your own transport.

## Install

```bash
pnpm add @counter-strike-2-gsi/server
```

(Not published to npm yet — use `"workspace:*"` inside this monorepo.)

## Usage

```ts
import { GSI } from "@counter-strike-2-gsi/server";

const manager = new GSI({ changeDetection: "granular" });

// Block-level event: fires when anything under `player` changes
const unsubscribe = manager.on("player", ({ previous, current }) => { ... });

// Granular event: fires only when this exact path changes
manager.on("player:state:health", ({ previous, current }) => {
  console.log(`health ${previous} → ${current}`);
});

// Roster events (observer mode)
manager.on("allplayers:joined", ({ current }) => console.log("joined:", current));

// Every accepted payload
manager.on("update", (state) => { ... });

// Feed it raw payloads from your transport (string or object)
manager.update(rawBody);

// Read the current merged state at any time
manager.state; // Readonly<SchemaPayload>

unsubscribe(); // manager.on returns an unsubscribe function
```

## API

### `new GSI(options?)`

| Option             | Type                                 | Default      | Description                                                                                                                                                                                                                  |
| ------------------ | ------------------------------------ | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `changeDetection`  | `"granular" \| "block" \| "minimal"` | `"granular"` | Change-detection depth (see below).                                                                                                                                                                                          |
| `strictValidation` | `boolean`                            | `false`      | When `true`, `update()` rethrows validation/parse errors (after emitting `"error"`) so transport handlers can answer 4xx. When `false`, invalid payloads log a warning and are applied as-is.                                |
| `validatePayload`  | `boolean`                            | `true`       | When `false`, skips arktype schema validation entirely (payloads are still JSON-parsed and sanitized — `auth`/`previously`/`added` stripped). Fastest path for trusted local game traffic; `strictValidation` has no effect. |

### Methods

- `update(raw: unknown)` — parse, validate, merge, diff, emit. Accepts a JSON string or an already-parsed object.
- `on(event, handler)` — subscribe; returns an unsubscribe function. Event names and payloads are fully typed from `EventMap`.
- `off(event, handler?)` — remove one handler, or all handlers for the event when `handler` is omitted.
- `reset()` — clear state back to `{}`, emitting the corresponding change events for the current mode.
- `state` (getter) — the current merged `SchemaPayload`.

## Change-detection modes

The mode is load-bearing: CS2 POSTs at up to ~64 Hz during play, and granular diffing runs [microdiff](https://github.com/AsyncBanana/microdiff) on every update.

| Mode                 | Emits                                                                                                                                 | Cost                 | Use for                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ---------------------------------------------- |
| `granular` (default) | block events (`"player"`, `"round"`, …) **and** per-path events (`"player:state:health"`, `"allplayers:<steamid>:weapons:0:name"`, …) | microdiff per update | interactive HUDs, overlays, detailed analytics |
| `block`              | block events only (via fast-deep-equal)                                                                                               | light                | most production HUDs at ~64 Hz                 |
| `minimal`            | no block or granular events                                                                                                           | negligible           | background monitoring, logging                 |

Regardless of mode, every update also emits:

- `"update"` — the full merged state.
- `"allplayers:joined"` / `"allplayers:left"` — `Delta<string[]>` of SteamIDs computed from roster set differences.
- `"error"` — `{ error, context }` when parsing/validation/merging fails.

## Behavior worth knowing

- **State is merged, not replaced.** CS2 sends partial payloads; `update()` deep-merges them into the existing state, so `manager.state` is always the full picture.
- **Stripped keys.** `auth` (the shared secret — never allowed into state that gets broadcast to clients), `previously`, and `added` (CS2's own change-bookkeeping blocks) are removed before merging. You will never receive `previously:*` events.
- **Listener errors are contained.** A throwing listener is logged and does not break other listeners or the update loop.
- **Validation failures are non-fatal by default** — the payload is applied as-is with a console warning. Turn on `strictValidation` if you'd rather reject, or turn off `validatePayload` to skip schema validation entirely when the source is trusted.

## Development

```bash
pnpm test        # vp test — tests in src/__tests__, fixtures in tests/fixtures
pnpm build       # vp pack → dist/
pnpm typecheck   # tsc --noEmit
```
