---
"@counter-strike-2-gsi/server": minor
---

State snapshots are now immutable, invalid payloads are salvaged block by block, and the manager can report its own listeners.

**Behavior change — `strictValidation: false`.** A validation failure used to log a warning and then merge the entire unvalidated payload anyway, so one malformed field wrote the whole raw object into state. Now only the top-level blocks that failed are dropped and the rest still applies: a malformed `player` no longer costs a perfectly good `map`. If the payload root itself is invalid there is nothing to salvage and the update is discarded whole. `strictValidation: true` is unaffected. If you were relying on invalid blocks reaching state, turn validation off with `validatePayload: false` instead.

**Fixed: state could be rewritten after the fact.** Pruning sparse collections (roster, grenades, weapons) deleted keys in place, which was only safe because the merge library happens to deep-clone. Pruning now builds new objects and returns the original reference untouched when nothing has to go, so anything you hold from `manager.state` — or from the `previous` side of a delta — keeps saying what it said.

**Fixed: invalid payloads could corrupt state in a bundled build.** `parsePayload` detected validation errors with `instanceof ArkErrors` alone. When a bundle ends up with two copies of arktype, the prototype chains differ, the check reports "valid", and the error array flows on as a payload — its internal back-references make state cyclic and blow microdiff's stack on the next granular update. The guard is now identity-independent.

**New:** `GSI.eventNames()` and `GSI.listenerCount(event)`. `eventNames()` returns the same set granular mode reads to decide which blocks are worth deep-diffing, so it answers what an instance is actually paying for.
