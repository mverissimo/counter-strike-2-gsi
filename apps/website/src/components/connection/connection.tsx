import { memo } from "react";
import { useGSIStatus } from "@counter-strike-2-gsi/client";

import styles from "./connection.module.css";

const LABEL = {
  connecting: "connecting",
  connected: "live",
  disconnected: "no signal",
} as const;

interface ConnectionProps {
  /** True once any payload has arrived; drives "connected but idle". */
  hasData: boolean;
}

/**
 * `useGSIStatus` is on its own subscription in the client, and `memo` covers
 * the other direction — the parent re-renders every tick — so this re-renders
 * on connection changes only.
 *
 * Once the stream is healthy the badge fades away: on stream, a permanent
 * green dot is just clutter. It reappears the moment anything is wrong.
 */
export const Connection = memo(function Connection(props: ConnectionProps) {
  const { hasData } = props;

  const status = useGSIStatus();
  const healthy = status === "connected" && hasData;

  return (
    <div className={styles.root} data-status={status} data-hidden={healthy}>
      <span className={styles.dot} />
      <span className={styles.label}>
        {status === "connected" && !hasData ? "waiting for game" : LABEL[status]}
      </span>
    </div>
  );
});
