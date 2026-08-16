import { createSSECore } from "../core/sse";
import type { SSEWriter } from "../core/sse";
import type { SSEOptions } from "../core/types";

export function createSSEHandler(options: SSEOptions) {
  const core = createSSECore(options);

  return (req: Request): Response => {
    const lastEventId = req.headers.get("last-event-id") ?? undefined;

    const reservation = core.reserve();

    if (!reservation) {
      return new Response(JSON.stringify({ error: "Too many SSE connections" }), {
        status: 503,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "5",
        },
      });
    }

    const encoder = new TextEncoder();
    const stream = new TransformStream<Uint8Array, Uint8Array>();
    const streamWriter = stream.writable.getWriter();

    void (async () => {
      const writer: SSEWriter = {
        writeSSE(id, event, data) {
          return streamWriter.write(
            encoder.encode(`id: ${id}\nevent: ${event}\ndata: ${data}\n\n`),
          );
        },
        writeComment(text) {
          return streamWriter.write(encoder.encode(`: ${text}\n\n`));
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

        void streamWriter.close().catch(() => {});
      };

      req.signal.addEventListener("abort", cleanup, {
        once: true,
      });

      try {
        await streamWriter.write(encoder.encode(":ok\n\n"));

        session = await core.connect(
          writer,
          lastEventId,
          (err) => {
            console.error("[SSE Bun] Write error:", err);

            cleanup();
          },
          reservation,
        );

        if (closed) {
          session.unsubscribe();
        }
      } catch (err) {
        reservation.release();

        console.error("[SSE Bun] Connect error:", err);

        cleanup();
      }
    })();

    return new Response(stream.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  };
}
