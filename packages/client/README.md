# @counter-strike-2-gsi/client

Browser-side consumers for a Counter-Strike 2 GSI stream served by [`@counter-strike-2-gsi/handlers`](../handlers): framework-free SSE/WebSocket clients with auto-reconnect, plus React hooks built on `useSyncExternalStore`.

## Install

```bash
pnpm add @counter-strike-2-gsi/client react
```

React is a peer dependency, but only the `use*`/`GSIProvider` exports need it — `createSSEClient` / `createWSClient` are plain functions usable anywhere.

## React usage

```tsx
import { GSIProvider, useGSIEvent, useGSIStatus } from "@counter-strike-2-gsi/client";

function Hud() {
  const status = useGSIStatus(); // "connecting" | "connected" | "disconnected"
  const health = useGSIEvent("player:state:health"); // number | undefined
  const phase = useGSIEvent("round:phase");

  return (
    <div>
      {status !== "connected" && <span>reconnecting…</span>}
      <span>HP {health ?? "—"}</span>
      <span>{phase}</span>
    </div>
  );
}

export function App() {
  return (
    <GSIProvider url="http://localhost:3000/sse" onError={console.error}>
      <Hud />
    </GSIProvider>
  );
}
```

The transport is chosen from the URL scheme: `ws://` / `wss://` selects WebSocket, anything else uses SSE. The events a component subscribes to must be forwarded by the server (the handlers' `events` option, default `["update"]`).

### Hooks

All event hooks are fully typed against the schema — event names autocomplete, and values narrow via `PathValue` (so `` `allplayers:${string}:name` `` gives `string | undefined`, not a wide union).

- **`useGSIEvent(event)`** — the `current` value of an event. The go-to hook for HUD displays.
- **`useGSIDelta(event)`** — the full `{ previous?, current }` delta. Use when you need transitions (kill feeds, phase changes).
- **`useGSISelector(event, selector, isEqual?)`** — subscribe to a high-frequency event but re-render only when a projection of it changes. The selector reads through a ref (no memoization needed); `isEqual` defaults to `Object.is` — pass a shallow/deep comparator when selecting arrays or objects.

  ```tsx
  const steamids = useGSISelector("allplayers", (all) =>
    Object.keys(all ?? {})
      .sort()
      .join(","),
  );
  ```

- **`useGSIEvents(events)`** — several events at once, as one object keyed by event name. Saves a hook call per event when a component reads a handful of unrelated paths. The array is compared by content (pass an inline literal freely) and the returned object is referentially stable until one of the subscribed events fires, so it's safe as a `useMemo`/`useEffect` dependency.

  ```tsx
  const { "player:state:health": health, "round:phase": phase } = useGSIEvents([
    "player:state:health",
    "round:phase",
  ]);
  ```

- **`useGSIState()`** — the last full `"update"` payload, i.e. the whole merged state. Re-renders on every tick (~64 Hz in a live game), so prefer `useGSIEvent` / `useGSISelector` for anything that renders often; this is for debug overlays, state dumps, and derivations that span blocks.
- **`useGSIStatus()`** — connection status, decoupled from event state (status flips don't re-render event consumers).
- **`useGSIClient()`** — escape hatch: `{ connect, disconnect, clear }` for manual lifecycle control.

### Connection lifecycle

The provider creates one shared connection per `url`. It's ref-counted against live subscribers: the socket opens when the first hook subscribes, closes when the last unsubscribes, and closes on provider unmount. Use `useGSIClient()` if you want to hold it open across subscription gaps.

Cached event values **survive a disconnect** — a HUD holds its last frame through a reconnect blip instead of blanking out and flashing back. Read `useGSIStatus()` when you need to tell "current" from "last known". Call `clear()` from `useGSIClient()` when the retained values would be misleading rather than merely stale (switching servers, ending a match): it drops every cached value and re-renders the subscribers that had one, without tearing down the subscription.

## Standalone clients (no React)

```ts
import { createSSEClient, createWSClient } from "@counter-strike-2-gsi/client";

const client = createSSEClient({
  url: "http://localhost:3000/sse",
  onStatusChange: (status) => console.log(status),
  onError: (err) => console.error(err),
});

const unsubscribe = client.subscribe("player:state:health", ({ previous, current }) => {
  console.log(previous, "→", current);
});

client.connect();
// later
unsubscribe();
client.disconnect();
```

Both clients share the same shape (`connect` / `disconnect` / `subscribe`) and options:

| Option                | Default      | Description                                                                        |
| --------------------- | ------------ | ---------------------------------------------------------------------------------- |
| `url`                 | — (required) | Endpoint URL.                                                                      |
| `onStatusChange`      | —            | `"connecting" \| "connected" \| "disconnected"`.                                   |
| `onError`             | —            | Transport errors and per-message JSON parse errors (typed `SSEError` / `WSError`). |
| `reconnect`           | `true`       | Auto-reconnect with exponential backoff + jitter.                                  |
| `reconnectMinDelayMs` | `500`        | Backoff floor.                                                                     |
| `reconnectMaxDelayMs` | `10_000`     | Backoff ceiling.                                                                   |

WS only:

| Option                  | Default | Description                                                       |
| ----------------------- | ------- | ----------------------------------------------------------------- |
| `reconnectOnCleanClose` | `false` | Also reconnect when the server closes with code `1000` or `1001`. |

Reconnect notes:

- The **SSE** client re-opens the `EventSource` itself once it reaches the terminal `CLOSED` state (the browser's built-in retry only covers transient failures). Subscriptions are the source of truth, so handlers registered while the connection is down are attached on the next connect.
- The **WS** client reconnects on unexpected closes (`1006` and friends), but not on a clean one: `1000` (normal) and `1001` (going away) are the server saying it's done — a shutdown, a deploy, a deliberate kick — and retrying into that is just a backoff loop against an endpoint with no intention of serving. Set `reconnectOnCleanClose: true` when the server closes cleanly for reasons the client should ride out, e.g. a rolling restart behind a load balancer. Either way the status still goes to `"disconnected"`.
- `disconnect()` always wins — no reconnect after a user-initiated close.

## Development

```bash
pnpm test        # vp test (happy-dom + @testing-library/react)
pnpm build       # vp pack → dist/
pnpm typecheck   # tsc --noEmit
```
