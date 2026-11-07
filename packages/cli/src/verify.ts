import { createServer } from "node:http";
import type { Configuration } from "./config";
import { validateUri } from "./config";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

interface ProviderMetadata {
  appid: 730;
  timestamp: number;
}

function isCS2Provider(value: unknown): value is ProviderMetadata {
  return (
    isRecord(value) &&
    value.appid === 730 &&
    typeof value.timestamp === "number" &&
    Number.isFinite(value.timestamp)
  );
}

export async function verifyConnection(
  config: Configuration,
  timeoutMs: number,
  onListening: (port: number) => void = () => {},
): Promise<void> {
  const url = validateUri(config.uri);
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
    throw new Error(
      "Verification requires a local HTTP endpoint (127.0.0.1, localhost or [::1]). For remote/HTTPS endpoints, check your server logs.",
    );
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_147_483_647) {
    throw new Error(
      "Verification timeout must be a positive number no greater than 2147483 seconds.",
    );
  }
  if (!config.data.includes("provider"))
    throw new Error(
      "Verification requires the provider component. Reinstall with --components including provider.",
    );
  await new Promise<void>((resolve, reject) => {
    const server = createServer((req, res) => {
      if (req.url !== `${url.pathname}${url.search}` || req.method !== "POST") {
        res.writeHead(404).end();
        req.resume();
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      req.on("error", () => {
        /* A disconnected sender must not terminate verification. */
      });
      req.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > 1024 * 1024) {
          res.writeHead(413).end();
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on("end", () => {
        try {
          const payload: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          if (
            !isRecord(payload) ||
            !isRecord(payload.auth) ||
            payload.auth.token !== config.token
          ) {
            res.writeHead(403).end();
          } else if (!isCS2Provider(payload.provider)) {
            res.writeHead(400).end();
          } else {
            res.writeHead(200).end("OK", () => finish());
          }
        } catch {
          res.writeHead(400).end();
        }
      });
    });
    const timer = setTimeout(
      () =>
        finish(
          new Error(
            "No authenticated CS2 payload received. Restart CS2, enter a match or spectate, and check the endpoint and firewall.",
          ),
        ),
      timeoutMs,
    );
    let finished = false;
    function finish(error?: Error) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      server.close();
      server.closeAllConnections();
      if (error) reject(error);
      else resolve();
    }
    server.once("error", (error: NodeJS.ErrnoException) =>
      finish(
        error.code === "EADDRINUSE"
          ? new Error(
              "Endpoint port is already in use. Stop the HUD/GSI server before verifying, then start it again afterward.",
            )
          : error,
      ),
    );
    server.listen(Number(url.port || 80), url.hostname === "[::1]" ? "::1" : url.hostname, () => {
      const address = server.address();
      if (address && typeof address === "object") onListening(address.port);
    });
  });
}
