import { Hono } from "hono";
import { createHonoHandler } from "./http";
import { createSSEHandler } from "./sse";
import type { GSIServerOptions } from "../core/types";

/**
 * Creates a complete GSI + optional SSE setup for Hono.
 *
 * Exposes a `handler` sub-app with all routes pre-registered. Mount it
 * onto your main app with `app.route(prefix, gsi.handler)` — the same
 * pattern as any other Hono sub-app.
 *
 * @example
 * ```ts
 * const gsi = createGSIHono({ manager, enableSSE: true });
 *
 * // Option A — mount at root
 * const app = new Hono();
 * app.route("/", gsi.handler);
 *
 * // Option B — mount under a prefix
 * app.route("/api", gsi.handler); // now /api/gsi + /api/sse
 *
 * // Option C — register handlers manually for custom routing
 * app.post("/custom", gsi.gsiHandler);
 * if (gsi.sseHandler) app.get("/stream", gsi.sseHandler);
 *
 * // Option D — custom paths via options
 * const gsi = createGSIHono({ manager, enableSSE: true, gsiPath: "/ingest", ssePath: "/events" });
 * app.route("/", gsi.handler);
 * ```
 */
export function createGSIHono(options: GSIServerOptions) {
  const {
    manager,
    enableSSE = false,
    sse = {},
    gsiPath = "/gsi",
    ssePath = "/sse",
    ...httpOptions
  } = options;

  const gsiHandler = createHonoHandler({ manager, ...httpOptions });
  const sseHandler = enableSSE ? createSSEHandler({ manager, ...sse }) : null;

  const handler = new Hono();
  handler.post(gsiPath, gsiHandler);
  if (sseHandler) handler.get(ssePath, sseHandler);

  return {
    gsiHandler,
    sseHandler,
    handler,
    paths: {
      gsi: gsiPath,
      sse: enableSSE ? ssePath : null,
    },
  };
}

export { createHonoHandler } from "./http";
export { createHonoWSHandler } from "./ws";
