---
"@counter-strike-2-gsi/types": minor
---

Export `FLATTENED_KEYS` and add the `"validation"` event to `EventMap`.

`FLATTENED_KEYS` names the schema keys that `LeafPaths` traverses through without spending a path segment (today, only `allplayers.custom`). It was previously a private type-level literal; it is now a runtime constant the type mirrors, so `@counter-strike-2-gsi/server`'s roster derivation and granular event naming share the exact same list instead of keeping their own copies in sync by hand.

`EventMap["validation"]` types the payload of `GSI`'s new `"validation"` event: `{ summary: string; dropped: string[]; discarded: boolean }`. See the `@counter-strike-2-gsi/server` changeset for what fires it.
