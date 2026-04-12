import type { ServerWebSocket, WebSocketHandler } from "bun";

import { createWSCore } from "../core/ws";
import type { WSWriter, WSSession } from "../core/ws";
import type { WSOptions } from "../core/types";

interface WSData {
  session: WSSession | null;
}

/**
 * Creates a Bun WebSocket handler for CS2 GSI.
 *
 * Bun's WS model splits upgrade from the socket lifecycle: you call
 * `upgrade(req, server)` inside `fetch` and pass `websocket` to
 * `Bun.serve`.
 *
 * @example
 * ```ts
 * const ws = createBunWSHandler({ manager, events: ["update"] });
 *
 * Bun.serve({
 *   port: 3000,
 *   fetch(req, server) {
 *     const url = new URL(req.url);
 *
 *     if (url.pathname === "/ws") {
 *       return ws.upgrade(req, server) ? undefined : new Response("Upgrade failed", { status: 400 });
 *     }
 *
 *     return new Response("Not Found", { status: 404 });
 *   },
 *   websocket: ws.websocket,
 * });
 * ```
 */
export function createBunWSHandler(options: WSOptions) {
  const core = createWSCore(options);

  const websocket: WebSocketHandler<WSData> = {
    async open(ws: ServerWebSocket<WSData>) {
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

      ws.data.session = await core.connect(writer);
    },
    close(ws: ServerWebSocket<WSData>) {
      ws.data.session?.unsubscribe();
      ws.data.session = null;
    },
    message() {
      // incoming client messages are ignored — this is a one-way feed
    },
  };

  const upgrade = (
    req: Request,
    server: {
      upgrade: (
        req: Request,
        opts: {
          data: WSData;
        },
      ) => boolean;
    },
  ) =>
    server.upgrade(req, {
      data: {
        session: null,
      },
    });

  return {
    websocket,
    upgrade,
  };
}
