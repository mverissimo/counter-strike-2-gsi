import { createBunHandler } from "./http";
import { createSSEHandler } from "./sse";
import type { GSIServerOptions } from "../core/types";

type BunFetchHandler = (req: Request) => Response | Promise<Response>;

/**
 * Creates a complete GSI + optional SSE setup for Bun.
 *
 * Bun has no router object like Express/Hono, so this exposes two
 * Bun-native shapes:
 *
 * 1. `routes` — drop straight into `Bun.serve({ routes })`.
 * 2. `handler` — a single fetch dispatcher you can pass as
 *    `Bun.serve({ fetch: gsi.handler })` or compose inside an existing `fetch`.
 *
 * @example
 * ```ts
 * const gsi = createGSIBun({ manager, enableSSE: true });
 *
 * // Option A — native routes (Bun >= 1.1)
 * Bun.serve({ port: 3000, routes: gsi.routes });
 *
 * // Option B — single fetch
 * Bun.serve({ port: 3000, fetch: gsi.handler });
 *
 * // Option C — compose
 * Bun.serve({
 *   port: 3000,
 *   async fetch(req) {
 *     const res = await gsi.handler(req);
 *     if (res.status !== 404) return res;
 *     return new Response("Not Found", { status: 404 });
 *   },
 * });
 * ```
 */
export function createGSIBun(options: GSIServerOptions) {
  const {
    manager,
    enableSSE = false,
    sse = {},
    gsiPath = "/gsi",
    ssePath = "/sse",
    ...httpOptions
  } = options;

  const gsiHandler = createBunHandler({ manager, ...httpOptions });
  const sseHandler = enableSSE ? createSSEHandler({ manager, ...sse }) : null;

  const routes: Record<string, Record<string, BunFetchHandler>> = {
    [gsiPath]: {
      POST: gsiHandler,
    },
  };

  if (sseHandler) {
    routes[ssePath] = {
      GET: sseHandler,
    };
  }

  const handler: BunFetchHandler = (req) => {
    const { pathname } = new URL(req.url);

    if (pathname === gsiPath && req.method === "POST") return gsiHandler(req);
    if (sseHandler && pathname === ssePath && req.method === "GET") return sseHandler(req);

    return new Response("Not Found", { status: 404 });
  };

  return {
    gsiHandler,
    sseHandler,
    routes,
    handler,
    paths: {
      gsi: gsiPath,
      sse: enableSSE ? ssePath : null,
    },
  };
}

export { createBunHandler } from "./http";
export { createBunWSHandler } from "./ws";
