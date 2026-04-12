import type { IncomingMessage, ServerResponse } from "node:http";
import type { GSIHandlerOptions } from "../core/types";

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
export function createNodeHandler(options: GSIHandlerOptions) {
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
      for await (const chunk of req) {
        body += chunk;
      }

      if (!body) {
        throw new Error("GSI: Empty payload");
      }

      const payload = JSON.parse(body);

      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new Error("GSI: Invalid or empty payload");
      }

      if (token !== undefined && payload.auth?.token !== token) {
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

      const status =
        error.message.includes("Invalid") ||
        error.message.includes("parse") ||
        error.message.includes("Empty")
          ? 400
          : 500;

      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: process.env.NODE_ENV === "production" ? "Internal server error" : error.message,
        }),
      );
    }
  };
}
