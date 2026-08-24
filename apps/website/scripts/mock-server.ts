import { createServer } from "node:http";
import { createGSINode } from "@counter-strike-2-gsi/handlers/node";
import { GSI } from "@counter-strike-2-gsi/server";

import { DEMO_EVENTS } from "../src/lib/demo-events.ts";
import { createOverridesStore } from "./overrides-store.ts";

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
const overrides = createOverridesStore();

await overrides.load();

// Neither `createGSINode`'s handler nor the overrides store sets CORS
// headers — nothing in packages/handlers does — so a browser fetch/
// EventSource from the Vite dev server's own origin (a different port)
// would otherwise fail silently. This only ever ran against `curl` before,
// which doesn't enforce CORS, so the gap went unnoticed. Wide open on
// purpose: this process only ever runs on a developer's own machine.
const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();

    return;
  }

  if (await overrides.handleRequest(req, res)) {
    return;
  }

  await gsi.handler(req, res);
});

gsi.attach(server);

server.listen(PORT, () => {
  console.log(`gsi ingest + sse relay on http://localhost:${PORT}${gsi.paths.sse}`);
  console.log(`overrides store on http://localhost:${PORT}/overrides`);
  // This server only ingests and relays — it doesn't generate a match
  // itself. Run `pnpm mock:feed` (scripts/mock-feed.ts) alongside it for a
  // real, evolving round; without that, GSI paths just sit at whatever the
  // last POST to /gsi left them (nothing, on a fresh start).
  console.log(`no match feed running yet — start one with: pnpm mock:feed`);
});
