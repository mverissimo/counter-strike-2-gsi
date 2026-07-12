import { Hono } from "hono";
import type { Context } from "hono";
import type { WSEvents } from "hono/ws";

import { createHonoHandler } from "./http";
import { createSSEHandler } from "./sse";
import { createHonoWSHandler } from "./ws";
import type { GSIServerOptions } from "../core/types";

type UpgradeWebSocket = (
  createEvents: (c: Context) => WSEvents | Promise<WSEvents>,
) => (c: Context, next: () => Promise<void>) => Promise<Response | void>;

/**
 * Creates a complete GSI + optional SSE/WS setup for Hono.
 *
 * Exposes a `handler` sub-app with all routes pre-registered. Mount it
 * onto your main app with `app.route(prefix, gsi.handler)` — the same
 * pattern as any other Hono sub-app.
 *
 * WS is only registered when you pass `upgradeWebSocket` — inject
 * whichever helper Hono ships for your host (Bun, Node, Deno, CF
 * Workers).
 *
 * @example Bun
 * ```ts
 * import { createBunWebSocket } from "hono/bun";
 *
 * const { upgradeWebSocket, websocket } = createBunWebSocket();
 * const gsi = createGSIHono({ manager }, upgradeWebSocket);
 *
 * const app = new Hono();
 * app.route("/", gsi.handler);
 *
 * Bun.serve({ fetch: app.fetch, websocket });
 * ```
 *
 * @example Node (@hono/node-ws)
 * ```ts
 * import { serve } from "@hono/node-server";
 * import { createNodeWebSocket } from "@hono/node-ws";
 *
 * const app = new Hono();
 * const { upgradeWebSocket, injectWebSocket } = createNodeWebSocket({ app });
 * const gsi = createGSIHono({ manager }, upgradeWebSocket);
 * app.route("/", gsi.handler);
 *
 * const server = serve({ fetch: app.fetch });
 * injectWebSocket(server);
 * ```
 */
export function createGSIHono(options: GSIServerOptions, upgradeWebSocket?: UpgradeWebSocket) {
  const {
    manager,
    sse = {},
    ws: wsOpts = {},
    gsiPath = "/gsi",
    ssePath = "/sse",
    wsPath = "/ws",
    ...httpOptions
  } = options;

  const gsiHandler = createHonoHandler({
    manager,
    ...httpOptions,
  });
  const sseHandler = createSSEHandler({
    manager,
    ...sse,
  });
  const wsMiddleware = upgradeWebSocket
    ? createHonoWSHandler(
        {
          manager,
          ...wsOpts,
        },
        upgradeWebSocket,
      )
    : null;

  const handler = new Hono();

  handler.post(gsiPath, gsiHandler);
  handler.get(ssePath, sseHandler);

  if (wsMiddleware) {
    handler.get(wsPath, wsMiddleware);
  }

  return {
    gsiHandler,
    sseHandler,
    wsHandler: wsMiddleware,
    handler,
    paths: {
      gsi: gsiPath,
      sse: ssePath,
      ws: wsPath,
    },
  };
}

export { createHonoHandler } from "./http";
export { createHonoWSHandler } from "./ws";
