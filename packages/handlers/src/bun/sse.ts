import { createSSECore } from "../core/sse";
import type { SSEWriter } from "../core/sse";
import type { SSEOptions } from "../core/types";

export function createSSEHandler(options: SSEOptions) {
  const core = createSSECore(options);

  return (req: Request): Response => {
    const lastEventId = req.headers.get("last-event-id") ?? undefined;

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const enqueue = (chunk: string) => {
          controller.enqueue(encoder.encode(chunk));
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

        let session: Awaited<ReturnType<typeof core.connect>> | undefined;
        let closed = false;

        const cleanup = () => {
          if (closed) {
            return;
          }

          closed = true;

          session?.unsubscribe();

          try {
            controller.close();
          } catch {}
        };

        req.signal.addEventListener("abort", cleanup, {
          once: true,
        });

        try {
          session = await core.connect(writer, lastEventId, (err) => {
            console.error("[SSE Bun] Write error:", err);

            cleanup();
          });

          if (closed) {
            session.unsubscribe();
          }
        } catch (err) {
          console.error("[SSE Bun] Connect error:", err);

          cleanup();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  };
}
