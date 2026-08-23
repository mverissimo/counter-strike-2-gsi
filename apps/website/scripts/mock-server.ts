import { createServer } from "node:http";
import { createGSINode } from "@counter-strike-2-gsi/handlers/node";
import { GSI } from "@counter-strike-2-gsi/server";

import { DEMO_EVENTS } from "../src/lib/demo-events.ts";
import { frame, TICK_MS } from "../src/lib/demo-frame.ts";

const PORT = 3000;

const manager = new GSI();
const gsi = createGSINode({
  manager,
  // The SSE core only relays "update" unless told otherwise (see
  // packages/handlers/src/core/sse.ts) — granular per-path events like
  // "player:state:health" are computed by the manager but never sent over
  // the wire without being listed here. Shared with `demo-source.ts`'s
  // in-browser mock so both transports agree on what a fresh connection
  // actually needs.
  sse: { events: DEMO_EVENTS },
});
const server = createServer(gsi.handler);

gsi.attach(server);

server.listen(PORT, () => {
  console.log(`mock GSI feed on http://localhost:${PORT}${gsi.paths.sse}`);
});

let tick = 0;

setInterval(() => manager.update(frame(tick++)), TICK_MS);
