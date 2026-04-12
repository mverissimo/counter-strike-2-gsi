import type { Context } from "hono";
import type { GSIHandlerOptions } from "../core/types";

/**
 * Creates a Hono handler for CS2 GSI (recommended for new projects).
 *
 * @example
 * ```ts
 * app.post("/gsi", createHonoHandler({
 *   manager,
 *   token: process.env.GSI_TOKEN,
 *   onError: (err) => console.error(err)
 * }));
 * ```
 */
export function createHonoHandler(options: GSIHandlerOptions) {
  const { manager, token, onError } = options;

  return async (context: Context) => {
    try {
      const payload = await context.req.json();

      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new Error("GSI: Invalid or empty payload");
      }

      if (token !== undefined && payload.auth?.token !== token) {
        console.warn(
          `[GSI] Invalid auth token from ${context.req.header("x-forwarded-for") || "unknown"}`,
        );

        return context.json({ error: "Invalid auth token" }, 401);
      }

      manager.update(payload);

      return context.json({
        message: "OK",
      });
    } catch (err) {
      const error = err as Error;

      onError?.(error, context.req.raw);

      console.error("[GSI Hono Handler] Error:", error.message);

      const status =
        error.message.includes("Invalid") || error.message.includes("parse") ? 400 : 500;

      return context.json(
        {
          error: process.env.NODE_ENV === "production" ? "Internal server error" : error.message,
        },
        status,
      );
    }
  };
}
