import type { Server } from "bun";

import { createBunHandler } from "./http";
import { createSSEHandler } from "./sse";
import { createBunWSHandler, type WSData } from "./ws";
import type { GSIServerOptions } from "../core/types";

type BunFetchHandler = (
  req: Request,
  server?: Server<WSData>,
) => Response | Promise<Response> | undefined;

/**
 * Creates a complete GSI + optional SSE/WS setup for Bun.
 *
 * Bun has no router object like Express/Hono, so this exposes two
 * Bun-native shapes:
 *
 * 1. `routes` — drop straight into `Bun.serve({ routes })`.
 * 2. `handler` — a single fetch dispatcher you can pass as
 *    `Bun.serve({ fetch: gsi.handler })` or compose inside an existing `fetch`.
 *
 * Pass `ssePath: null` / `wsPath: null` to disable either transport.
 *
 * @example
 * ```ts
 * const gsi = createGSIBun({ manager });
 *
 * // Option A — native routes (Bun >= 1.1)
 * Bun.serve({ port: 3000, routes: gsi.routes, websocket: gsi.websocket });
 *
 * // Option B — single fetch
 * Bun.serve({ port: 3000, fetch: gsi.handler, websocket: gsi.websocket });
 *
 * // Option C — compose
 * Bun.serve({
 *   port: 3000,
 *   async fetch(req, server) {
 *     const res = await gsi.handler(req, server);
 *
 *     if (res && res.status !== 404) {
 *      return res;
 *     }
 *
 *     return new Response("Not Found", { status: 404 });
 *   },
 *   websocket: gsi.websocket,
 * });
 * ```
 */
export function createGSIBun(options: GSIServerOptions) {
  const {
    manager,
    sse = {},
    ws: wsOpts = {},
    gsiPath = "/gsi",
    ssePath = "/sse",
    wsPath = "/ws",
    ...httpOptions
  } = options;

  const gsiHandler = createBunHandler({
    manager,
    ...httpOptions,
  });
  const sseHandler = ssePath
    ? createSSEHandler({
        manager,
        ...sse,
      })
    : null;
  const wsHandler = wsPath
    ? createBunWSHandler({
        manager,
        ...wsOpts,
      })
    : null;
  const routes: Record<string, Record<string, BunFetchHandler>> = {
    [gsiPath]: {
      POST: gsiHandler,
    },
  };

  if (sseHandler && ssePath) {
    routes[ssePath] = {
      GET: sseHandler,
    };
  }

  if (wsHandler && wsPath) {
    routes[wsPath] = {
      GET: (req, server) => {
        if (!server) {
          return new Response("Upgrade requires server", {
            status: 500,
          });
        }

        return wsHandler.upgrade(req, server)
          ? undefined
          : new Response("Upgrade failed", { status: 400 });
      },
    };
  }

  const handler: BunFetchHandler = (req, server) => {
    const { pathname } = new URL(req.url);

    if (pathname === gsiPath && req.method === "POST") {
      return gsiHandler(req);
    }

    if (sseHandler && pathname === ssePath && req.method === "GET") {
      return sseHandler(req);
    }

    if (wsHandler && pathname === wsPath && req.method === "GET") {
      if (!server) {
        return new Response("Upgrade requires server", {
          status: 500,
        });
      }

      return wsHandler.upgrade(req, server)
        ? undefined
        : new Response("Upgrade failed", {
            status: 400,
          });
    }

    return new Response("Not Found", {
      status: 404,
    });
  };

  return {
    gsiHandler,
    sseHandler,
    wsHandler,
    websocket: wsHandler?.websocket ?? null,
    routes,
    handler,
    paths: {
      gsi: gsiPath,
      sse: ssePath,
      ws: wsPath,
    },
  };
}

export { createBunHandler } from "./http";
export { createBunWSHandler } from "./ws";
