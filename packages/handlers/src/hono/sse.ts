import { streamSSE } from "hono/streaming";
import type { Context } from "hono";

import { createSSECore } from "../core/sse";
import type { SSEWriter } from "../core/sse";
import type { SSEOptions } from "../core/types";

export function createSSEHandler(options: SSEOptions) {
  const core = createSSECore(options);

  return (c: Context) => {
    const lastEventId = c.req.header("last-event-id");

    const reservation = core.reserve();

    if (!reservation) {
      return c.json({ error: "Too many SSE connections" }, 503, {
        "Retry-After": "5",
      });
    }

    return streamSSE(c, async (stream) => {
      const writer: SSEWriter = {
        async writeSSE(id, event, data) {
          await stream.writeSSE({
            id,
            event,
            data,
          });
        },
        async writeComment(text) {
          await stream.write(`: ${text}\n\n`);
        },
      };

      let resolveDone: () => void;

      const done = new Promise<void>((r) => {
        resolveDone = r;
      });

      let session: Awaited<ReturnType<typeof core.connect>> | undefined;
      let closed = false;

      stream.onAbort(() => {
        closed = true;
        session?.unsubscribe();
        resolveDone();
      });

      try {
        session = await core.connect(
          writer,
          lastEventId,
          (err) => {
            console.error("[SSE Hono] Write error:", err);

            resolveDone();
          },
          reservation,
        );
      } catch (err) {
        console.error("[SSE Hono] Connect error:", err);

        return;
      }

      if (closed) {
        session.unsubscribe();
        return;
      }

      await done;

      session.unsubscribe();
    });
  };
}
