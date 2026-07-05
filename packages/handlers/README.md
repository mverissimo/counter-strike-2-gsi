# @counter-strike-2-gsi/handlers

Runtime adapters that wire a [`GSI`](../server) manager to real servers: HTTP ingress for the payloads CS2 POSTs, and SSE / WebSocket egress to fan events out to browsers. **Node**, **Bun**, and **Hono** are supported, each behind its own subpath export.

## Install

```bash
pnpm add @counter-strike-2-gsi/handlers
# Hono adapter only: hono is an optional peer
pnpm add hono
```

(Not published to npm yet — use `"workspace:*"` inside this monorepo.)

## Entry points

The root export (`@counter-strike-2-gsi/handlers`) is runtime-free: shared core types (`GSIHandlerOptions`, `SSEOptions`, `WSOptions`, writer/session interfaces) and helpers (`classifyHandlerError`, `safeTokenEqual`). Runtime code lives behind subpaths so you only pull in your host's dependencies:

| Import                                | Runtime     | Notes                                                          |
| ------------------------------------- | ----------- | -------------------------------------------------------------- |
| `@counter-strike-2-gsi/handlers/node` | Node `http` | WS via the `ws` package                                        |
| `@counter-strike-2-gsi/handlers/bun`  | `Bun.serve` | native WS                                                      |
| `@counter-strike-2-gsi/handlers/hono` | Hono        | requires the optional `hono` peer; WS helper injected per host |

Each subpath exports an all-in-one factory (`createGSINode` / `createGSIBun` / `createGSIHono`) plus the individual handlers (`create<Runtime>Handler`, `createSSEHandler`, `create<Runtime>WSHandler`) if you want to wire routes yourself.

## Usage

Default routes for all three factories: `POST /gsi` (ingress), `GET /sse`, `GET /ws` — override with `gsiPath` / `ssePath` / `wsPath`.

### Node

```ts
import { createServer } from "node:http";
import { GSI } from "@counter-strike-2-gsi/server";
import { createGSINode } from "@counter-strike-2-gsi/handlers/node";

const manager = new GSI();
const gsi = createGSINode({ manager, token: process.env.GSI_TOKEN });

const server = createServer(gsi.handler); // dispatches /gsi + /sse
gsi.attach(server); // wires the WS upgrade on /ws
server.listen(3000);
```

To compose into an existing request listener, call `gsi.handler(req, res)` for your GSI routes, or use `gsi.handleUpgrade` to wire the `upgrade` event yourself.

### Bun

```ts
import { GSI } from "@counter-strike-2-gsi/server";
import { createGSIBun } from "@counter-strike-2-gsi/handlers/bun";

const manager = new GSI();
const gsi = createGSIBun({ manager, token: process.env.GSI_TOKEN });

// Option A — native routes (Bun >= 1.1)
Bun.serve({ port: 3000, routes: gsi.routes, websocket: gsi.websocket });

// Option B — single fetch dispatcher
Bun.serve({ port: 3000, fetch: gsi.handler, websocket: gsi.websocket });
```

### Hono

```ts
import { Hono } from "hono";
import { createBunWebSocket } from "hono/bun";
import { GSI } from "@counter-strike-2-gsi/server";
import { createGSIHono } from "@counter-strike-2-gsi/handlers/hono";

const { upgradeWebSocket, websocket } = createBunWebSocket();

const manager = new GSI();
const gsi = createGSIHono({ manager, token: process.env.GSI_TOKEN }, upgradeWebSocket);

const app = new Hono();
app.route("/", gsi.handler); // mounts /gsi, /sse, /ws

Bun.serve({ fetch: app.fetch, websocket });
```

WS routes are only registered when you pass an `upgradeWebSocket` helper — inject whichever one Hono ships for your host (`hono/bun`, `@hono/node-ws`, Deno, Cloudflare Workers). On Node, remember to call `injectWebSocket(server)` from `@hono/node-ws`.

## Options

`createGSI<Runtime>(options)` accepts:

| Option                           | Default                       | Description                                                                                                                                   |
| -------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `manager`                        | — (required)                  | The `GSI` instance.                                                                                                                           |
| `token`                          | `undefined`                   | Shared secret checked against `payload.auth.token` (constant-time compare). Requests with a bad token get `401`. When omitted, no auth check. |
| `gsiPath` / `ssePath` / `wsPath` | `"/gsi"` / `"/sse"` / `"/ws"` | Route paths.                                                                                                                                  |
| `onError`                        | `undefined`                   | `(error, req) => void`, called on ingress failures; `req` is typed per adapter.                                                               |
| `sse`                            | `{}`                          | SSE options (below), minus `manager`.                                                                                                         |
| `ws`                             | `{}`                          | WS options (below), minus `manager`.                                                                                                          |

**SSE options:** `events` (which `EventMap` events to forward, default `["update"]`), `sendInitialState` (send full state on connect, default `true`), `heartbeatMs` (comment ping, default `30_000`), `maxReplayEvents` (default `50`), `maxReplayAgeMs` (default `60_000`), `logger` (default `console.log`).

**WS options:** `events`, `sendInitialState`, `logger` — same semantics, no replay/heartbeat.

> Forwarding only `["update"]` sends the full state on every tick. For granular HUDs, list the specific events you need, e.g. `events: ["player:state:health", "round:phase"]`.

## Protocol details

- **SSE** — each event is sent with an `id`, the `EventMap` event name as the SSE `event:` field, and a JSON-encoded payload. Reconnecting clients that send `Last-Event-ID` get missed events replayed from a bounded buffer (`maxReplayEvents` / `maxReplayAgeMs`). Heartbeat comments keep proxies from idling the connection out.
- **WS** — each message is a JSON frame `{ event, data }`, mirroring the SSE pair so client code can share payload types.
- Both transports serialize writes per connection, so slow/async writers can't interleave or drop events under 64 Hz load.

## Ingress hardening

- Bodies over **1 MiB** are rejected with `413` (real GSI payloads top out around a few hundred KB).
- Non-POST requests to the GSI path get `405`; malformed/empty JSON gets `400`.
- Token comparison uses a constant-time equality check (`safeTokenEqual`) that works on Node, Bun, and edge runtimes.
- Error responses hide internal messages when `NODE_ENV=production` (`classifyHandlerError`).

## Development

```bash
pnpm test        # vp test
pnpm build       # vp pack → dist/ (one bundle per subpath)
pnpm typecheck   # tsc --noEmit
```
