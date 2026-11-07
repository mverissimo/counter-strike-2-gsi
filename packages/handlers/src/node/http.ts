import type { IncomingMessage, ServerResponse } from "node:http";
import type { GSIHandlerOptions } from "../core/types";
import { classifyHandlerError, createIngress } from "../core/http";

export function createNodeHandler(options: GSIHandlerOptions<IncomingMessage>) {
  const ingress = createIngress(options);

  return async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const { status, body } = await ingress(req.method, req.iterator({ destroyOnReturn: false }));
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      options.onError?.(error, req);
      console.error("[GSI Node Handler] Error:", error.message);

      const { status, body } = classifyHandlerError(error);
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body), () => {
        if (status === 413) req.destroy();
      });
    }
  };
}
