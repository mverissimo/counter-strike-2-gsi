import type { IncomingMessage, ServerResponse } from "node:http";
import type { GSIHandlerOptions } from "../core/types";
import { classifyHandlerError, safeTokenEqual } from "../core/http";

// CS2 GSI payloads top out around a few hundred KB with allplayers +
// grenades enabled; anything past this is not a game client.
const MAX_BODY_BYTES = 1024 * 1024;

/**
 * Creates a pure Node.js HTTP handler for CS2 GSI (no external dependencies).
 *
 * @example
 * ```ts
 * const server = createServer(createNodeHandler({
 *   manager,
 *   token: process.env.GSI_TOKEN,
 *   onError: (err, req) => console.error(err)
 * }));
 *
 * server.listen(3000);
 * ```
 */
export function createNodeHandler(options: GSIHandlerOptions<IncomingMessage>) {
  const { manager, token, onError } = options;

  return async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== "POST") {
      res.writeHead(405, {
        "Content-Type": "application/json",
      });
      res.end(
        JSON.stringify({
          error: "Method Not Allowed",
        }),
      );

      return;
    }

    let body = "";

    try {
      let received = 0;

      for await (const chunk of req) {
        received += chunk.length;

        if (received > MAX_BODY_BYTES) {
          res.writeHead(413, {
            "Content-Type": "application/json",
          });
          res.end(
            JSON.stringify({
              error: "Payload too large",
            }),
          );
          req.destroy();

          return;
        }

        body += chunk;
      }

      if (!body) {
        throw new Error("GSI: Empty payload");
      }

      const payload = JSON.parse(body);

      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new Error("GSI: Invalid or empty payload");
      }

      if (token !== undefined && !safeTokenEqual(token, payload.auth?.token)) {
        console.warn(`[GSI] Invalid auth token from ${req.socket.remoteAddress || "unknown"}`);

        res.writeHead(401, {
          "Content-Type": "application/json",
        });
        res.end(
          JSON.stringify({
            error: "Invalid auth token",
          }),
        );

        return;
      }

      manager.update(payload);

      res.writeHead(200, {
        "Content-Type": "application/json",
      });
      res.end(
        JSON.stringify({
          message: "OK",
        }),
      );
    } catch (err) {
      const error = err as Error;

      onError?.(error, req);

      console.error("[GSI Node Handler] Error:", error.message);

      const { status, body } = classifyHandlerError(error);

      res.writeHead(status, {
        "Content-Type": "application/json",
      });
      res.end(JSON.stringify(body));
    }
  };
}
