# @counter-strike-2-gsi/client

Browser-side consumers for a Counter-Strike 2 GSI stream served by [`@counter-strike-2-gsi/handlers`](../handlers): framework-free SSE/WebSocket clients with auto-reconnect, plus React hooks built on `useSyncExternalStore`.

## Install

```bash
pnpm add @counter-strike-2-gsi/client react
```

React is a peer dependency, but only the `use*`/`GSIProvider` exports need it — `createSSEClient` / `createWSClient` are plain functions usable anywhere.

(Not published to npm yet — use `"workspace:*"` inside this monorepo.)

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

- **`useGSIStatus()`** — connection status, decoupled from event state (status flips don't re-render event consumers).
- **`useGSIClient()`** — escape hatch: `{ connect, disconnect }` for manual lifecycle control.

### Connection lifecycle

The provider creates one shared connection per `url`. It's ref-counted against live subscribers: the socket opens when the first hook subscribes, closes when the last unsubscribes, and closes on provider unmount. Use `useGSIClient()` if you want to hold it open across subscription gaps.

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

Reconnect notes: the SSE client re-opens the `EventSource` itself once it reaches the terminal `CLOSED` state (the browser's built-in retry only covers transient failures); the WS client reconnects on any unexpected close. `disconnect()` always wins — no reconnect after a user-initiated close.

## Development

```bash
pnpm test        # vp test (happy-dom + @testing-library/react)
pnpm build       # vp pack → dist/
pnpm typecheck   # tsc --noEmit
```
