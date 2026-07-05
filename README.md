# counter-strike-2-gsi

A TypeScript stack for [Counter-Strike 2 Game State Integration](https://developer.valvesoftware.com/wiki/Counter-Strike:_Global_Offensive_Game_State_Integration) (GSI): receive the payloads CS2 POSTs to your server, validate and diff them, and fan typed events out to HUDs, overlays, and dashboards over SSE or WebSocket.

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
