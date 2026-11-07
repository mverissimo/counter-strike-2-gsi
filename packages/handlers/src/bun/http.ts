import type { GSIHandlerOptions } from "../core/types";
import { classifyHandlerError, createIngress, readRequestBody } from "../core/http";

export function createBunHandler(options: GSIHandlerOptions<Request>) {
  const ingress = createIngress(options);

  return async (req: Request): Promise<Response> => {
    try {
      const { status, body } = await ingress(req.method, readRequestBody(req));
      return Response.json(body, { status });
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      options.onError?.(error, req);
      console.error("[GSI Bun Handler] Error:", error.message);

      const { status, body } = classifyHandlerError(error);
      return Response.json(body, { status });
    }
  };
}
