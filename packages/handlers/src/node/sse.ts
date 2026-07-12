import type { IncomingMessage, ServerResponse } from "node:http";

import { createSSECore } from "../core/sse";
import type { SSEWriter } from "../core/sse";
import type { SSEOptions } from "../core/types";

export function createSSEHandler(options: SSEOptions) {
  const core = createSSECore(options);

  return async (req: IncomingMessage, res: ServerResponse) => {
    const lastEventIdHeader = req.headers["last-event-id"];
    const lastEventId = Array.isArray(lastEventIdHeader) ? lastEventIdHeader[0] : lastEventIdHeader;

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    res.write(": ok\n\n");

    const writer: SSEWriter = {
      writeSSE(id, event, data) {
        res.write(`id: ${id}\nevent: ${event}\ndata: ${data}\n\n`);
      },
      writeComment(text) {
        res.write(`: ${text}\n\n`);
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
      session = await core.connect(writer, lastEventId, (err) => {
        console.error("[SSE Node] Write error:", err);

        cleanup();
      });

      if (closed) session.unsubscribe();
    } catch (err) {
      console.error("[SSE Node] Connect error:", err);

      cleanup();
    }
  };
}
