import type { Context } from "hono";
import type { WSContext, WSEvents } from "hono/ws";

import { createWSCore } from "../core/ws";
import type { WSWriter, WSSession } from "../core/ws";
import type { WSOptions } from "../core/types";

type UpgradeWebSocket = (
  createEvents: (c: Context) => WSEvents | Promise<WSEvents>,
) => (c: Context, next: () => Promise<void>) => Promise<Response | void>;

/**
 * Creates a Hono WebSocket handler for CS2 GSI.
 *
 * Runtime-agnostic: inject `upgradeWebSocket` from whichever helper
 * Hono ships for your host (Bun, Node, Deno, Cloudflare Workers).
 *
 * @example Bun
 * ```ts
 * import { createBunWebSocket } from "hono/bun";
 *
 * const { upgradeWebSocket, websocket } = createBunWebSocket();
 * const app = new Hono();
 * app.get("/ws", createHonoWSHandler({ manager }, upgradeWebSocket));
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
 * app.get("/ws", createHonoWSHandler({ manager }, upgradeWebSocket));
 *
 * const server = serve({ fetch: app.fetch });
 * injectWebSocket(server);
 * ```
 *
 * @example Deno
 * ```ts
 * import { upgradeWebSocket } from "hono/deno";
 * app.get("/ws", createHonoWSHandler({ manager }, upgradeWebSocket));
 * Deno.serve(app.fetch);
 * ```
 *
 * @example Cloudflare Workers
 * ```ts
 * import { upgradeWebSocket } from "hono/cloudflare-workers";
 * app.get("/ws", createHonoWSHandler({ manager }, upgradeWebSocket));
 * ```
 */
export function createHonoWSHandler(options: WSOptions, upgradeWebSocket: UpgradeWebSocket) {
  const core = createWSCore(options);

  return upgradeWebSocket(() => {
    let session: WSSession | null = null;
    let closed = false;

    return {
      async onOpen(_evt: Event, ws: WSContext) {
        const bufferedAmount = () => {
          const raw = ws.raw as
            | {
                bufferedAmount?: number;
                getBufferedAmount?: () => number;
              }
            | undefined;

          try {
            if (typeof raw?.getBufferedAmount === "function") {
              return raw.getBufferedAmount();
            }

            return typeof raw?.bufferedAmount === "number" ? raw.bufferedAmount : 0;
          } catch {
            return 0;
          }
        };

        const waitForDrain = () =>
          new Promise<void>((resolve) => {
            const check = () => {
              if (closed || bufferedAmount() === 0) {
                resolve();
              } else {
                setTimeout(check, 5);
              }
            };

            check();
          });

        const writer: WSWriter = {
          send(data) {
            ws.send(data);

            if (bufferedAmount() > 0) {
              return waitForDrain();
            }
          },
          close() {
            try {
              ws.close();
            } catch {}
          },
        };

        const s = await core.connect(writer, (err) => {
          console.error("[WS Hono] Write error:", err);

          try {
            ws.close();
          } catch {}
        });

        if (closed) {
          s.unsubscribe();
          return;
        }

        session = s;
      },
      onClose() {
        closed = true;
        session?.unsubscribe();
        session = null;
      },
    };
  });
}
