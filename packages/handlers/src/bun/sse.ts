import { createSSECore } from "../core/sse";
import type { SSEWriter } from "../core/sse";
import type { SSEOptions } from "../core/types";

export function createSSEHandler(options: SSEOptions) {
  const core = createSSECore(options);

  return (req: Request): Response => {
    const lastEventId = req.headers.get("last-event-id") ?? undefined;

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();

        const enqueue = (chunk: string) => {
          try {
            controller.enqueue(encoder.encode(chunk));
          } catch {}
        };

        const writer: SSEWriter = {
          writeSSE(id, event, data) {
            enqueue(`id: ${id}\nevent: ${event}\ndata: ${data}\n\n`);
          },
          writeComment(text) {
            enqueue(`: ${text}\n\n`);
          },
        };

        enqueue(":ok\n\n");

        core
          .connect(writer, lastEventId)
          .then((session) => {
            req.signal.addEventListener(
              "abort",
              () => {
                session.unsubscribe();

                try {
                  controller.close();
                } catch {}
              },
              {
                once: true,
              },
            );
          })
          .catch(() => {});
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        "Access-Control-Allow-Origin": "*", // or your frontend origin
      },
    });
  };
}
