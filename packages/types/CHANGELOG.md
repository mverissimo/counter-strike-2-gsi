# @counter-strike-2-gsi/types

## 0.1.1

### Patch Changes

- 05f5263: Export `MAX_PATH_DEPTH`, the recursion cap applied to generated event paths.

  It was a bare `5` repeated across two conditional types; it is now a named constant with the type derived from the value, so the two cannot drift, and it is exported so the limit is inspectable rather than buried. No generated event names change.

  A test walks the arktype schema applying the same traversal rules as `LeafPaths` and asserts the real deepest path is exactly this limit, so extending the schema past it fails the build instead of silently dropping event names.

## 0.1.0

### Minor Changes

- 248af9b: Initial release of the Counter-Strike 2 GSI stack:
  - `@counter-strike-2-gsi/types` — arktype schema for the raw GSI payload with auto-generated typed event names for every schema path.
  - `@counter-strike-2-gsi/server` — transport-agnostic `GSI` manager: payload validation, state merging, and subscription-aware granular/block/minimal change detection.
  - `@counter-strike-2-gsi/handlers` — HTTP ingress + SSE/WS egress adapters for Node, Bun, and Hono.
  - `@counter-strike-2-gsi/client` — browser SSE/WS clients with auto-reconnect, plus React hooks (`GSIProvider`, `useGSIEvent`, `useGSISelector`, …).
