---
"@counter-strike-2-gsi/client": minor
---

The WebSocket client no longer reconnects after a clean close, and three additions to the React surface.

**Behavior change — clean WebSocket closes.** The client used to schedule a reconnect on every close. Close codes 1000 (normal) and 1001 (going away) are the server stating it is done with this connection — a shutdown, a deploy, a deliberate kick — so retrying into one is a backoff loop against an endpoint with no intention of serving. Unexpected closes (1006 and friends) keep the existing backoff + jitter, and status still reports `"disconnected"` either way. Set `reconnectOnCleanClose: true` to restore the old behavior, e.g. when the server closes cleanly during a rolling restart behind a load balancer.

**New: `useGSIState()`** — the last full `"update"` payload. Re-renders on every tick, so prefer `useGSIEvent` / `useGSISelector` for anything that renders often; this is for debug overlays and derivations that span blocks.

**New: `useGSIEvents(events)`** — several events at once as one object keyed by event name. The array is compared by content, so inline literals are fine, and the result is referentially stable until one of the subscribed events fires, making it safe as a `useMemo`/`useEffect` dependency.

**New: `clear()` on `useGSIClient()`.** Cached event values deliberately survive a disconnect so a HUD holds its last frame through a reconnect blip instead of blanking out and flashing back — `useGSIStatus()` is how you tell "current" from "last known". `clear()` covers the cases where retained values are misleading rather than merely stale (switching servers, ending a match): it drops every cached value and re-renders the subscribers that had one, without tearing down the subscription.

Internally, the SSE client now rebuilds its event dispatchers from the subscription map on every connect, so handlers registered or removed while the connection is down are always reflected on the next one.
