import type { IncomingMessage, ServerResponse } from "node:http";

import { createSSECore } from "../core/sse";
import type { SSEWriter } from "../core/sse";
import type { SSEOptions } from "../core/types";

export function createSSEHandler(options: SSEOptions) {
  const core = createSSECore(options);

  return async (req: IncomingMessage, res: ServerResponse) => {
    const lastEventIdHeader = req.headers["last-event-id"];
    const lastEventId = Array.isArray(lastEventIdHeader) ? lastEventIdHeader[0] : lastEventIdHeader;

    const reservation = core.reserve();

    if (!reservation) {
      res.writeHead(503, {
        "Content-Type": "application/json",
        "Retry-After": "5",
      });
      res.end(JSON.stringify({ error: "Too many SSE connections" }));

      return;
    }

    try {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      res.write(": ok\n\n");
    } catch (err) {
      reservation.release();

      console.error("[SSE Node] Connect error:", err);

      return;
    }

    const write = (chunk: string): void | Promise<void> => {
      if (res.write(chunk)) {
        return;
      }

      return new Promise<void>((resolve, reject) => {
        const cleanupListeners = () => {
          res.off("drain", onDrain);
          res.off("error", onError);
          res.off("close", onClose);
        };
        const onDrain = () => {
          cleanupListeners();
          resolve();
        };
        const onError = (error: Error) => {
          cleanupListeners();
          reject(error);
        };
        const onClose = () => {
          cleanupListeners();
          reject(new Error("SSE response closed before buffered data drained"));
        };

        res.once("drain", onDrain);
        res.once("error", onError);
        res.once("close", onClose);
      });
    };

    const writer: SSEWriter = {
      writeSSE(id, event, data) {
        return write(`id: ${id}\nevent: ${event}\ndata: ${data}\n\n`);
      },
      writeComment(text) {
        return write(`: ${text}\n\n`);
      },
    };

    let session: Awaited<ReturnType<typeof core.connect>> | undefined;
    let closed = false;

    const cleanup = () => {
      if (closed) {
        return;
      }

      closed = true;

      session?.unsubscribe();

      try {
        res.end();
      } catch {}
    };

    req.on("close", cleanup);
    res.on("close", cleanup);

    try {
      session = await core.connect(
        writer,
        lastEventId,
        (err) => {
          console.error("[SSE Node] Write error:", err);

          cleanup();
        },
        reservation,
      );

      if (closed) session.unsubscribe();
    } catch (err) {
      console.error("[SSE Node] Connect error:", err);

      cleanup();
    }
  };
}
