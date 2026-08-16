# @counter-strike-2-gsi/server

Transport-agnostic core for Counter-Strike 2 GSI. The `GSI` class takes raw payloads (from any HTTP server), validates them against the [`@counter-strike-2-gsi/types`](../types) schema, merges them into a persistent state, diffs old vs. new, and emits typed events.

It knows nothing about HTTP, SSE, or WebSockets — feed it with [`@counter-strike-2-gsi/handlers`](../handlers) or your own transport.

## Install

```bash
pnpm add @counter-strike-2-gsi/server
```

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

// Derived, HUD-oriented events — computed from the transition, not a raw path
manager.on("round:ended", ({ winner }) => console.log(`round over, ${winner} won`));
manager.on("bomb:planted", ({ player }) => console.log("bomb planted by", player));
manager.on("player:killed", ({ name, kills }) => console.log(`${name} +${kills} kill(s)`));

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
| `strictValidation` | `boolean`                            | `false`      | When `true`, `update()` rethrows validation/parse errors (after emitting `"error"`) so transport handlers can answer 4xx. When `false`, the payload is salvaged block by block (see below).                                  |
| `validatePayload`  | `boolean`                            | `true`       | When `false`, skips arktype schema validation entirely (payloads are still JSON-parsed and sanitized — `auth`/`previously`/`added` stripped). Fastest path for trusted local game traffic; `strictValidation` has no effect. |
| `logger`           | `GSILogger`                          | `console`    | Sink for the manager's own diagnostics: validation warnings, failed updates, listener exceptions. Any object with `warn`/`error` works (pino, winston, …); the package also exports a `silentLogger` that drops everything.  |
| `emitUpdateOnNoop` | `boolean`                            | `true`       | CS2 heartbeats at up to 64 Hz even when nothing changed. Set to `false` to emit `"update"` only when the merged state actually differs (costs one deep-equal walk per update). `reset()` always emits.                       |

### Methods

- `update(raw: unknown)` — parse, validate, merge, diff, emit. Accepts a JSON string or an already-parsed object.
- `on(event, handler)` — subscribe; returns an unsubscribe function. Event names and payloads are fully typed from `EventMap`.
- `off(event, handler?)` — remove one handler, or all handlers for the event when `handler` is omitted.
- `reset()` — clear state back to `{}`, emitting the corresponding change events for the current mode.
- `eventNames()` — event names that currently have at least one listener. This is the same set granular mode reads to decide which blocks are worth deep-diffing, so it's also the honest answer to "what is this instance paying for?".
- `listenerCount(event)` — number of listeners registered for one event.
- `state` (getter) — the current merged `SchemaPayload`.

## Change-detection modes

The mode is load-bearing: CS2 POSTs at up to ~64 Hz during play. Granular diffing runs [microdiff](https://github.com/AsyncBanana/microdiff), but it is **subscription-aware**: only top-level blocks with a listener registered under them get deep-diffed (blocks with just a block-level listener get a cheap deep-equal check; unsubscribed blocks are skipped). Cost scales with what you listen to, not with total state size — a typical HUD subscribing to a handful of paths pays less in granular mode than in block mode.

| Mode                 | Emits                                                                                                                                 | Cost                           | Use for                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ---------------------------------------------- |
| `granular` (default) | block events (`"player"`, `"round"`, …) **and** per-path events (`"player:state:health"`, `"allplayers:<steamid>:weapons:0:name"`, …) | microdiff per subscribed block | interactive HUDs, overlays, detailed analytics |
| `block`              | block events only (via fast-deep-equal)                                                                                               | light                          | most production HUDs at ~64 Hz                 |
| `minimal`            | no block or granular events                                                                                                           | negligible                     | background monitoring, logging                 |

Regardless of mode, every update also emits:

- `"update"` — the full merged state (suppressible on no-ops via `emitUpdateOnNoop: false`).
- `"allplayers:joined"` / `"allplayers:left"` — `Delta<string[]>` of SteamIDs computed from roster set differences.
- `"error"` — `{ error, context }` when parsing/validation/merging fails.
- `"validation"` — `{ summary, dropped, discarded }` when non-strict validation salvaged a payload: `dropped` names the top-level blocks that failed the schema and were discarded, `summary` is arktype's error text, and `discarded: true` flags the rare case where the payload root itself was invalid and the whole update was thrown away. Never fires in strict mode (which throws and emits `"error"`) or with `validatePayload: false`.
- **Derived events** — `"round:started"`, `"round:ended"`, `"bomb:planted"`, `"bomb:defused"`, `"bomb:exploded"`, `"player:died"`, `"player:killed"`. See below.

## Derived events

Raw paths (`"round:phase"`, `"bomb:state"`) report a value; derived events report a milestone — the way most HUDs actually think about a match. They're computed from the state transition itself, not read out of `LeafPaths`, and fire in every change-detection mode, including `minimal`.

| Event             | Fires when…                                       | Payload                                                                                                                               |
| ----------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `"round:started"` | `round.phase` becomes `"live"`                    | `{ round? }` — `map.round` at that moment                                                                                             |
| `"round:ended"`   | `round.phase` becomes `"over"`                    | `{ winner?, bomb?, round? }` — `round.win_team`/`round.bomb`                                                                          |
| `"bomb:planted"`  | `bomb.state` becomes `"planted"`                  | `{ player?, countdown? }`                                                                                                             |
| `"bomb:defused"`  | `bomb.state` becomes `"defused"`                  | `{ player? }`                                                                                                                         |
| `"bomb:exploded"` | `bomb.state` becomes `"exploded"`                 | `{ position? }`                                                                                                                       |
| `"player:died"`   | the observed player's `state.health` reaches `0`  | `{ steamid?, name? }`                                                                                                                 |
| `"player:killed"` | the observed player's `state.round_kills` goes up | `{ steamid?, name?, kills, headshots, round_kills }` — `kills` is the delta for this tick (usually `1`; collapses simultaneous frags) |

Worth knowing:

- **Edge-triggered, not level-triggered.** Each event fires once, exactly on the tick the watched field first reaches its target value — not on every subsequent payload that still reports it.
- **No event on the first payload ever observed.** With nothing to transition _from_ (a freshly constructed `GSI`, or right after `reset()`), the next payload is a snapshot, not a transition — even if it already reports `round.phase: "live"` or `bomb.state: "planted"`.
- **Best-effort on missed intermediate states.** If a `bomb` block appears already `"planted"` without ever having been observed `"planting"` (component just enabled, or a heartbeat skipped a beat), `"bomb:planted"` still fires — from the manager's point of view, that's the first moment the fact became true.
- **`player:died`/`player:killed` track the observed `player` block**, not the `allplayers` roster, and only while consecutive payloads report the same `steamid` — a spectator switching POV replaces one player's stats with another's, never a kill. For roster-wide tracking, subscribe to `"allplayers:<steamid>:state:health"` directly.
- Like `"allplayers:joined"`/`"allplayers:left"`, these share a block prefix with real schema blocks but are never diff paths — `"round:ended"` does not make `granular` mode deep-diff `round`.

## Behavior worth knowing

- **State is merged, not replaced.** CS2 sends partial payloads; `update()` deep-merges them into the existing state, so `manager.state` is always the full picture.
- **State snapshots are immutable.** Every update produces new objects for the sub-trees that changed and reuses the references for the ones that didn't. Nothing already handed out by `manager.state` — or by the `previous` side of a delta — is ever written to afterwards, including when sparse collections (roster, grenades, weapons) lose entries. Holding a reference across updates is safe; it just gives you that point in time.
- **Stripped keys.** `auth` (the shared secret — never allowed into state that gets broadcast to clients), `previously`, and `added` (CS2's own change-bookkeeping blocks) are removed before merging, and so is `allplayers.custom` (CS2's roster bookkeeping — the manager computes `allplayers:joined`/`allplayers:left` from the roster itself, so a literal `"custom"` entry would otherwise pollute SteamID iteration and emit event names the type system deliberately flattens away). You will never receive `previously:*` or `allplayers:custom:*` events.
- **Listener errors are contained.** A throwing listener is logged and does not break other listeners or the update loop.
- **Validation failures are non-fatal by default.** The failing top-level blocks are dropped and the rest of the payload is still merged, with a console warning naming what went wrong — a malformed `player` never costs you a perfectly good `map`. If the payload root itself is invalid there is nothing to salvage and the update is discarded whole. Turn on `strictValidation` if you'd rather reject outright, or turn off `validatePayload` to skip schema validation entirely when the source is trusted.
- **A validation warning is often CS2 drift, not bad data.** Most schema fields are wide or open and never fail; the ones that can are the closed enums mirroring CS2's own values (round phase, bomb state, weapon type, grenade type, …). A warning naming one of those after a game update usually means Valve added a new value before `@counter-strike-2-gsi/types` knew about it — see [the types README](../types/README.md#a-validation-warning-can-mean-cs2-changed-not-that-your-data-is-bad) for the full list and how to extend the schema.

## The CS2 payload contract (as this package assumes it)

What CS2 actually POSTs depends on the components enabled in your `gamestate_integration_*.cfg`, but the merge layer relies on these rules:

- **Payloads are partial.** A block absent from a payload means "unchanged", never "gone". Only `previously`/`added` (which are stripped) describe removals on CS2's side; state removal here comes from the sparse-collection rules below.
- **`allplayers`, `grenades`, and every `weapons` map are sparse collections.** When one of these keys _is present_, its contents are the complete truth: an entry missing from it (a disconnected player, an exploded grenade, a dropped weapon) is pruned from state. `{}` therefore empties the collection, and an explicit `null` (only possible with `validatePayload: false` — CS2 never sends it) removes the key from state entirely. When the key is absent, the collection in state is left untouched.
- **`allplayers` only appears in observer/spectator mode** (with `"allplayers_*"` components enabled); `bomb` and `grenades` likewise require their components. Expect these blocks to be absent in normal play and design listeners accordingly — `"allplayers:joined"`/`"allplayers:left"` simply never fire.
- **Heartbeats are real.** CS2 re-POSTs at up to ~64 Hz (`buffer`/`throttle`/`heartbeat` in the cfg) including payloads that change nothing; `emitUpdateOnNoop: false` exists for exactly that traffic.

## Development

```bash
pnpm test        # vp test — tests in src/__tests__, fixtures in tests/fixtures
pnpm build       # vp pack → dist/
pnpm typecheck   # tsc --noEmit
```
