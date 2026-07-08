# counter-strike-2-gsi

A TypeScript stack for [Counter-Strike 2 Game State Integration](https://developer.valvesoftware.com/wiki/Counter-Strike:_Global_Offensive_Game_State_Integration) (GSI): receive the payloads CS2 POSTs to your server, validate and diff them, and fan typed events out to HUDs, overlays, and dashboards over SSE or WebSocket.

## Features

- **Every path is a typed event.** Event names like `"player:state:health"` and `"allplayers:<steamid>:weapons:0:name"` are auto-generated from the arktype schema — extend the schema and new events appear, fully typed, with no hand-written differs to maintain.
- **Persistent merged state.** CS2 posts partial snapshots; the manager deep-merges them so `manager.state` is always the complete picture, with sparse collections (roster, grenades, weapons) pruned correctly when entries disappear.
- **Pay only for what you listen to.** Granular diffing is subscription-aware — unsubscribed blocks are never deep-diffed — and three change-detection modes plus optional validation tune the cost further.
- **Validated, safe ingress.** Payloads are checked against the schema (opt-out via `validatePayload`), the `auth` secret is stripped before state can reach clients, and incoming payloads are never mutated.
- **Roster tracking built in.** `"allplayers:joined"` / `"allplayers:left"` fire in every mode from SteamID set differences.
- **Transport-agnostic core, batteries-included edges.** One `GSI` manager; HTTP ingress + SSE/WS fan-out handlers for Node, Bun, and Hono; browser clients with auto-reconnect and React hooks.
- **Benchmarked, not vibes.** A cross-library [benchmark suite](benchmarks) ships in the repo, measuring every configuration against comparable libraries on realistic 64Hz workloads — with the methodology and trade-offs documented.

## Packages

| Package                                               | What it does                                                                                                                                             |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`@counter-strike-2-gsi/types`](packages/types)       | arktype schema for the raw GSI payload plus derived TypeScript types. Every event name (e.g. `"player:state:health"`) is auto-generated from the schema. |
| [`@counter-strike-2-gsi/server`](packages/server)     | Transport-agnostic `GSI` manager: validates payloads, merges state, and emits typed events with configurable change-detection depth.                     |
| [`@counter-strike-2-gsi/handlers`](packages/handlers) | HTTP ingress + SSE/WS egress adapters for **Node**, **Bun**, and **Hono**, wired to a `GSI` manager.                                                     |
| [`@counter-strike-2-gsi/client`](packages/client)     | Browser SSE/WS clients with auto-reconnect, plus React hooks (`GSIProvider`, `useGSIEvent`, `useGSISelector`, …).                                        |

Data flows in one direction:

```
CS2 (POST /gsi) → handlers (HTTP) → server (validate → merge → diff → emit) → handlers (SSE/WS) → client (browser/React)
```

## Performance

Measured against the other maintained JavaScript GSI processors on a realistic observer-mode round replay (full methodology and numbers in [benchmarks](benchmarks)):

| Library                                              | Updates/sec | Validates payloads | Handles partial payloads | Events                   |
| ---------------------------------------------------- | ----------- | ------------------ | ------------------------ | ------------------------ |
| **`@counter-strike-2-gsi/server`** (granular)        | ~36,000     | arktype (optional) | yes                      | every schema path, typed |
| [`csgogsi`](https://github.com/osztenkurden/csgogsi) | ~70,000     | no                 | no (throws)              | ~19 curated              |
| [`cs2-gsi-z`](https://github.com/alebcj/cs2-gsi-z)   | ~10,000     | no                 | yes                      | ~30 curated              |

CS2 emits at most ~64 updates/s, so all of these are far past the real workload; the differences only matter under synthetic load. Granular diffing is subscription-aware — cost scales with the events you listen to, not with state size.

## Quick start

### 1. Tell CS2 where to send game state

Create `gamestate_integration_myapp.cfg` in your CS2 config directory (`.../Counter-Strike Global Offensive/game/csgo/cfg/`):

```
"My CS2 GSI App"
{
  "uri" "http://127.0.0.1:3000/gsi"
  "timeout" "5.0"
  "buffer" "0.1"
  "throttle" "0.1"
  "heartbeat" "10.0"
  "auth"
  {
    "token" "my-secret-token"
  }
  "data"
  {
    "provider"            "1"
    "map"                 "1"
    "round"               "1"
    "player_id"           "1"
    "player_state"        "1"
    "player_weapons"      "1"
    "player_match_stats"  "1"
    "allplayers_id"       "1"
    "allplayers_state"    "1"
    "allplayers_match_stats" "1"
    "allplayers_weapons"  "1"
    "allplayers_position" "1"
    "phase_countdowns"    "1"
    "bomb"                "1"
    "grenades"            "1"
  }
}
```

> `allplayers_*`, `bomb`, and `grenades` are only populated when observing (spectator/GOTV), not while playing.

### 2. Run a server

```ts
import { createServer } from "node:http";
import { GSI } from "@counter-strike-2-gsi/server";
import { createGSINode } from "@counter-strike-2-gsi/handlers/node";

const manager = new GSI({ changeDetection: "granular" });

manager.on("player:state:health", ({ previous, current }) => {
  console.log(`health: ${previous} → ${current}`);
});

const gsi = createGSINode({ manager, token: "my-secret-token" });

const server = createServer(gsi.handler); // POST /gsi + GET /sse
gsi.attach(server); // WS upgrade on /ws
server.listen(3000);
```

Bun and Hono setups look the same via `createGSIBun` / `createGSIHono` — see the [handlers README](packages/handlers/README.md).

### 3. Consume it in the browser

```tsx
import { GSIProvider, useGSIEvent } from "@counter-strike-2-gsi/client";

function Health() {
  const health = useGSIEvent("player:state:health");
  return <span>{health ?? "—"}</span>;
}

export function App() {
  return (
    <GSIProvider url="http://localhost:3000/sse">
      <Health />
    </GSIProvider>
  );
}
```

Pass a `ws://` URL to use the WebSocket transport instead — see the [client README](packages/client/README.md).

> The packages are not published to npm yet; consume them from this workspace with `"@counter-strike-2-gsi/<name>": "workspace:*"`.

## Development

pnpm workspace monorepo built with [Vite+](https://viteplus.dev) (`vp` CLI). Requires Node >= 22.12.0 and pnpm.

```bash
pnpm install        # install workspace deps
pnpm ready          # fmt + lint + test + build everything (run before pushing)
pnpm dev            # website dev server
vp test             # all package tests
vp run -r build     # build all packages
```

Per-package: `pnpm build`, `pnpm dev` (watch), `pnpm test`, `pnpm typecheck`.

Repo layout: publishable code lives in [`packages/*`](packages); [`apps/website`](apps/website) is a Vite playground app (not yet wired to the client).

## License

[MIT](LICENSE)
