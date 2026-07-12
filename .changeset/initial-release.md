---
"@counter-strike-2-gsi/types": minor
"@counter-strike-2-gsi/server": minor
"@counter-strike-2-gsi/handlers": minor
"@counter-strike-2-gsi/client": minor
---

Initial release of the Counter-Strike 2 GSI stack:

- `@counter-strike-2-gsi/types` — arktype schema for the raw GSI payload with auto-generated typed event names for every schema path.
- `@counter-strike-2-gsi/server` — transport-agnostic `GSI` manager: payload validation, state merging, and subscription-aware granular/block/minimal change detection.
- `@counter-strike-2-gsi/handlers` — HTTP ingress + SSE/WS egress adapters for Node, Bun, and Hono.
- `@counter-strike-2-gsi/client` — browser SSE/WS clients with auto-reconnect, plus React hooks (`GSIProvider`, `useGSIEvent`, `useGSISelector`, …).
