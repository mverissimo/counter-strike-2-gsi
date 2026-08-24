import type { EventMap } from "@counter-strike-2-gsi/types";

/**
 * Events the demo catalog components actually subscribe to (see
 * `src/components/*-from-gsi.tsx`). Both mock transports need this list:
 * an SSE server only relays what it's told to (see the comment in
 * `scripts/mock-server.ts`), and the in-browser `DemoEventSource` only
 * needs to bother emitting what something is listening for. Keep this in
 * sync with the granular paths those components read.
 */
export const DEMO_EVENTS: Array<keyof EventMap> = [
  "update",
  "map:team_ct:score",
  "map:team_t:score",
  "map:phase",
  "phase_countdowns:phase_ends_in",
  "player:name",
  "player:team",
  "player:state:health",
  "player:state:armor",
  "player:position",
  "player:killed",
];
