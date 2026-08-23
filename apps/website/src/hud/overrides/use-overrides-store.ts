import { useCallback, useEffect, useState } from "react";

import type { SpecOverrides } from "../spec/apply-overrides.ts";

const STORAGE_KEY = "cs2-gsi-hud:overrides";

/**
 * Client-only persistence (`localStorage`), scoped to whoever's browser has
 * the HUD open. Good enough to prove overrides survive a reload; a real OBS
 * browser source and multiple viewers sharing one layout will eventually
 * need a server-owned store instead (see the settings/config-store pattern
 * on `feat/website-overlay-and-derive`) — this hook is meant to be swapped
 * out behind the same interface once that exists.
 */
function readStoredOverrides(): SpecOverrides {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    return raw ? (JSON.parse(raw) as SpecOverrides) : {};
  } catch {
    return {};
  }
}

export function useOverridesStore() {
  const [overrides, setOverrides] = useState<SpecOverrides>(() => readStoredOverrides());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
    } catch {
      // Unavailable in some OBS browser sources and private-browsing modes;
      // overrides just stay in-memory for the rest of this session.
    }
  }, [overrides]);

  const patchNode = useCallback((nodeId: string, patch: SpecOverrides[string]) => {
    setOverrides((prev) => ({ ...prev, [nodeId]: { ...prev[nodeId], ...patch } }));
  }, []);

  const resetNode = useCallback((nodeId: string) => {
    setOverrides((prev) => {
      if (!(nodeId in prev)) {
        return prev;
      }

      const next = { ...prev };

      delete next[nodeId];

      return next;
    });
  }, []);

  return { overrides, patchNode, resetNode };
}
