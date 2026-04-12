import type { IncomingMessage, ServerResponse } from "node:http";

import { createSSECore } from "../core/sse";
import type { SSEWriter } from "../core/sse";
import type { SSEOptions } from "../core/types";

export function createSSEHandler(options: SSEOptions) {
  const core = createSSECore(options);

  return (req: IncomingMessage, res: ServerResponse) => {
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

    core
      .connect(writer, lastEventId)
      .then((session) => {
        const cleanup = () => {
          session.unsubscribe();

          try {
            res.end();
          } catch {}
        };

        req.on("close", cleanup);
        res.on("close", cleanup);
      })
      .catch(() => {});
  };
}
