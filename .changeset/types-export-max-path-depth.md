---
"@counter-strike-2-gsi/types": patch
---

Export `MAX_PATH_DEPTH`, the recursion cap applied to generated event paths.

It was a bare `5` repeated across two conditional types; it is now a named constant with the type derived from the value, so the two cannot drift, and it is exported so the limit is inspectable rather than buried. No generated event names change.

A test walks the arktype schema applying the same traversal rules as `LeafPaths` and asserts the real deepest path is exactly this limit, so extending the schema past it fails the build instead of silently dropping event names.
