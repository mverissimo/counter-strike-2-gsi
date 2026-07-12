# @counter-strike-2-gsi/handlers

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
