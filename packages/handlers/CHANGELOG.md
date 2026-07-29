# @counter-strike-2-gsi/handlers

## 0.2.0

### Minor Changes

- 05f5263: SSE replay is now safe against clock skew, with a new option for how initial state interacts with it, plus two ingress fixes.

  **New: `sendInitialState: "only-if-no-replay"`.** On reconnect the core writes buffered events first, then the state snapshot, then live events. State winning is deliberate — a client can never end up behind what it replayed — but it makes the tail of the replay redundant for clients that treat each `"update"` as a discrete tick. The new value sends the snapshot only to genuinely new connections. `true` (default) and `false` behave exactly as before.

  **Fixed: a backwards clock step broke replay.** Both ordering decisions in the SSE core — which buffered events a reconnecting client still needs, which ones have aged out — compared raw `Date.now()` readings. An NTP correction or VM resume made new events sort before ones the client had already seen, and made freshly buffered events look expired. The core now reads the clock through a single monotonic high-water mark. Event ids keep the `<timestamp>-<counter>` shape; treat them as opaque and increasing rather than as wall-clock readings.

  **Fixed: multi-byte characters could be mangled on the Node ingress.** The request body was accumulated with string concatenation, which decodes UTF-8 on chunk boundaries and corrupts characters that straddle two chunks (a player or map name with non-ASCII text, and in the worst case a body that no longer parses). It now buffers and decodes once, which also drops the per-chunk reallocation of the whole body at 64 Hz.

  `safeTokenEqual` handles an empty received token explicitly rather than relying on `NaN` coercing to `0`. Same result, still constant-time.

### Patch Changes

- Updated dependencies [05f5263]
- Updated dependencies [05f5263]
  - @counter-strike-2-gsi/server@0.2.0
  - @counter-strike-2-gsi/types@0.1.1

## 0.1.0

### Minor Changes

- 248af9b: Initial release of the Counter-Strike 2 GSI stack:
  - `@counter-strike-2-gsi/types` — arktype schema for the raw GSI payload with auto-generated typed event names for every schema path.
  - `@counter-strike-2-gsi/server` — transport-agnostic `GSI` manager: payload validation, state merging, and subscription-aware granular/block/minimal change detection.
  - `@counter-strike-2-gsi/handlers` — HTTP ingress + SSE/WS egress adapters for Node, Bun, and Hono.
  - `@counter-strike-2-gsi/client` — browser SSE/WS clients with auto-reconnect, plus React hooks (`GSIProvider`, `useGSIEvent`, `useGSISelector`, …).

### Patch Changes

- Updated dependencies [248af9b]
  - @counter-strike-2-gsi/types@0.1.0
  - @counter-strike-2-gsi/server@0.1.0
