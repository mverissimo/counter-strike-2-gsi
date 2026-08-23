import { useEffect, useRef, useState } from "react";
import { useGSIDerivedEvent } from "@counter-strike-2-gsi/client";

const MAX_ENTRIES = 5;

let nextId = 0;

export interface KillFeedEntry {
  id: number;
  name: string;
  kills: number;
  headshots: number;
}

/**
 * `player:killed` (see `useGSIDerivedEvent`) only ever gives the *latest*
 * occurrence — the store keeps one slot per event name, not a history — so
 * a feed has to accumulate it into its own rolling list, same as any
 * "watch a stream, keep the last N" UI.
 *
 * `lastRef`'s initial value is the hook's value at mount, not `undefined`:
 * a component that mounts after the store already has a cached kill (a
 * reconnect, a settings-page remount) would otherwise show that stale
 * value as a brand-new entry the moment it renders.
 */
export function useKillFeedLog(): KillFeedEntry[] {
  const event = useGSIDerivedEvent("player:killed");
  const [entries, setEntries] = useState<KillFeedEntry[]>([]);
  const lastRef = useRef(event);

  useEffect(() => {
    if (event === undefined || event === lastRef.current) {
      return;
    }

    lastRef.current = event;

    setEntries((prev) =>
      [
        {
          id: nextId++,
          name: event.name ?? "unknown",
          kills: event.kills,
          headshots: event.headshots,
        },
        ...prev,
      ].slice(0, MAX_ENTRIES),
    );
  }, [event]);

  return entries;
}
