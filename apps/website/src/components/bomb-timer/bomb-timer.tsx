import { useEffect, useState } from "react";
import { useGSIDelta } from "@counter-strike-2-gsi/client";
import { parseSeconds } from "@counter-strike-2-gsi/types/derive";

import { cssVars } from "../../lib/css.ts";
import { StatBar } from "../stat-bar/stat-bar.tsx";
import styles from "./bomb-timer.module.css";

/** C4 fuse length in CS2. */
const FUSE_SECONDS = 40;

const LABEL: Record<string, string> = {
  planted: "planted",
  defusing: "defusing",
  defused: "defused",
  exploded: "detonated",
};

interface BombTimerProps {
  state: string | undefined;
  countdown: string | undefined;
}

/**
 * The one component that reads both tiers of the stream, and the clearest
 * illustration of why both exist:
 *
 * - `countdown` comes down from the `"update"` snapshot in `overlay.tsx`. It
 *   is a *value* — what the timer shows right now.
 * - `useGSIDelta("bomb:state")` is a *transition*. `{ previous, current }` is
 *   the only thing that tells us the plant just happened, which is what a
 *   one-shot flash needs. Polling the snapshot could not distinguish "just
 *   planted" from "planted 20 seconds ago".
 */
export function BombTimer(props: BombTimerProps) {
  const { state, countdown } = props;

  const bombState = useGSIDelta("bomb:state");
  const [flashKey, setFlashKey] = useState(0);

  useEffect(() => {
    if (bombState?.current === "planted" && bombState.previous !== "planted") {
      setFlashKey((n) => n + 1);
    }
  }, [bombState]);

  if (state !== "planted" && state !== "defusing" && state !== "defused" && state !== "exploded") {
    return null;
  }

  const seconds = Math.max(0, parseSeconds(countdown) ?? 0);
  const ticking = state === "planted" || state === "defusing";

  // Clamped low as well as high: a countdown longer than the fuse would go
  // negative and slow the beep below its resting rate.
  const urgency = Math.min(1, Math.max(0, 1 - seconds / FUSE_SECONDS));

  return (
    <div className={styles.root}>
      <div
        // Remounting on plant restarts the flash animation from zero.
        key={flashKey}
        className={styles.plate}
        data-state={state}
        data-flash={ticking}
        style={cssVars({
          "--urgency": urgency,
        })}
      >
        <span className={styles.icon} />
        <span className={styles.label}>{LABEL[state]}</span>
        {ticking && <span className={styles.time}>{seconds.toFixed(1)}</span>}
      </div>

      {ticking && (
        <div className={styles.fuse}>
          <StatBar value={seconds} max={FUSE_SECONDS} tone="health" state="critical" />
        </div>
      )}
    </div>
  );
}
