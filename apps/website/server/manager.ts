import { createGSIBun } from "@counter-strike-2-gsi/handlers/bun";
import { GSI } from "@counter-strike-2-gsi/server";

import { SSE_EVENTS } from "../src/lib/events.ts";

export const GSI_PATH = "/gsi";
export const SSE_PATH = "/sse";

/**
 * The one place the overlay's server side is configured. `server/standalone.ts`
 * is its only caller — the same process in development (behind Vite's proxy)
 * and in OBS (serving the built page), so there is no dev-only code path to
 * drift out of sync.
 *
 * No auth token, deliberately. The endpoint binds loopback and the only thing
 * that should be posting to it is CS2 on the same machine, so a shared secret
 * between two local processes buys nothing and costs a whole class of silent
 * failure: a mismatch is a bare 401 on one side and a blank overlay on the
 * other, with nothing on screen linking the two.
 *
 * The handler does support one — pass `token` to `createGSIBun` and add a
 * matching `"auth" { "token" "..." }` block to the CS2 cfg. Do that if the
 * endpoint is ever reachable beyond localhost, where it stops being optional.
 */
export function createOverlayGSI() {
  const manager = new GSI({
    // Default mode. Granular diffing is subscription-aware, so the cost here
    // is only the `bomb` block — the one the overlay actually registers a
    // granular listener under (see SSE_EVENTS).
    changeDetection: "granular",
  });

  const gsi = createGSIBun({
    manager,
    gsiPath: GSI_PATH,
    ssePath: SSE_PATH,
    sse: {
      events: [...SSE_EVENTS],
      // CS2 posts every 100 ms while you're in a match, but the stream goes
      // quiet between matches. Heartbeat well under the 60 s that proxies
      // and OBS's embedded browser tend to cut idle connections at.
      heartbeatMs: 15_000,
    },
  });

  return {
    manager,
    gsi,
  };
}
