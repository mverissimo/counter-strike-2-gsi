import type { GSIHandlerOptions } from "../core/types";

/**
 * Creates a handler compatible with Bun.serve for CS2 GSI.
 *
 * @example
 * ```ts
 * Bun.serve({
 *   port: 3000,
 *   fetch(req) {
 *     if (new URL(req.url).pathname === "/gsi") {
 *       return createBunHandler({ manager, token })(req);
 *     }
 *
 *     return new Response("Not Found", { status: 404 });
 *   }
 * });
 * ```
 */
export function createBunHandler(options: GSIHandlerOptions) {
  const { manager, token, onError } = options;

  return async (req: Request): Promise<Response> => {
    try {
      if (req.method !== "POST") {
        return new Response("Method Not Allowed", {
          status: 405,
        });
      }

      const payload = (await req.json()) as {
        auth?: {
          token: string;
        };
      };

      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new Error("GSI: Invalid or empty payload");
      }

      if (token !== undefined && payload.auth?.token !== token) {
        console.warn(
          `[GSI] Invalid auth token from ${req.headers.get("x-forwarded-for") || "unknown"}`,
        );

        return Response.json(
          {
            error: "Invalid auth token",
          },
          {
            status: 401,
          },
        );
      }

      manager.update(payload);

      return Response.json({
        message: "OK",
      });
    } catch (err) {
      const error = err as Error;

      onError?.(error, req);

      console.error("[GSI Bun Handler] Error:", error.message);

      const status =
        error.message.includes("Invalid") || error.message.includes("parse") ? 400 : 500;

      return Response.json(
        {
          error: process.env.NODE_ENV === "production" ? "Internal server error" : error.message,
        },
        { status },
      );
    }
  };
}
