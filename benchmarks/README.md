# Benchmarks

Compares `@counter-strike-2-gsi/server` against the other JavaScript GSI event processors on the shared core job: raw GSI payload in → state → change events out.

- [`cs2-gsi-z`](https://github.com/alebcj/cs2-gsi-z) — delta-merge + 12 hand-written domain differs, ~30 curated events.
- [`csgogsi`](https://github.com/osztenkurden/csgogsi) — the parser behind the Lexogrine HUD ecosystem. No validation and no delta-merge (it requires complete observer payloads with `allplayers`, `map`, and `phase_countdowns`); each digest rebuilds a derived HUD snapshot and emits ~19 curated lifecycle events.

These are the only maintained JS competitors doing this job — everything else on npm is types-only, an HTTP-server-only CS:GO relic (`node-csgo-gsi`), a Game Coordinator client (a different thing), or a republish of cs2-gsi-z (`osby-gaming-cs2-gsi`).

All libraries are driven through their transport-free entry points (`GSI.update()` / `GsiUpdateHandler.handle()` / `CSGOGSI.digest()`), so HTTP overhead is excluded and only per-update processing is measured.

## Running

```sh
# from the repo root — the server package must be built first
vp run -r build
cd benchmarks && pnpm bench
```

## Scenarios

- **Session replay** — 16 full-snapshot observer frames simulating one round at GSI granularity: damage ticks, player movement, ammo drain, grenade lifetimes, a bomb plant, a player death, round end, freezetime resets, a buy, and roster churn (join + disconnect). Frames are cumulative mutations of a base snapshot, the way CS2 actually posts state, and include everything csgogsi's observer mode requires (positions, `observer_slot`, per-player weapons and `match_stats`, `phase_countdowns`).
- **No-change heartbeat** — a full snapshot identical to the previous one, the most common POST at 64Hz.

`@counter-strike-2-gsi/server` runs in all three `changeDetection` modes, each also with `validatePayload: false` to isolate arktype's share of the cost (it turns out to be small — ~6–12% — merge + diff dominates); `cs2-gsi-z` runs with its default differ set; `csgogsi` runs its full digest.

Granular diffing is subscription-aware (only blocks with listeners get deep-diffed), so it appears twice: the plain `granular` rows subscribe to a typical HUD's handful of events, and `granular, all blocks subscribed` forces worst-case full diffing for an apples-to-apples ceiling against the other libraries.

## Fairness notes

- Frames are pre-serialized and `JSON.parse`d inside the measured loop for both libraries — every update gets a fresh object (matching a real HTTP body parse), which also neutralizes cs2-gsi-z's in-place mutation of the incoming payload.
- cs2-gsi-z's handler and differs are given a no-op logger. Its real `Logger` evaluates two full-state `JSON.stringify` calls per update even when the level filters them out, and the `null` fallback logs to the console per update — either would benchmark I/O instead of the diff engine.
- Both sides have equivalent listeners attached (health, round phase, roster join/leave) so event dispatch is exercised and can't be dead-code eliminated.
- Frames must stay schema-complete: partial blocks fail `parsePayload` validation and would measure the error path.
- The libraries do deliberately different amounts of work per update, so results compare pipeline cost, not feature parity. `@counter-strike-2-gsi/server` validates every payload against an arktype schema, delta-merges partials, and (in granular mode) diffs every leaf path; `cs2-gsi-z` delta-merges and runs domain differs; `csgogsi` skips validation and merging entirely and derives a fresh HUD snapshot per digest.
