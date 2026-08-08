import type { EventMap } from "@counter-strike-2-gsi/types";

/**
 * Every event the SSE endpoint forwards. `server/manager.ts` passes this to
 * the handler, and the handler can only fan out names it was told about up
 * front — so a `useGSIDelta("round:phase")` in a component receives nothing
 * until `"round:phase"` is added here. That one direction is the whole
 * contract; the list is kept to what actually has a subscriber, because each
 * granular name registers a listener that makes the server microdiff the
 * block underneath it on every tick.
 *
 * The split between the two kinds is deliberate:
 *
 * - `"update"` carries the whole merged state on every tick *and* is what the
 *   SSE handler replays to a client that connects mid-match. Everything the
 *   overlay draws is read from it. A granular event only fires on change, so
 *   a HUD built purely from granular paths would sit blank on a fresh connect
 *   until each individual field happened to move — the map name would stay
 *   empty until someone changed map.
 *
 * - `"bomb:state"` is for a *transition*, not for rendering. It carries
 *   `{ previous, current }`, which is exactly what you need to fire a one-shot
 *   animation or a sound, and nothing else in the payload tells you an edge
 *   was crossed. `BombTimer` uses it for its plant flash.
 */
export const SSE_EVENTS = ["update", "bomb:state"] as const satisfies ReadonlyArray<keyof EventMap>;
