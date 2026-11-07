import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import type { GSIHandlerOptions } from "../core/types";
import { classifyHandlerError, createIngress, readRequestBody } from "../core/http";

export function createHonoHandler(options: GSIHandlerOptions<Request>) {
  const ingress = createIngress(options);

  return async (context: Context) => {
    try {
      const { status, body } = await ingress(context.req.method, readRequestBody(context.req.raw));
      return context.json(body, status);
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      options.onError?.(error, context.req.raw);
      console.error("[GSI Hono Handler] Error:", error.message);

      const { status, body } = classifyHandlerError(error);
      return context.json(body, status as ContentfulStatusCode);
    }
  };
}
