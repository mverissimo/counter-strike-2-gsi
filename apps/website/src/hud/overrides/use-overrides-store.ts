import { useCallback, useEffect, useRef, useState } from "react";

import type { SpecOverrides } from "../spec/apply-overrides.ts";

// This app has no other backend on this branch — `pnpm mock` doubles as
// the overrides server (see `scripts/overrides-store.ts`, wired into
// `scripts/mock-server.ts`). Same hardcoded-origin pattern `main.tsx`
// already uses for the GSI feed itself.
const BASE_URL = "http://localhost:3000";
const DEBOUNCE_MS = 250;

export type OverridesStatus = "loading" | "saved" | "saving" | "offline";

/**
 * Server-owned persistence — `GET`/debounced `PUT /overrides`, plus a live
 * `/overrides/stream` subscription so a second open tab picks up an edit
 * made in the first — replacing the earlier `localStorage`-only version.
 * Same public shape (`overrides`/`patchNode`/`resetNode`), so nothing
 * downstream (`editor-page.tsx`, `properties-panel.tsx`) had to change; only
 * `status` is new.
 *
 * `pendingRef` is what keeps this tab's own write from re-PUTting a change
 * that arrived over the stream from *another* tab: `patchNode`/`resetNode`
 * are the only things that set it, so the debounce effect below can tell
 * "I have an edit to flush" from "the stream just told me something moved"
 * and only acts on the former.
 */
export function useOverridesStore() {
  const [overrides, setOverrides] = useState<SpecOverrides>({});
  const [status, setStatus] = useState<OverridesStatus>("loading");
  const pendingRef = useRef<SpecOverrides | null>(null);

  useEffect(() => {
    let live = true;

    fetch(`${BASE_URL}/overrides`)
      .then((res) => (res.ok ? (res.json() as Promise<SpecOverrides>) : Promise.reject(res)))
      .then((data) => {
        if (live) {
          setOverrides(data);
          setStatus("saved");
        }
      })
      .catch(() => {
        if (live) {
          setStatus("offline");
        }
      });

    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const source = new EventSource(`${BASE_URL}/overrides/stream`);

    source.addEventListener("update", (event) => {
      try {
        setOverrides(JSON.parse((event as MessageEvent<string>).data) as SpecOverrides);
        setStatus("saved");
      } catch {
        // A malformed frame corrects itself on the next one.
      }
    });

    source.onerror = () => setStatus("offline");

    return () => source.close();
  }, []);

  useEffect(() => {
    if (!pendingRef.current) {
      return;
    }

    setStatus("saving");

    const timer = setTimeout(() => {
      const payload = pendingRef.current;

      pendingRef.current = null;

      fetch(`${BASE_URL}/overrides`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then((res) => setStatus(res.ok ? "saved" : "offline"))
        .catch(() => setStatus("offline"));
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [overrides]);

  const patchNode = useCallback((nodeId: string, patch: SpecOverrides[string]) => {
    setOverrides((prev) => {
      const next = { ...prev, [nodeId]: { ...prev[nodeId], ...patch } };

      pendingRef.current = next;

      return next;
    });
  }, []);

  const resetNode = useCallback((nodeId: string) => {
    setOverrides((prev) => {
      if (!(nodeId in prev)) {
        return prev;
      }

      const next = { ...prev };

      delete next[nodeId];
      pendingRef.current = next;

      return next;
    });
  }, []);

  return { overrides, status, patchNode, resetNode };
}
