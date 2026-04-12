import type { IncomingMessage, ServerResponse } from "node:http";
import { createNodeHandler } from "./http";
import { createSSEHandler } from "./sse";
import type { GSIServerOptions } from "../core/types";

type NodeRequestListener = (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;

/**
 * Creates a complete GSI + optional SSE setup for Node's built-in `http`.
 *
 * Node has no router object like Express/Hono, so this exposes a
 * single `handler` dispatcher you can pass straight to
 * `http.createServer`.
 *
 * @example
 * ```ts
 * import { createServer } from "node:http";
 *
 * const gsi = createGSINode({ manager, enableSSE: true });
 *
 * // Option A — single dispatcher
 * createServer(gsi.handler).listen(3000);
 *
 * // Option B — compose inside an existing request listener
 * createServer((req, res) => {
 *   if (req.url?.startsWith("/gsi") || req.url?.startsWith("/sse")) {
 *     return gsi.handler(req, res);
 *   }
 *
 *   res.writeHead(404).end("Not Found");
 * }).listen(3000);
 *
 * // Option C — wire handlers yourself (e.g. for custom routing)
 * if (req.url === "/gsi" && req.method === "POST") {
 *  gsi.gsiHandler(req, res);
 * }
 *
 * if (gsi.sseHandler && req.url === "/sse" && req.method === "GET") {
 *  gsi.sseHandler(req, res);
 * }
 * ```
 */
export function createGSINode(options: GSIServerOptions) {
  const {
    manager,
    enableSSE = false,
    sse = {},
    gsiPath = "/gsi",
    ssePath = "/sse",
    ...httpOptions
  } = options;

  const gsiHandler = createNodeHandler({ manager, ...httpOptions });
  const sseHandler = enableSSE ? createSSEHandler({ manager, ...sse }) : null;

  const handler: NodeRequestListener = (req, res) => {
    const url = req.url?.split("?")[0];

    if (url === gsiPath && req.method === "POST") return gsiHandler(req, res);
    if (sseHandler && url === ssePath && req.method === "GET") return sseHandler(req, res);

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not Found" }));
  };

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

export { createNodeHandler } from "./http";
export { createNodeWSHandler } from "./ws";
