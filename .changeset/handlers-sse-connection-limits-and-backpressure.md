---
"@counter-strike-2-gsi/handlers": minor
---

Per-connection backpressure caps for SSE and WS, an SSE connection limit, and a reservation-leak fix.

**New: `maxPendingWrites` option** on both SSE and WS cores (default `256`, `0` disables it). Writes to a connection are serialized in a chain so an async writer can't interleave or drop events under 64 Hz load; without a cap, a client reading slower than CS2 produces retains an unbounded backlog of unsent payloads for the life of the connection. Past the limit, further writes are dropped (not queued) until the chain drains, reported once per saturation episode through `logger` and on every drop through the new `onBackpressure` callback. Dropping is safe here because every message either carries the full state or is superseded by the next one.

**New: `maxConnections` option** on the SSE core (default `0`, unlimited). Past the limit, `connect()` throws `SSEConnectionLimitError` and the node/bun/hono adapters answer `503` with `Retry-After` instead of opening a stream they cannot serve. Adapters check admission via the new `reserve()`/`isFull()` before committing response headers, so a burst that races past the check still gets a late rejection rather than an over-admitted connection.

**Fixed: a Node SSE connection reservation could leak permanently.** `res.writeHead`/`res.write` ran unguarded before the connection handshake completed; if the client's socket reset at exactly that moment, the reservation was never released. Repeated occurrences would eventually make the server answer `503` to every new client regardless of how many connections were actually open. Both calls are now wrapped so a failure there releases the reservation like every other early-exit path already did.
