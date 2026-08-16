import type { ServerWebSocket, WebSocketHandler } from "bun";

import { createWSCore } from "../core/ws";
import type { WSWriter, WSSession } from "../core/ws";
import type { WSOptions } from "../core/types";

export interface WSData {
  session: WSSession | null;
  closedEarly: boolean;
  /** @internal Pending sends waiting for Bun's `drain` callback. */
  drainResolvers?: Array<() => void>;
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
          const status = ws.send(data);

          if (status === 0) {
            throw new Error("Bun dropped the WebSocket frame");
          }

          if (status === -1) {
            return new Promise<void>((resolve) => {
              (ws.data.drainResolvers ??= []).push(resolve);
            });
          }
        },
        close() {
          try {
            ws.close();
          } catch {}
        },
      };

      const session = await core.connect(writer, (err) => {
        console.error("[WS Bun] Write error:", err);

        try {
          ws.close();
        } catch {}
      });

      if (ws.data.closedEarly) {
        session.unsubscribe();
        return;
      }

      ws.data.session = session;
    },
    close(ws: ServerWebSocket<WSData>) {
      ws.data.drainResolvers?.splice(0).forEach((resolve) => resolve());

      if (ws.data.session) {
        ws.data.session.unsubscribe();
        ws.data.session = null;
      } else {
        ws.data.closedEarly = true;
      }
    },
    message() {
      // incoming client messages are ignored — this is a one-way feed
    },
    drain(ws: ServerWebSocket<WSData>) {
      ws.data.drainResolvers?.splice(0).forEach((resolve) => resolve());
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
        closedEarly: false,
        drainResolvers: [],
      },
    });

  return {
    websocket,
    upgrade,
  };
}
