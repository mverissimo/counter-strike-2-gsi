import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";

import type { SpecOverrides } from "../src/hud/spec/apply-overrides.ts";

const STORE_PATH = new URL("../overrides.json", import.meta.url);

function obj(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Coerces rather than rejects, same trust-boundary philosophy as
 * `apps/website/src/lib/config.ts`'s `sanitizeConfig` on the sibling
 * reconciliation branch: a hand-edited or truncated `overrides.json`
 * degrades to dropping the bad entry, not to refusing to start.
 */
function sanitize(value: unknown): SpecOverrides {
  const input = obj(value);
  const result: SpecOverrides = {};

  for (const [id, rawPatch] of Object.entries(input)) {
    const patch = obj(rawPatch);
    const entry: SpecOverrides[string] = {};

    if (typeof patch.visible === "boolean") {
      entry.visible = patch.visible;
    }

    if (typeof patch.props === "object" && patch.props !== null && !Array.isArray(patch.props)) {
      entry.props = patch.props as Record<string, unknown>;
    }

    if (typeof patch.style === "object" && patch.style !== null && !Array.isArray(patch.style)) {
      entry.style = patch.style as SpecOverrides[string]["style"];
    }

    if (Object.keys(entry).length > 0) {
      result[id] = entry;
    }
  }

  return result;
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      try {
        resolve(chunks.length === 0 ? {} : JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
    req.on("error", reject);
  });
}

/**
 * The one piece of this branch's persistence that isn't `localStorage`:
 * `GET`/`PUT /overrides` plus an SSE `/overrides/stream` so a second open
 * tab picks up an edit made in the first — the same shape `config-store.ts`
 * has on the reconciliation branch, scoped down to just `SpecOverrides`
 * (this branch has no `OverlayConfig` to persist alongside it).
 *
 * Backed by a JSON file next to this script rather than anything heavier:
 * there's exactly one writer class (the editor page) and no concurrent-
 * write contention to design around.
 */
export function createOverridesStore() {
  let current: SpecOverrides = {};
  const listeners = new Set<(overrides: SpecOverrides) => void>();

  async function load(): Promise<void> {
    if (!existsSync(STORE_PATH)) {
      return;
    }

    try {
      const raw = await readFile(STORE_PATH, "utf8");

      current = sanitize(JSON.parse(raw));
    } catch {
      current = {};
    }
  }

  async function save(input: unknown): Promise<SpecOverrides> {
    current = sanitize(input);

    await writeFile(STORE_PATH, JSON.stringify(current, null, 2));

    for (const listener of listeners) {
      listener(current);
    }

    return current;
  }

  function stream(res: ServerResponse): void {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write(`event: update\ndata: ${JSON.stringify(current)}\n\n`);

    const listener = (overrides: SpecOverrides) => {
      res.write(`event: update\ndata: ${JSON.stringify(overrides)}\n\n`);
    };

    listeners.add(listener);
    res.on("close", () => listeners.delete(listener));
  }

  /** Returns whether it handled the request, so the caller can fall through to the GSI handler. */
  async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = req.url?.split("?")[0];

    if (url === "/overrides" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(current));

      return true;
    }

    if (url === "/overrides" && req.method === "PUT") {
      try {
        const body = await readBody(req);
        const saved = await save(body);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(saved));
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "invalid body" }));
      }

      return true;
    }

    if (url === "/overrides/stream" && req.method === "GET") {
      stream(res);

      return true;
    }

    return false;
  }

  return { load, handleRequest };
}
