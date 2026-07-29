# @counter-strike-2-gsi/server

## 0.2.0

### Minor Changes

- 05f5263: State snapshots are now immutable, invalid payloads are salvaged block by block, and the manager can report its own listeners.

  **Behavior change — `strictValidation: false`.** A validation failure used to log a warning and then merge the entire unvalidated payload anyway, so one malformed field wrote the whole raw object into state. Now only the top-level blocks that failed are dropped and the rest still applies: a malformed `player` no longer costs a perfectly good `map`. If the payload root itself is invalid there is nothing to salvage and the update is discarded whole. `strictValidation: true` is unaffected. If you were relying on invalid blocks reaching state, turn validation off with `validatePayload: false` instead.

  **Fixed: state could be rewritten after the fact.** Pruning sparse collections (roster, grenades, weapons) deleted keys in place, which was only safe because the merge library happens to deep-clone. Pruning now builds new objects and returns the original reference untouched when nothing has to go, so anything you hold from `manager.state` — or from the `previous` side of a delta — keeps saying what it said.

  **Fixed: invalid payloads could corrupt state in a bundled build.** `parsePayload` detected validation errors with `instanceof ArkErrors` alone. When a bundle ends up with two copies of arktype, the prototype chains differ, the check reports "valid", and the error array flows on as a payload — its internal back-references make state cyclic and blow microdiff's stack on the next granular update. The guard is now identity-independent.

  **New:** `GSI.eventNames()` and `GSI.listenerCount(event)`. `eventNames()` returns the same set granular mode reads to decide which blocks are worth deep-diffing, so it answers what an instance is actually paying for.

### Patch Changes

- Updated dependencies [05f5263]
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
