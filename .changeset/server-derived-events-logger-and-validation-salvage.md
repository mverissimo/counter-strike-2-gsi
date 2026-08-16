---
"@counter-strike-2-gsi/server": minor
---

High-level derived events, an injectable logger, no-op suppression, and a `"validation"` event — plus several correctness fixes uncovered while building them.

**New: derived events.** `GSI` now computes HUD-oriented milestones from each state transition, in addition to the granular/block events: `"round:started"`, `"round:ended"`, `"bomb:planted"`, `"bomb:defused"`, `"bomb:exploded"`, `"player:died"`, `"player:killed"`. Each fires once, on the tick where the watched condition first becomes true, and never on the very first payload after construction or `reset()` (nothing to transition _from_) — except `"allplayers:joined"`/`"allplayers:left"`, which are deliberately level-triggered so a HUD attaching mid-match can seed its scoreboard from the first payload instead of waiting for the next roster change. `player:killed`/`player:died` are scoped to the currently-observed `player` block and never fire across an observer switch to a different `steamid`.

**New: `logger` option.** Where validation warnings, failed updates, and listener exceptions are reported — any object with `warn`/`error` works (pino, winston, a test spy), defaulting to `console`. The package also exports `silentLogger` for tests or hosts that prefer to observe failures only through the `"error"`/`"validation"` events.

**New: `emitUpdateOnNoop` option** (default `true`, preserving current behavior). CS2 posts at up to 64 Hz even when nothing changed; set to `false` to emit `"update"` only when the merged state actually differs from the previous one, and to skip the (empty) change-detection pass on those no-ops.

**New: `"validation"` event.** Fires when non-strict validation salvages a payload, with `{ summary, dropped, discarded }` — `dropped` names the top-level blocks that failed the schema and were discarded, `discarded: true` flags the rarer case where the payload root itself was invalid and the whole update was thrown away. Never fires in strict mode (which throws and emits `"error"` instead) or with `validatePayload: false`.

**Fixed: a literal `"custom"` roster entry could reach state and event names.** CS2 writes its own join/leave bookkeeping to `allplayers.custom`, in the same object as the players. The parser now strips it before merging, the same way `previously`/`added` already were — previously it could be counted as a joined player by `"allplayers:joined"`, and a granular diff through it could produce event names (`allplayers:custom:joined`, array indices) that the type system has no name for.

**Fixed: an explicit `null` in a delta now removes the key it targets** (`grenades: null`, `player.weapons: null`, `allplayers[id].weapons: null`) instead of writing a literal `null` into typed state. `{}` still empties a collection; an absent key still means "unchanged". Only reachable with `validatePayload: false`, since CS2 never sends `null` itself.

**Fixed: granular event names could drift from what the type system generates.** Two gaps in translating a raw `microdiff` path into an event name: a deep path (beyond the schema's declared depth) or one containing the `allplayers.custom` bookkeeping key could produce a name with no corresponding type. Deep paths now truncate to the deepest expressible ancestor instead of being silently dropped, and the `custom` flatten is now scoped to the position the schema actually declares it at (the block's direct child) rather than matching that key name at any depth.

**Fixed: `"player:killed"` could miss a kill that landed in the same tick as a round reset.** `round_kills` only ever decreases when a new round resets it to `0`; if a heartbeat was skipped over that boundary, the same tick could already report the new round's first kill with no valid baseline to diff against. The post-reset count is now treated as that tick's kill tally instead of the kill going unreported.

**Hardened:** merging no longer throws when a collection or weapons slot in a delta is non-object garbage (a string, a number, an array) — only reachable with `validatePayload: false`.
