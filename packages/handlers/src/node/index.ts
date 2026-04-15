import type { IncomingMessage, Server, ServerResponse } from "node:http";
import type { Duplex } from "node:stream";
import { createNodeHandler } from "./http";
import { createSSEHandler } from "./sse";
import { createNodeWSHandler } from "./ws";
import type { GSIServerOptions } from "../core/types";

type NodeRequestListener = (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;

/**
 * Creates a complete GSI + optional SSE/WS setup for Node's built-in `http`.
 *
 * Node has no router object like Express/Hono, so this exposes a
 * single `handler` dispatcher for HTTP plus `attach(server)` for WS.
 *
 * @example
 * ```ts
 * import { createServer } from "node:http";
 *
 * const gsi = createGSINode({ manager });
 *
 * const server = createServer(gsi.handler);
 * gsi.attach(server); // wires WS upgrade on wsPath
 * server.listen(3000);
 *
 * // Compose inside an existing request listener
 * createServer((req, res) => {
 *   if (req.url?.startsWith("/gsi") || req.url?.startsWith("/sse")) {
 *     return gsi.handler(req, res);
 *   }
 *
 *   res.writeHead(404).end("Not Found");
 * }).listen(3000);
 *
 * // Or wire the WS upgrade yourself
 * server.on("upgrade", (req, socket, head) => {
 *   if (req.url === gsi.paths.ws) gsi.handleUpgrade?.(req, socket, head);
 *   else socket.destroy();
 * });
 * ```
 */
export function createGSINode(options: GSIServerOptions) {
  const {
    manager,
    sse = {},
    ws: wsOpts = {},
    gsiPath = "/gsi",
    ssePath = "/sse",
    wsPath = "/ws",
    ...httpOptions
  } = options;

  const gsiHandler = createNodeHandler({
    manager,
    ...httpOptions,
  });
  const sseHandler = createSSEHandler({
    manager,
    ...sse,
  });
  const wsHandler = createNodeWSHandler({
    manager,
    ...wsOpts,
  });

  const handler: NodeRequestListener = (req, res) => {
    const url = req.url?.split("?")[0];

    if (url === gsiPath && req.method === "POST") {
      return gsiHandler(req, res);
    }

    if (url === ssePath && req.method === "GET") {
      return sseHandler(req, res);
    }

    res.writeHead(404, {
      "Content-Type": "application/json",
    });
    res.end(
      JSON.stringify({
        error: "Not Found",
      }),
    );
  };

  const attach = (server: Server) => {
    server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      const url = req.url?.split("?")[0];

      if (url === wsPath) {
        wsHandler.handleUpgrade(req, socket, head);
      } else {
        socket.destroy();
      }
    });
  };

  return {
    gsiHandler,
    sseHandler,
    wsHandler,
    handler,
    attach,
    handleUpgrade: wsHandler.handleUpgrade,
    paths: {
      gsi: gsiPath,
      sse: ssePath,
      ws: wsPath,
    },
  };
}

export { createNodeHandler } from "./http";
export { createNodeWSHandler } from "./ws";
