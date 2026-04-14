import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type WebSocket } from "ws";
import { createWSCore, type WSWriter } from "../core/ws";
import type { WSOptions } from "../core/types";

/**
 * Creates a Node WebSocket handler for CS2 GSI, backed by the `ws`
 * package.
 *
 * Node's `http` server doesn't upgrade HTTP to WS automatically —
 * call `handleUpgrade(req, socket, head)` from your server's
 * `"upgrade"` event when the request path matches.
 *
 * @example
 * ```ts
 * import { createServer } from "node:http";
 *
 * const ws = createNodeWSHandler({ manager, events: ["update"] });
 *
 * const server = createServer(httpListener);
 * server.on("upgrade", (req, socket, head) => {
 *   if (new URL(req.url ?? "", "http://x").pathname === "/ws") {
 *     ws.handleUpgrade(req, socket, head);
 *   } else {
 *     socket.destroy();
 *   }
 * });
 *
 * server.listen(3000);
 * ```
 */
export function createNodeWSHandler(options: WSOptions) {
  const core = createWSCore(options);
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", async (ws: WebSocket) => {
    const writer: WSWriter = {
      send(data) {
        try {
          ws.send(data);
        } catch {}
      },
      close() {
        try {
          ws.close();
        } catch {}
      },
    };

    const session = await core.connect(writer, (err) => {
      console.error("[WS Node] Write error:", err);

      try {
        ws.terminate();
      } catch {}
    });

    ws.on("close", () => session.unsubscribe());
  });

  const handleUpgrade = (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  };

  return { wss, handleUpgrade };
}
